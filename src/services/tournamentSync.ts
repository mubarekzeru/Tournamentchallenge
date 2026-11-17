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

// Recursively remove any keys with undefined/NaN/Infinity values from objects and arrays for Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (typeof data === 'number' && !Number.isFinite(data)) {
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

export function hasPendingCloudSyncStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_PENDING_CLOUD_SYNC) === 'true';
  } catch {
    return false;
  }
}

export interface SaveSyncResult {
  firestoreOk: boolean;
  serverOk: boolean;
  updatedAt: string;
  reason?: 'auth_required' | 'permission_denied' | 'payload_too_large' | 'error';
  errorMessage?: string;
}

export function markPendingCloudSync(pending: boolean, updatedAt?: string) {
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

function toFirestoreRestValue(val: any): Record<string, any> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { nullValue: null };
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map((v) => toFirestoreRestValue(v)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreRestValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function writeTournamentViaRestFallback(cleanPayload: Record<string, any>): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Google Sign-In is required to write to Firestore.');
  }
  const { default: firebaseConfig } = await import('../../firebase-applet-config.json');
  const idToken = await user.getIdToken(true);
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(
    databaseId
  )}/documents/tournament/${TOURNAMENT_DOC_PATH}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;

  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(cleanPayload)) {
    if (v !== undefined) {
      fields[k] = toFirestoreRestValue(v);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Missing or insufficient permissions (${res.status}): ${errBody}`);
      }
      throw new Error(`Firestore REST write failed (${res.status}): ${errBody || res.statusText}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function commitTournamentDocToFirestore(cleanPayload: Record<string, any>): Promise<void> {
  const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
  const TIMEOUT_MS = 10000;

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      setDoc(docRef, cleanPayload),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error('FIRESTORE_SDK_TIMEOUT'));
        }, TIMEOUT_MS);
      }),
    ]);
  } catch (err: any) {
    const msg = String(err?.message || err);
    const code = String(err?.code || '');
    // Permission errors must be surfaced directly without masking
    if (
      code.includes('permission') ||
      msg.toLowerCase().includes('permission') ||
      code === 'unauthenticated'
    ) {
      throw err;
    }
    // If the SDK long-polling stream stalled or reported transient unavailable/timeout,
    // immediately fall back to a direct authenticated HTTPS REST PATCH so mobile users never get stuck.
    if (
      msg === 'FIRESTORE_SDK_TIMEOUT' ||
      code === 'unavailable' ||
      code === 'deadline-exceeded' ||
      msg.toLowerCase().includes('offline') ||
      msg.toLowerCase().includes('network')
    ) {
      await writeTournamentViaRestFallback(cleanPayload);
      return;
    }
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function postToExpressBackupWithTimeout(cleanPayload: Record<string, any>): Promise<boolean> {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const apiRes = await fetch('/api/tournament', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
      signal: controller.signal,
    });
    return apiRes.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Persist updates to Firestore + optional local Express backup (never blocks Firestore behind /api/tournament)
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

  // Kick off optional local Express backup in parallel with short timeout so it NEVER blocks Firestore
  const serverPromise = postToExpressBackupWithTimeout(cleanPayload);

  // Persist to Firestore when signed in (firestore.rules: allow write: if request.auth != null)
  if (!auth.currentUser) {
    const serverOk = await serverPromise;
    return {
      firestoreOk: false,
      serverOk,
      updatedAt: updatedAtIso,
      reason: 'auth_required',
      errorMessage: 'Sign in with Google first to publish live to Firebase.',
    };
  }

  // Check Firestore 1MB document limit before calling setDoc
  try {
    const approxBytes = new Blob([JSON.stringify(cleanPayload)]).size;
    if (approxBytes > 980_000) {
      const serverOk = await serverPromise;
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
    await commitTournamentDocToFirestore(cleanPayload);
    markPendingCloudSync(false, updatedAtIso);
    const serverOk = await serverPromise;
    return { firestoreOk: true, serverOk, updatedAt: updatedAtIso };
  } catch (err: any) {
    const serverOk = await serverPromise;
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
        errorMessage: 'Firebase permission denied. Please sign out and sign in again with Google.',
      };
    }
    console.error('Error saving to Firestore:', err);
    return {
      firestoreOk: false,
      serverOk,
      updatedAt: updatedAtIso,
      reason: 'error',
      errorMessage: msg.includes('Failed to fetch') || msg.toLowerCase().includes('offline')
        ? 'Network connection issue while reaching Firebase. Check your internet and try again.'
        : msg,
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
    await commitTournamentDocToFirestore(cleanPayload);
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
