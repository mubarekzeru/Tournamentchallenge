import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, validateFirestoreConnection } from '../lib/firebase';
import { Player, MatchResult, TournamentFormat, GroupStageConfig, MatchClockConfig } from '../types/tournament';

const TOURNAMENT_DOC_PATH = 'live';

export interface TournamentPayload {
  players: Player[];
  results: MatchResult[];
  adminPasscode?: string;
  tournamentFormat?: TournamentFormat;
  groupStageConfig?: GroupStageConfig;
  clockConfig?: MatchClockConfig;
  isRegistrationEnded?: boolean;
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

// Persist updates to Firestore so all devices see the changes instantly
export async function saveTournamentDataToFirestore(payload: {
  players: Player[];
  results: MatchResult[];
  adminPasscode?: string;
  tournamentFormat?: TournamentFormat;
  groupStageConfig?: GroupStageConfig;
  clockConfig?: MatchClockConfig;
  isRegistrationEnded?: boolean;
}): Promise<boolean> {
  try {
    const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
    const rawPayload: Record<string, any> = {
      players: payload.players,
      results: payload.results,
      updatedAt: new Date().toISOString(),
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

    // Clean overwrite without merge and strip all undefined values so Firestore never errors
    const cleanPayload = sanitizeForFirestore(rawPayload);
    await setDoc(docRef, cleanPayload);

    // Also notify local API for fallback
    fetch('/api/tournament', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    }).catch(() => {});

    return true;
  } catch (err) {
    console.error('Error saving to Firestore:', err);
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

