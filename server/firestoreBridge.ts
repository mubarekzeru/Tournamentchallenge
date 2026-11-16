import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  Player,
  MatchResult,
  Fixture,
  TournamentFormat,
  GroupStageConfig,
  MatchClockConfig,
} from '../src/types/tournament';
import {
  generateTournamentFixturesByFormat,
  INITIAL_PLAYERS,
  DEFAULT_RESULTS,
} from '../src/data/tournamentData';
import {
  DEFAULT_GROUP_CONFIG,
  partitionPlayersIntoGroups,
  generateGroupStageFixtures as genGroupStageFixtures,
  generateKnockoutFixtures,
  generateDirectKnockoutFixtures,
  filterRealMatchesOnly,
} from '../src/utils/groupStage';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'tournament.json');
const TOURNAMENT_DOC_PATH = 'live';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const fbApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(
  fbApp,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export interface ServerTournamentState {
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
}

function getFixtureResultKey(r: MatchResult): string {
  const pair = [
    (r.home_user || '').trim().toLowerCase(),
    (r.away_user || '').trim().toLowerCase(),
  ]
    .sort()
    .join('::');
  if (r.isKnockout) {
    return `ko::${r.stage || r.matchday}::${pair}`;
  }
  return `md${r.matchday}::${pair}`;
}

export function mergeTournamentResultsSafely(
  primary: MatchResult[],
  secondary: MatchResult[],
  options?: {
    deletedIds?: string[];
    resultsResetAt?: string;
  }
): MatchResult[] {
  const deletedSet = new Set(options?.deletedIds || []);
  const resetCutoff = options?.resultsResetAt
    ? Date.parse(options.resultsResetAt) || 0
    : 0;

  const isEligible = (r: MatchResult): boolean => {
    if (!r || !r.id) return false;
    if (deletedSet.has(r.id)) return false;
    if (resetCutoff > 0) {
      const subMs = r.submitted_at ? Date.parse(r.submitted_at) || 0 : 0;
      if (subMs > 0 && subMs <= resetCutoff) return false;
    }
    return true;
  };

  const byKey = new Map<string, MatchResult>();

  for (const r of primary) {
    if (!isEligible(r)) continue;
    byKey.set(getFixtureResultKey(r), r);
  }

  for (const r of secondary) {
    if (!isEligible(r)) continue;
    const key = getFixtureResultKey(r);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, r);
      continue;
    }

    // Never allow a bot-auto-recorded screenshot result to replace a manual website result
    const existingIsManual = !existing.id.startsWith('res-tg-');
    const incomingIsManual = !r.id.startsWith('res-tg-');
    if (incomingIsManual && !existingIsManual) {
      byKey.set(key, r);
    } else if (incomingIsManual === existingIsManual) {
      const exTime = existing.submitted_at ? Date.parse(existing.submitted_at) || 0 : 0;
      const inTime = r.submitted_at ? Date.parse(r.submitted_at) || 0 : 0;
      if (inTime > exTime) {
        byKey.set(key, r);
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const tA = a.submitted_at ? Date.parse(a.submitted_at) || 0 : 0;
    const tB = b.submitted_at ? Date.parse(b.submitted_at) || 0 : 0;
    return tB - tA;
  });
}

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

export function loadLocalTournamentFile(): ServerTournamentState | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players)) {
        return parsed as ServerTournamentState;
      }
    }
  } catch (err) {
    console.warn('Could not read local tournament.json:', err);
  }
  return null;
}

export function saveLocalTournamentFile(state: ServerTournamentState): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Could not write local tournament.json:', err);
    return false;
  }
}

export async function readLiveTournamentState(): Promise<ServerTournamentState> {
  const local = loadLocalTournamentFile();

  try {
    const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const remote = snap.data() as ServerTournamentState;
      if (remote && Array.isArray(remote.players)) {
        const localTime = local?.updatedAt ? Date.parse(local.updatedAt) : 0;
        const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;

        if (!local) {
          saveLocalTournamentFile(remote);
          return remote;
        }

        const mergedDeletedIds = Array.from(
          new Set([
            ...(local.deletedResultIds || []),
            ...(remote.deletedResultIds || []),
          ])
        ).slice(-100);

        const localResetMs = local.resultsResetAt
          ? Date.parse(local.resultsResetAt) || 0
          : 0;
        const remoteResetMs = remote.resultsResetAt
          ? Date.parse(remote.resultsResetAt) || 0
          : 0;
        const latestResetIso =
          localResetMs >= remoteResetMs
            ? local.resultsResetAt
            : remote.resultsResetAt;

        const base = localTime > remoteTime ? local : remote;
        const other = localTime > remoteTime ? remote : local;

        const mergedResults = mergeTournamentResultsSafely(
          base.results || [],
          other.results || [],
          {
            deletedIds: mergedDeletedIds,
            resultsResetAt: latestResetIso,
          }
        );

        const reconciled: ServerTournamentState = {
          ...base,
          results: mergedResults,
          ...(mergedDeletedIds.length > 0
            ? { deletedResultIds: mergedDeletedIds }
            : {}),
          ...(latestResetIso ? { resultsResetAt: latestResetIso } : {}),
        };

        saveLocalTournamentFile(reconciled);
        return reconciled;
      }
    }
  } catch (err) {
    console.warn('Firestore read fallback to local tournament.json:', err);
  }

  if (local) return local;

  return {
    players: INITIAL_PLAYERS,
    results: DEFAULT_RESULTS,
    tournamentFormat: 'knockout',
    groupStageConfig: DEFAULT_GROUP_CONFIG,
    isRegistrationEnded: false,
  };
}

export async function writeLiveTournamentState(
  state: ServerTournamentState
): Promise<boolean> {
  const payload = sanitizeForFirestore({
    ...state,
    updatedAt: new Date().toISOString(),
  });

  saveLocalTournamentFile(payload);

  try {
    const docRef = doc(db, 'tournament', TOURNAMENT_DOC_PATH);
    await setDoc(docRef, payload);
    return true;
  } catch (err) {
    console.error('Failed writing tournament state to Firestore:', err);
    return false;
  }
}

export function computeServerFixtures(state: ServerTournamentState): Fixture[] {
  const players = state.players || [];
  const results = state.results || [];
  const format = state.tournamentFormat || 'knockout';
  const config = state.groupStageConfig || DEFAULT_GROUP_CONFIG;

  if (
    format === 'knockout' ||
    format === 'group_knockout' ||
    format === 'knockout_cup'
  ) {
    const { knockoutFixtures } = generateDirectKnockoutFixtures(players, results);
    return filterRealMatchesOnly(knockoutFixtures);
  }

  if (format === 'group_stage') {
    const { groups } = partitionPlayersIntoGroups(players, config, results);
    const groupFixtures = genGroupStageFixtures(groups);
    const { knockoutFixtures } = generateKnockoutFixtures(
      groups,
      results,
      config
    );
    return filterRealMatchesOnly([...groupFixtures, ...knockoutFixtures]);
  }

  const playerNames = players.map((p) => p.user);
  return generateTournamentFixturesByFormat(playerNames, format);
}

export function findResultForFixture(
  fixture: Fixture,
  results: MatchResult[]
): MatchResult | undefined {
  return results.find((r) => {
    if (r.isPostponed) return false;
    const samePair =
      (r.home_user.toLowerCase() === fixture.home.toLowerCase() &&
        r.away_user.toLowerCase() === fixture.away.toLowerCase()) ||
      (r.home_user.toLowerCase() === fixture.away.toLowerCase() &&
        r.away_user.toLowerCase() === fixture.home.toLowerCase());
    if (!samePair) return false;

    if (fixture.isKnockout) {
      return Boolean(r.isKnockout) || r.matchday === fixture.matchday;
    }
    return r.matchday === fixture.matchday;
  });
}
