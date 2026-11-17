import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, validateFirestoreConnection } from '../lib/firebase';
import { Player, MatchResult, TournamentFormat, GroupStageConfig, MatchClockConfig } from '../types/tournament';

const TOURNAMENT_DOC_PATH = 'live';
export const STORAGE_KEY_UPDATED_AT = 'efootball_tournament_updated_at_v1';
export const STORAGE_KEY_PENDING_CLOUD_SYNC = 'efootball_pending_cloud_sync_v1';

export interface TournamentPayload {
  players: Player[];
  results: MatchResult[];
  adminPasscode?: string;
  tournamentFormat?: TournamentFormat;
  groupStageConfig?: GroupStageConfig;
  clockConfig?: MatchClockConfig;
  isRegistrationEnded?: boolean;
  deletedResultIds?: string[];
  resultsResetAt?: string;
  updatedAt: string;
}

// Subscribe to real-time updates from Firestore across all devices
export function subscribeTournamentData(
  onData: (data: TournamentPayload) => void,
  onError?: (err: Error) => void
) {
  validateFirestoreConnection();

  const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as TournamentPayload;
        onData(data);
      }
    },
    (error) => {
      console.warn('Firestore subscription notice:', error);
      if (onError) onError(error);
    }
  );
}

// Fetch single snapshot from Firestore
export async function getTournamentDataOnce(): Promise<TournamentPayload | null> {
  try {
    const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as TournamentPayload;
    }
  } catch (e) {
    console.warn('Could not fetch tournament data from Firestore:', e);
  }
  return null;
}

// Recursively remove any keys with undefined values from objects and arrays for Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as any;
  }
  return data;
}

export interface SaveSyncResult {
  firestoreOk: boolean;
  serverOk: boolean;
  updatedAt: string;
  reason?: 'auth_required' | 'permission_denied' | 'payload_too_large' | 'error';
  errorMessage?: string;
}

function markPendingCloudSync(pending: boolean, updatedAt?: string) {
  try {
    if (updatedAt) {
      localStorage.setItem(STORAGE_KEY_UPDATED_AT, updatedAt);
    }
    if (pending) {
      localStorage.setItem(STORAGE_KEY_PENDING_CLOUD_SYNC, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_PENDING_CLOUD_SYNC);
    }
  } catch {
    // Ignore storage quota issues
  }
}

// Persist updates to server API + Firestore (requires signed-in Google user per firestore.rules)
export async function saveTournamentDataToFirestore(payload: {
  players: Player[];
  results: MatchResult[];
  adminPasscode?: string;
  tournamentFormat?: TournamentFormat;
  groupStageConfig?: GroupStageConfig;
  clockConfig?: MatchClockConfig;
  isRegistrationEnded?: boolean;
  deletedResultIds?: string[];
  resultsResetAt?: string;
  updatedAt?: string;
}): Promise<SaveSyncResult> {
  const updatedAtIso = payload.updatedAt || new Date().toISOString();
  const rawPayload: Record<string, any> = {
    players: payload.players,
    results: payload.results,
    updatedAt: updatedAtIso,
  };
  if (payload.adminPasscode !== undefined && payload.adminPasscode !== '') {
    rawPayload.adminPasscode = payload.adminPasscode;
  }
  if (payload.tournamentFormat !== undefined) {
    rawPayload.tournamentFormat = payload.tournamentFormat;
  }
  if (payload.groupStageConfig !== undefined) {
    rawPayload.groupStageConfig = payload.groupStageConfig;
  }
  if (payload.clockConfig !== undefined) {
    rawPayload.clockConfig = payload.clockConfig;
  }
  if (payload.isRegistrationEnded !== undefined) {
    rawPayload.isRegistrationEnded = payload.isRegistrationEnded;
  }
  if (Array.isArray(payload.deletedResultIds) && payload.deletedResultIds.length > 0) {
    rawPayload.deletedResultIds = payload.deletedResultIds;
  }
  if (payload.resultsResetAt) {
    rawPayload.resultsResetAt = payload.resultsResetAt;
  }

  const cleanPayload = sanitizeForFirestore(rawPayload);

  // Immediately record local timestamp & pending flag so a page refresh never erases this save
  markPendingCloudSync(true, updatedAtIso);

  // 1. Persist to Node server API when available
  let serverOk = false;
  try {
    const apiRes = await fetch('/api/tournament', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    });
    serverOk = apiRes.ok;
  } catch {
    serverOk = false;
  }

  // 2. Persist to Firestore when signed in (firestore.rules: allow write: if request.auth != null)
  if (!auth.currentUser) {
    return {
      firestoreOk: false,
      serverOk,
      updatedAt: updatedAtIso,
      reason: 'auth_required',
    };
  }

  // Check Firestore 1MB document limit before calling setDoc
  try {
    const approxBytes = new Blob([JSON.stringify(cleanPayload)]).size;
    if (approxBytes > 980_000) {
      return {
        firestoreOk: false,
        serverOk,
        updatedAt: updatedAtIso,
        reason: 'payload_too_large',
        errorMessage: `Tournament data (${Math.round(approxBytes / 1024)} KB) is near Firebase's 1 MB document limit. Reduce player photo sizes to sync to cloud.`,
      };
    }
  } catch {
    // Ignore size check if Blob unavailable
  }

  const docPath = `tournament/${TOURNAMENT_DOC_PATH}`;
  try {
    const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
    await setDoc(docRef, cleanPayload);
    markPendingCloudSync(false, updatedAtIso);
    return { firestoreOk: true, serverOk, updatedAt: updatedAtIso };
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes('permission')) {
      try {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      } catch {
        // Caught after structured diagnostic log
      }
      return {
        firestoreOk: false,
        serverOk,
        updatedAt: updatedAtIso,
        reason: 'permission_denied',
        errorMessage: msg,
      };
    }
    console.error('Error saving to Firestore:', err);
    return {
      firestoreOk: false,
      serverOk,
      updatedAt: updatedAtIso,
      reason: 'error',
      errorMessage: msg,
    };
  }
}

// Bridge a newer local or server snapshot directly into Firestore (without re-POSTing to /api/tournament)
export async function pushSnapshotToFirestoreOnly(payload: Record<string, any>): Promise<boolean> {
  if (!auth.currentUser || !payload || !Array.isArray(payload.players)) {
    return false;
  }
  const updatedAtIso = payload.updatedAt || new Date().toISOString();
  const cleanPayload = sanitizeForFirestore({
    ...payload,
    updatedAt: updatedAtIso,
  });
  const docPath = `tournament/${TOURNAMENT_DOC_PATH}`;
  try {
    const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
    await setDoc(docRef, cleanPayload);
    markPendingCloudSync(false, updatedAtIso);
    return true;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes('permission')) {
      try {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      } catch {
        // Caught after diagnostic log
      }
    }
    return false;
  }
}

// Purge obsolete data: removes any scores or matches belonging to members not in activePlayers
export function purgeOrphanedMatchScores(
  activePlayers: Player[],
  allResults: MatchResult[]
): {
  cleanedResults: MatchResult[];
  purgedCount: number;
} {
  const activeUsernames = new Set(activePlayers.map((p) => p.user.trim().toLowerCase()));
  const cleanedResults = allResults.filter((r) => {
    const homeActive = activeUsernames.has(r.home_user.trim().toLowerCase());
    const awayActive = activeUsernames.has(r.away_user.trim().toLowerCase());
    return homeActive && awayActive;
  });

  return {
    cleanedResults,
    purgedCount: allResults.length - cleanedResults.length,
  };
}
