/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  INITIAL_PLAYERS,
  generateTournamentFixtures,
  generateTournamentFixturesByFormat,
  DEFAULT_RESULTS,
  ADMIN_PASSCODE,
} from './data/tournamentData';
import { Player, MatchResult, Fixture, TournamentFormat, GroupStageConfig, MatchClockConfig } from './types/tournament';
import { calculateStandings } from './utils/standings';
import { getDefaultClockConfig, normalizeClockConfig } from './utils/countryClock';
import {
  partitionPlayersIntoGroups,
  generateGroupStageFixtures as genGroupStageFixtures,
  generateKnockoutFixtures,
  generateDirectKnockoutFixtures,
  calculateGroupStandings,
  DEFAULT_GROUP_CONFIG,
  filterRealMatchesOnly,
} from './utils/groupStage';
import { buildSymmetricalBracket } from './utils/bracketEngine';

import { Navbar, SectionId } from './components/Navbar';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { FixturesSection } from './components/FixturesSection';
import { RegisteredPlayersSection } from './components/RegisteredPlayersSection';
import { LeagueTable } from './components/LeagueTable';
import { GoldenBoot } from './components/GoldenBoot';
import { RulesSection } from './components/RulesSection';
import { BracketPage } from './components/BracketPage';
import { Footer } from './components/Footer';
import { AdminModal } from './components/AdminModal';
import { PlayerModal } from './components/PlayerModal';
import { PlayerEditModal } from './components/PlayerEditModal';
import { AdminPage } from './components/AdminPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import {
  subscribeTournamentData,
  saveTournamentDataToFirestore,
  pushSnapshotToFirestoreOnly,
  getTournamentDataOnce,
  STORAGE_KEY_UPDATED_AT,
  STORAGE_KEY_PENDING_CLOUD_SYNC,
  hasPendingCloudSyncStored,
} from './services/tournamentSync';
import {
  auth,
  getUserProfile,
  completeGoogleRedirectSignIn,
  AppUserProfile,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfileModal } from './components/UserProfileModal';

const STORAGE_KEY_PLAYERS = 'efootball_tournament_players_v3';
const STORAGE_KEY_RESULTS = 'efootball_tournament_results_v3';
const STORAGE_KEY_PASSCODE = 'efootball_admin_passcode_v3';
const STORAGE_KEY_FORMAT = 'efootball_tournament_format_v3';
const STORAGE_KEY_GROUP_CONFIG = 'efootball_group_config_v3';
const STORAGE_KEY_MATCH_CLOCK = 'efootball_match_clock_config_v1';
const STORAGE_KEY_REGISTRATION_ENDED = 'efootball_registration_ended_v1';
const STORAGE_KEY_DELETED_IDS = 'efootball_deleted_result_ids_v1';
const STORAGE_KEY_RESET_AT = 'efootball_results_reset_at_v1';

export default function App() {
  // Active navigation section: tracks current section on page
  const [activeSection, setActiveSection] = useState<SectionId>('hub');

  // Tournament format state: 'knockout' | 'league_single' | 'league_double'
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FORMAT);
      if (
        saved === 'knockout' ||
        saved === 'group_knockout' ||
        saved === 'group_stage' ||
        saved === 'league_single' ||
        saved === 'league_double'
      ) {
        return (saved === 'group_stage' || saved === 'group_knockout' ? 'knockout' : saved) as TournamentFormat;
      }
    } catch (e) {}
    return 'knockout';
  });

  // Group stage configuration
  const [groupStageConfig, setGroupStageConfig] = useState<GroupStageConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GROUP_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_GROUP_CONFIG;
  });

  // Admin authentication state: NEVER stored in localStorage!
  // Always asks password when quitting/reopening, refreshing, or navigating away.
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Admin passcode state (can be changed via 2-step verification)
  const [adminPasscode, setAdminPasscode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PASSCODE);
      if (saved) return saved;
    } catch (e) {}
    return ADMIN_PASSCODE;
  });
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Players state (customizable before matches begin)
  const [basePlayers, setBasePlayers] = useState<Player[]>(() => {
    const teamMap: Record<string, string> = {
      BIL: 'Bilal FC',
      AMN: 'Aman United',
      MAMD: 'Madridistas',
      TFK: 'Teshale Kings',
      ISC: 'Isaac Stars',
      MBK: 'Muby All-Stars',
      YONS: 'Yonas Warriors',
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYERS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((p) => ({
            ...p,
            team: teamMap[p.team] || p.team,
            subtitle: '',
          }));
        }
      }
    } catch (e) {
      console.error('Failed to parse saved tournament players', e);
    }
    return INITIAL_PLAYERS;
  });

  // Results state
  const [results, setResults] = useState<MatchResult[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESULTS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved tournament results', e);
    }
    return DEFAULT_RESULTS;
  });

  // Modals state
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);
  const [isPlayerEditModalOpen, setIsPlayerEditModalOpen] = useState(false);

  const [activeFixtureToEdit, setActiveFixtureToEdit] = useState<{
    fixture: Fixture;
    existingResult?: MatchResult;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Google Firebase Auth user profile & cloud sync state
  const [currentUser, setCurrentUser] = useState<AppUserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [hasPendingCloudSync, setHasPendingCloudSync] = useState<boolean>(() =>
    hasPendingCloudSyncStored()
  );

  // Listen to Firebase Auth state and load user profile from Firestore
  useEffect(() => {
    completeGoogleRedirectSignIn();
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await getUserProfile(fbUser.uid);
        setCurrentUser(
          profile || {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            favoriteTeam: '',
            lastLoginAt: new Date().toISOString(),
          }
        );
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Registration state: Admin can explicitly end or reopen registration
  const [isRegistrationEnded, setIsRegistrationEnded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REGISTRATION_ENDED);
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return false;
  });

  // Registration rule: Registration is strictly open BEFORE matches have started AND before admin manually ended it
  const isRegistrationOpen = !isRegistrationEnded && results.length === 0;

  // Country Clock & Match Schedule Dual-Phase Countdown state
  const [matchClockConfig, setMatchClockConfig] = useState<MatchClockConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATCH_CLOCK);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return normalizeClockConfig(parsed);
      }
    } catch {}
    return getDefaultClockConfig();
  });

  const authWarningShownRef = useRef(false);

  // Sync to Firestore & server so all devices worldwide see the exact same data and profile pictures
  const syncToServer = useCallback(
    async (
      playersToSync: Player[],
      resultsToSync: MatchResult[],
      passcode?: string,
      formatToSync?: TournamentFormat,
      configToSync?: GroupStageConfig,
      clockConfigToSync?: MatchClockConfig,
      isRegistrationEndedToSync?: boolean,
      mutationTimestampMs?: number
    ) => {
      const updatedAtIso = mutationTimestampMs
        ? new Date(mutationTimestampMs).toISOString()
        : new Date().toISOString();
      const deletedIdsArr = Array.from(deletedResultIdsRef.current);
      const resetAtIso =
        lastResultsResetAtRef.current > 0
          ? new Date(lastResultsResetAtRef.current).toISOString()
          : undefined;

      const res = await saveTournamentDataToFirestore({
        players: playersToSync,
        results: resultsToSync,
        adminPasscode: passcode || adminPasscode,
        tournamentFormat: formatToSync || tournamentFormat,
        groupStageConfig: configToSync || groupStageConfig,
        clockConfig: clockConfigToSync !== undefined ? clockConfigToSync : matchClockConfig,
        isRegistrationEnded:
          isRegistrationEndedToSync !== undefined ? isRegistrationEndedToSync : isRegistrationEnded,
        deletedResultIds: deletedIdsArr,
        resultsResetAt: resetAtIso,
        updatedAt: updatedAtIso,
      });

      if (res.firestoreOk) {
        setHasPendingCloudSync(false);
      } else {
        setHasPendingCloudSync(true);
        if (res.reason === 'auth_required' && !authWarningShownRef.current) {
          authWarningShownRef.current = true;
          const id = `${Date.now()}-${Math.random()}`;
          setToasts((prev) => [
            ...prev,
            {
              id,
              text: 'Saved on this device only! Sign in with Google (top right) so everyone opening your website link sees the results.',
              type: 'info',
            },
          ]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 6000);
        } else if (res.reason === 'payload_too_large' || res.reason === 'permission_denied' || res.reason === 'error') {
          const id = `${Date.now()}-${Math.random()}`;
          setToasts((prev) => [
            ...prev,
            {
              id,
              text: res.errorMessage || 'Saved locally, but Firebase cloud sync failed. Check your connection or Google Sign-In.',
              type: 'error',
            },
          ]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 5500);
        }
      }
      return res;
    },
    [adminPasscode, tournamentFormat, groupStageConfig, matchClockConfig, isRegistrationEnded]
  );

  const hasFirestoreDataRef = useRef(false);
  const latestRemoteTimestampRef = useRef<number>(0);
  const latestFirestoreTimestampRef = useRef<number>(0);
  const latestServerPayloadRef = useRef<any>(null);
  const lastBridgedServerTimeRef = useRef<number>(0);
  const isBridgingToFirestoreRef = useRef<boolean>(false);
  const lastManualMutationRef = useRef<number>((() => {
    try {
      const savedTs = localStorage.getItem(STORAGE_KEY_UPDATED_AT);
      const parsed = savedTs ? Date.parse(savedTs) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  })());
  const deletedResultIdsRef = useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed.filter((x) => typeof x === 'string'));
      }
    } catch {}
    return new Set<string>();
  })());
  const lastResultsResetAtRef = useRef<number>((() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESET_AT);
      const parsed = saved ? Date.parse(saved) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  })());

  const persistLocalMutationMeta = useCallback((tsMs: number) => {
    lastManualMutationRef.current = tsMs;
    try {
      localStorage.setItem(STORAGE_KEY_UPDATED_AT, new Date(tsMs).toISOString());
      localStorage.setItem(STORAGE_KEY_PENDING_CLOUD_SYNC, 'true');
      localStorage.setItem(
        STORAGE_KEY_DELETED_IDS,
        JSON.stringify(Array.from(deletedResultIdsRef.current).slice(-100))
      );
      if (lastResultsResetAtRef.current > 0) {
        localStorage.setItem(
          STORAGE_KEY_RESET_AT,
          new Date(lastResultsResetAtRef.current).toISOString()
        );
      }
    } catch {}
  }, []);

  const getFixturePairKeyClient = useCallback((r: MatchResult): string => {
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
  }, []);

  const mergeManualAndIncomingResults = useCallback(
    (
      currentResults: MatchResult[],
      incomingResults: MatchResult[],
      options?: { onlyNewBotResults?: boolean; botCutoffMs?: number }
    ): MatchResult[] => {
      const deletedSet = deletedResultIdsRef.current;
      const resetCutoff = lastResultsResetAtRef.current;
      const byKey = new Map<string, MatchResult>();

      for (const r of currentResults) {
        if (!r || !r.id || deletedSet.has(r.id)) continue;
        byKey.set(getFixturePairKeyClient(r), r);
      }

      for (const r of incomingResults) {
        if (!r || !r.id || deletedSet.has(r.id)) continue;
        const subMs = r.submitted_at ? Date.parse(r.submitted_at) || 0 : 0;
        if (resetCutoff > 0 && subMs > 0 && subMs <= resetCutoff) continue;

        if (options?.onlyNewBotResults) {
          if (!r.id.startsWith('res-tg-')) continue;
          if (options.botCutoffMs && subMs > 0 && subMs <= options.botCutoffMs) {
            continue;
          }
        }

        const key = getFixturePairKeyClient(r);
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, r);
          continue;
        }

        // Manual website entries must NEVER be overwritten by Telegram bot entries
        const existingIsManual = !existing.id.startsWith('res-tg-');
        const incomingIsManual = !r.id.startsWith('res-tg-');
        if (incomingIsManual && !existingIsManual) {
          byKey.set(key, r);
        } else if (incomingIsManual === existingIsManual) {
          const exTime = existing.submitted_at
            ? Date.parse(existing.submitted_at) || 0
            : 0;
          if (subMs > exTime) {
            byKey.set(key, r);
          }
        }
      }

      return Array.from(byKey.values()).sort((a, b) => {
        const tA = a.submitted_at ? Date.parse(a.submitted_at) || 0 : 0;
        const tB = b.submitted_at ? Date.parse(b.submitted_at) || 0 : 0;
        return tB - tA;
      });
    },
    [getFixturePairKeyClient]
  );

  const buildLocalSnapshotPayload = useCallback(() => {
    try {
      const rawPlayers = localStorage.getItem(STORAGE_KEY_PLAYERS);
      const rawResults = localStorage.getItem(STORAGE_KEY_RESULTS);
      const rawUpdatedAt = localStorage.getItem(STORAGE_KEY_UPDATED_AT);
      const parsedPlayers = rawPlayers ? JSON.parse(rawPlayers) : basePlayers;
      const parsedResults = rawResults ? JSON.parse(rawResults) : results;
      return {
        players: Array.isArray(parsedPlayers) ? parsedPlayers : basePlayers,
        results: Array.isArray(parsedResults) ? parsedResults : results,
        adminPasscode,
        tournamentFormat,
        groupStageConfig,
        clockConfig: matchClockConfig,
        isRegistrationEnded,
        deletedResultIds: Array.from(deletedResultIdsRef.current),
        ...(lastResultsResetAtRef.current > 0
          ? { resultsResetAt: new Date(lastResultsResetAtRef.current).toISOString() }
          : {}),
        updatedAt: rawUpdatedAt || new Date().toISOString(),
      };
    } catch {
      return {
        players: basePlayers,
        results,
        adminPasscode,
        tournamentFormat,
        groupStageConfig,
        clockConfig: matchClockConfig,
        isRegistrationEnded,
        updatedAt: new Date().toISOString(),
      };
    }
  }, [
    basePlayers,
    results,
    adminPasscode,
    tournamentFormat,
    groupStageConfig,
    matchClockConfig,
    isRegistrationEnded,
  ]);

  const tryBridgeServerToFirestore = useCallback(async () => {
    if (!auth.currentUser || isBridgingToFirestoreRef.current) return;

    const serverData = latestServerPayloadRef.current;
    const serverTime = serverData?.updatedAt ? Date.parse(serverData.updatedAt) || 0 : 0;
    const localTime = lastManualMutationRef.current;
    let hasPendingLocalSync = false;
    try {
      hasPendingLocalSync = localStorage.getItem(STORAGE_KEY_PENDING_CLOUD_SYNC) === 'true';
    } catch {}

    // Pick whichever source (local device vs Express server) is newer than Firestore
    const candidateSource =
      (hasPendingLocalSync || localTime >= serverTime) && localTime > 0
        ? buildLocalSnapshotPayload()
        : serverData;
    const candidateTime = candidateSource?.updatedAt
      ? Date.parse(candidateSource.updatedAt) || 0
      : 0;

    if (
      candidateSource &&
      Array.isArray(candidateSource.players) &&
      candidateTime > 0 &&
      candidateTime > latestFirestoreTimestampRef.current &&
      candidateTime > lastBridgedServerTimeRef.current
    ) {
      isBridgingToFirestoreRef.current = true;
      try {
        const remoteDoc = await getTournamentDataOnce();
        const remoteTime = remoteDoc?.updatedAt ? Date.parse(remoteDoc.updatedAt) || 0 : 0;
        if (remoteTime >= candidateTime) {
          latestFirestoreTimestampRef.current = remoteTime;
          return;
        }

        if (Array.isArray(candidateSource.deletedResultIds)) {
          candidateSource.deletedResultIds.forEach((id: string) =>
            deletedResultIdsRef.current.add(id)
          );
        }
        if (candidateSource.resultsResetAt) {
          const srvResetMs = Date.parse(candidateSource.resultsResetAt) || 0;
          if (srvResetMs > lastResultsResetAtRef.current) {
            lastResultsResetAtRef.current = srvResetMs;
          }
        }

        const mergedResults = remoteDoc?.results
          ? mergeManualAndIncomingResults(
              candidateSource.results || [],
              remoteDoc.results
            )
          : Array.isArray(candidateSource.results)
          ? candidateSource.results
          : [];

        const payloadToPush = {
          ...candidateSource,
          results: mergedResults,
        };

        const ok = await pushSnapshotToFirestoreOnly(payloadToPush);
        if (ok) {
          lastBridgedServerTimeRef.current = candidateTime;
          latestFirestoreTimestampRef.current = candidateTime;
          setHasPendingCloudSync(false);
        }
      } finally {
        isBridgingToFirestoreRef.current = false;
      }
    }
  }, [buildLocalSnapshotPayload, mergeManualAndIncomingResults]);

  // Real-time synchronization via Firebase Firestore + Server API
  useEffect(() => {
    let isMounted = true;

    const applyRemoteState = (data: any, source: 'firestore' | 'server') => {
      if (!isMounted || !data) return;
      const incomingTime = data.updatedAt ? Date.parse(data.updatedAt) || 0 : 0;

      if (source === 'firestore') {
        hasFirestoreDataRef.current = true;
        if (incomingTime > latestFirestoreTimestampRef.current) {
          latestFirestoreTimestampRef.current = incomingTime;
        }
        // Detect if local device/server has results that have NOT yet been published to Firestore
        const remoteResultsLen = Array.isArray(data.results) ? data.results.length : 0;
        const serverResultsLen = Array.isArray(latestServerPayloadRef.current?.results)
          ? latestServerPayloadRef.current.results.length
          : 0;
        const serverUpdatedMs = latestServerPayloadRef.current?.updatedAt
          ? Date.parse(latestServerPayloadRef.current.updatedAt) || 0
          : 0;
        if (
          (lastManualMutationRef.current > incomingTime && hasPendingCloudSyncStored()) ||
          (serverUpdatedMs > incomingTime && serverResultsLen > remoteResultsLen)
        ) {
          setHasPendingCloudSync(true);
        }
      }

      // Never allow stale Firestore/server snapshots older than this browser's last saved edit
      // (even after a full page refresh) to erase newly recorded match results!
      const hasPendingLocalSync = hasPendingCloudSyncStored();

      if (lastManualMutationRef.current > 0) {
        if (incomingTime === 0 || incomingTime < lastManualMutationRef.current) {
          return;
        }
        if (hasPendingLocalSync && incomingTime <= lastManualMutationRef.current) {
          return;
        }
      }

      if (incomingTime > 0 && incomingTime < latestRemoteTimestampRef.current) {
        return;
      }
      if (incomingTime > 0) {
        latestRemoteTimestampRef.current = incomingTime;
      }

      if (Array.isArray(data.deletedResultIds)) {
        data.deletedResultIds.forEach((id: string) => deletedResultIdsRef.current.add(id));
        try {
          localStorage.setItem(
            STORAGE_KEY_DELETED_IDS,
            JSON.stringify(Array.from(deletedResultIdsRef.current).slice(-100))
          );
        } catch {}
      }
      if (data.resultsResetAt) {
        const resetMs = Date.parse(data.resultsResetAt) || 0;
        if (resetMs > lastResultsResetAtRef.current) {
          lastResultsResetAtRef.current = resetMs;
          try {
            localStorage.setItem(STORAGE_KEY_RESET_AT, data.resultsResetAt);
          } catch {}
        }
      }

      if (data.players && Array.isArray(data.players)) {
        setBasePlayers(data.players);
        try {
          localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(data.players));
        } catch {}
      }
      if (data.results && Array.isArray(data.results)) {
        const safeResults = data.results.filter((r: MatchResult) => {
          if (!r || !r.id || deletedResultIdsRef.current.has(r.id)) return false;
          if (lastResultsResetAtRef.current > 0 && r.submitted_at) {
            const subMs = Date.parse(r.submitted_at) || 0;
            if (subMs > 0 && subMs <= lastResultsResetAtRef.current) return false;
          }
          return true;
        });
        setResults(safeResults);
        try {
          localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(safeResults));
        } catch {}
      }
      if (data.adminPasscode) {
        setAdminPasscode(data.adminPasscode);
        try {
          localStorage.setItem(STORAGE_KEY_PASSCODE, data.adminPasscode);
        } catch {}
      }
      if (data.tournamentFormat) {
        const sanitizedFormat: TournamentFormat =
          data.tournamentFormat === 'league_single' || data.tournamentFormat === 'league_double'
            ? data.tournamentFormat
            : 'knockout';
        setTournamentFormat(sanitizedFormat);
        try {
          localStorage.setItem(STORAGE_KEY_FORMAT, sanitizedFormat);
        } catch {}
      }
      if (data.groupStageConfig) {
        setGroupStageConfig(data.groupStageConfig);
        try {
          localStorage.setItem(STORAGE_KEY_GROUP_CONFIG, JSON.stringify(data.groupStageConfig));
        } catch {}
      }
      if (data.clockConfig) {
        const normalizedClock = normalizeClockConfig(data.clockConfig);
        setMatchClockConfig(normalizedClock);
        setShowCountdown(normalizedClock.enabled);
        setCountdownTargetDate(normalizedClock.startDate);
        try {
          localStorage.setItem(STORAGE_KEY_MATCH_CLOCK, JSON.stringify(normalizedClock));
          localStorage.setItem('efootball_show_countdown', String(normalizedClock.enabled));
          localStorage.setItem('efootball_countdown_target_date', normalizedClock.startDate);
        } catch {}
      }
      if (typeof data.isRegistrationEnded === 'boolean') {
        setIsRegistrationEnded(data.isRegistrationEnded);
        try {
          localStorage.setItem(STORAGE_KEY_REGISTRATION_ENDED, String(data.isRegistrationEnded));
        } catch {}
      }
      if (data.updatedAt) {
        try {
          localStorage.setItem(STORAGE_KEY_UPDATED_AT, data.updatedAt);
          if (source === 'firestore') {
            localStorage.removeItem(STORAGE_KEY_PENDING_CLOUD_SYNC);
            setHasPendingCloudSync(false);
          }
        } catch {}
      }
    };

    // 1. Subscribe to live Firestore updates across all devices
    const unsubscribe = subscribeTournamentData((data) => {
      applyRemoteState(data, 'firestore');
    });

    // 2. Check /api/tournament when running with Express backend
    const fetchServerBackup = () => {
      fetch('/api/tournament')
        .then((res) => {
          if (!res.ok) throw new Error('Server backup unavailable');
          return res.json();
        })
        .then((json) => {
          if (!isMounted || !json.success || !json.data) return;
          latestServerPayloadRef.current = json.data;
          const serverTime = json.data.updatedAt ? Date.parse(json.data.updatedAt) || 0 : 0;
          if (serverTime < lastManualMutationRef.current) return;
          if (!hasFirestoreDataRef.current || serverTime > latestRemoteTimestampRef.current) {
            applyRemoteState(json.data, 'server');
          }
          if (auth.currentUser && serverTime > latestFirestoreTimestampRef.current) {
            tryBridgeServerToFirestore();
          }
        })
        .catch(() => {});
    };

    fetchServerBackup();
    const serverPoll = setInterval(fetchServerBackup, 10_000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(serverPoll);
    };
  }, [tryBridgeServerToFirestore]);

  // As soon as a Google user signs in, push any newer local/server snapshot to Firestore
  useEffect(() => {
    if (currentUser?.uid) {
      authWarningShownRef.current = false;
      tryBridgeServerToFirestore();
    }
  }, [currentUser?.uid, tryBridgeServerToFirestore]);

  // Toast notification helper
  const addToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Automatically generate fixtures whenever player list or tournament format changes
  const tournamentFixtures = useMemo(() => {
    if (tournamentFormat === 'knockout' || tournamentFormat === 'group_knockout' || tournamentFormat === 'knockout_cup') {
      const { knockoutFixtures } = generateDirectKnockoutFixtures(basePlayers, results);
      return filterRealMatchesOnly(knockoutFixtures);
    }
    if (tournamentFormat === 'group_stage') {
      const { groups } = partitionPlayersIntoGroups(basePlayers, groupStageConfig, results);
      const groupFixtures = genGroupStageFixtures(groups);
      const { knockoutFixtures } = generateKnockoutFixtures(groups, results, groupStageConfig);
      return filterRealMatchesOnly([...groupFixtures, ...knockoutFixtures]);
    }
    const playerNames = basePlayers.map((p) => p.user);
    return generateTournamentFixturesByFormat(playerNames, tournamentFormat);
  }, [basePlayers, tournamentFormat, groupStageConfig, results]);

  // Handler to generate matches automatically for chosen format
  const handleGenerateMatches = useCallback(
    (newFormat: TournamentFormat) => {
      const now = Date.now();
      persistLocalMutationMeta(now);
      setTournamentFormat(newFormat);
      try {
        localStorage.setItem(STORAGE_KEY_FORMAT, newFormat);
      } catch (e) {}

      syncToServer(
        basePlayers,
        results,
        adminPasscode,
        newFormat,
        groupStageConfig,
        matchClockConfig,
        isRegistrationEnded,
        now
      );

      const formatName =
        newFormat === 'knockout' || newFormat === 'group_knockout' || newFormat === 'group_stage' || newFormat === 'knockout_cup'
          ? 'Knockout'
          : newFormat === 'league_single'
          ? 'Single Leg League'
          : 'Double Leg League (Home & Away)';

      addToast(`⚡ Play style switched to ${formatName}!`, 'success');
    },
    [basePlayers, results, adminPasscode, groupStageConfig, matchClockConfig, isRegistrationEnded, addToast, persistLocalMutationMeta, syncToServer]
  );

  const handleUpdateGroupConfig = useCallback(
    (newConfig: GroupStageConfig) => {
      const now = Date.now();
      persistLocalMutationMeta(now);
      setGroupStageConfig(newConfig);
      try {
        localStorage.setItem(STORAGE_KEY_GROUP_CONFIG, JSON.stringify(newConfig));
      } catch (e) {}
      syncToServer(
        basePlayers,
        results,
        adminPasscode,
        tournamentFormat,
        newConfig,
        matchClockConfig,
        isRegistrationEnded,
        now
      );
      addToast('Group stage settings updated!', 'success');
    },
    [basePlayers, results, adminPasscode, tournamentFormat, matchClockConfig, isRegistrationEnded, addToast, persistLocalMutationMeta, syncToServer]
  );

  const totalMatchdays = useMemo(() => {
    return tournamentFixtures.length > 0
      ? Math.max(...tournamentFixtures.map((f) => f.matchday))
      : 14;
  }, [tournamentFixtures]);

  // Recalculate standings dynamically
  const calculatedPlayers = useMemo(() => {
    if (tournamentFormat === 'knockout' || tournamentFormat === 'group_knockout' || tournamentFormat === 'knockout_cup') {
      const bracket = buildSymmetricalBracket(basePlayers, results, 'knockout');
      const baseStandings = calculateStandings(basePlayers, results);
      const champUser = bracket.champion?.user;
      const finalTie = bracket.finalTie;
      const runnerUpUser = finalTie && finalTie.isCompleted ? finalTie.loserUser : null;
      const thirdTie = bracket.thirdPlaceTie;
      const thirdUser = thirdTie && thirdTie.isCompleted ? thirdTie.winnerUser : null;
      const fourthUser = thirdTie && thirdTie.isCompleted ? thirdTie.loserUser : null;

      return baseStandings
        .map((p) => {
          let rank = p.rank;
          let qualificationStatus: Player['qualificationStatus'] = undefined;
          if (p.user === champUser) {
            rank = 1;
            qualificationStatus = 'qualified';
          } else if (p.user === runnerUpUser) {
            rank = 2;
            qualificationStatus = 'qualified';
          } else if (p.user === thirdUser) {
            rank = 3;
            qualificationStatus = 'qualified';
          } else if (p.user === fourthUser) {
            rank = 4;
            qualificationStatus = 'eliminated';
          }
          return { ...p, rank, qualificationStatus };
        })
        .sort((a, b) => a.rank - b.rank);
    }
    if (tournamentFormat === 'group_stage') {
      const { groups, groupLetters } = partitionPlayersIntoGroups(basePlayers, groupStageConfig, results);
      const enriched: Player[] = [];
      groupLetters.forEach((letter) => {
        const members = groups[letter] || [];
        const calc = calculateGroupStandings(
          members,
          results,
          groupStageConfig.qualifiersPerGroup,
          groupStageConfig.manualTieBreakers?.[letter]
        );
        enriched.push(...calc.standings);
      });
      return enriched;
    }
    return calculateStandings(basePlayers, results);
  }, [basePlayers, results, tournamentFormat, groupStageConfig]);

  // Gracefully synchronize activeSection if tournament format changes so the light line remains visible
  useEffect(() => {
    if (activeSection === 'admin') return;
    const isPureKnockout =
      tournamentFormat === 'knockout' || tournamentFormat === 'knockout_cup';
    const hasKnockout =
      tournamentFormat === 'knockout' ||
      tournamentFormat === 'group_knockout' ||
      tournamentFormat === 'knockout_cup' ||
      tournamentFormat === 'group_stage';
    const hasTable = !isPureKnockout;

    if (activeSection === 'bracket' && !hasKnockout) {
      setActiveSection(hasTable ? 'table' : 'hub');
    } else if (activeSection === 'table' && !hasTable) {
      setActiveSection(hasKnockout ? 'bracket' : 'hub');
    }
  }, [tournamentFormat, activeSection]);

  // Scroll spy: Update active tab indicator dynamically based on current scroll position
  useEffect(() => {
    if (activeSection === 'admin') return;

    const isPureKnockout =
      tournamentFormat === 'knockout' || tournamentFormat === 'knockout_cup';
    const hasKnockout =
      tournamentFormat === 'knockout' ||
      tournamentFormat === 'group_knockout' ||
      tournamentFormat === 'knockout_cup' ||
      tournamentFormat === 'group_stage';
    const hasTable = !isPureKnockout;

    const sectionList: { id: SectionId; elementId: string }[] = isRegistrationOpen
      ? [
          { id: 'hub', elementId: 'challenge' },
          { id: 'players', elementId: 'registered-players' },
          { id: 'fixtures', elementId: 'fixtures' },
          ...(hasKnockout ? [{ id: 'bracket' as SectionId, elementId: 'bracket' }] : []),
          ...(hasTable ? [{ id: 'table' as SectionId, elementId: 'table' }] : []),
          { id: 'rules', elementId: 'rules' },
        ]
      : [
          { id: 'hub', elementId: 'challenge' },
          { id: 'fixtures', elementId: 'fixtures' },
          ...(hasKnockout ? [{ id: 'bracket' as SectionId, elementId: 'bracket' }] : []),
          ...(hasTable ? [{ id: 'table' as SectionId, elementId: 'table' }] : []),
          { id: 'players', elementId: 'registered-players' },
          { id: 'rules', elementId: 'rules' },
        ];

    const handleScroll = () => {
      // Check if user reached bottom of page
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        if (sectionList.length > 0) {
          setActiveSection(sectionList[sectionList.length - 1].id);
          return;
        }
      }

      for (let i = sectionList.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionList[i].elementId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 240) {
            setActiveSection(sectionList[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSection, tournamentFormat, isRegistrationOpen]);

  // Section navigation helper
  const handleNavigateSection = (section: SectionId) => {
    if (activeSection === 'admin' && section !== 'admin') {
      setIsAdmin(false); // auto-lock when clicking away from admin
    }
    setActiveSection(section);

    if (section === 'admin') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const elementMap: Record<SectionId, string> = {
      hub: 'challenge',
      fixtures: 'fixtures',
      bracket: 'bracket',
      table: 'table',
      admin: 'admin',
      rules: 'rules',
      players: 'registered-players',
    };

    setTimeout(() => {
      const targetEl = document.getElementById(elementMap[section]);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
  };

  // Toggle player registration open / ended
  const handleToggleRegistration = useCallback(
    (ended?: boolean) => {
      const nextVal = ended !== undefined ? ended : !isRegistrationEnded;
      if (!nextVal && results.length > 0) {
        addToast(
          'Cannot reopen registration because match results have already been recorded. Reset scores to reopen.',
          'error'
        );
        return;
      }

      const now = Date.now();
      persistLocalMutationMeta(now);
      setIsRegistrationEnded(nextVal);
      try {
        localStorage.setItem(STORAGE_KEY_REGISTRATION_ENDED, String(nextVal));
      } catch (e) {}

      syncToServer(
        basePlayers,
        results,
        adminPasscode,
        tournamentFormat,
        groupStageConfig,
        matchClockConfig,
        nextVal,
        now
      );

      addToast(
        nextVal
          ? 'Player registration ended! Upcoming matches, bracket, and schedule are now revealed on the home page.'
          : 'Player registration reopened! Upcoming matches are hidden until registration ends.',
        'info'
      );
    },
    [isRegistrationEnded, basePlayers, results, adminPasscode, tournamentFormat, groupStageConfig, matchClockConfig, addToast, persistLocalMutationMeta, syncToServer]
  );

  // Admin authentication handlers
  const handleAdminSuccess = () => {
    setIsAdmin(true);
    setIsAdminModalOpen(false);
    addToast('Owner verified desk unlocked! You can now manage registrations, profiles & scores.');
    handleNavigateSection('admin');
  };

  // Player Registration & Profile Edit handlers
  const handleOpenRegisterPlayer = () => {
    if (!isRegistrationOpen) {
      addToast(
        'Registration is closed because matches have already begun. Reset scores to register players.',
        'error'
      );
      return;
    }
    setPlayerToEdit(null);
    setIsPlayerEditModalOpen(true);
  };

  const handleOpenEditPlayer = (player: Player) => {
    setPlayerToEdit(player);
    setIsPlayerEditModalOpen(true);
  };

  const handleSavePlayer = (playerData: {
    id?: string;
    user: string;
    team: string;
    avatarUrl: string;
    phoneNumber?: string;
    telegramUsername?: string;
    clearOldMemberData?: boolean;
  }) => {
    let updatedPlayers: Player[];
    let updatedResults = [...results];
    let purgedMatchesCount = 0;

    if (playerData.id) {
      const oldPlayer = basePlayers.find((p) => p.id === playerData.id);
      const isMemberChanged =
        oldPlayer &&
        (oldPlayer.user !== playerData.user ||
          oldPlayer.team !== playerData.team ||
          playerData.clearOldMemberData);

      // If member identity changed or purge requested:
      // Remove all previous member match scores, results, and reset stats to free Firebase space
      if (isMemberChanged && oldPlayer) {
        const oldUser = oldPlayer.user;
        const initialCount = updatedResults.length;
        updatedResults = updatedResults.filter(
          (r) => r.home_user !== oldUser && r.away_user !== oldUser
        );
        purgedMatchesCount = initialCount - updatedResults.length;
      }

      updatedPlayers = basePlayers.map((p) =>
        p.id === playerData.id
          ? {
              ...p,
              user: playerData.user,
              team: playerData.team,
              avatarUrl: playerData.avatarUrl,
              phoneNumber: playerData.phoneNumber,
              telegramUsername: playerData.telegramUsername,
              ...(isMemberChanged
                ? {
                    points: 0,
                    played: 0,
                    w: 0,
                    d: 0,
                    l: 0,
                    gf: 0,
                    ga: 0,
                    gd: 0,
                  }
                : {}),
            }
          : p
      );

      if (purgedMatchesCount > 0) {
        addToast(
          `Member replaced! Purged ${purgedMatchesCount} old match score(s) from Firebase to free space.`
        );
      } else {
        addToast(`Player profile updated for ${playerData.user}!`);
      }
    } else {
      const newPlayer: Player = {
        id: `p-${Date.now()}`,
        user: playerData.user,
        team: playerData.team,
        avatarUrl: playerData.avatarUrl,
        phoneNumber: playerData.phoneNumber,
        telegramUsername: playerData.telegramUsername,
        registeredAt: new Date().toISOString(),
        points: 0,
        played: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        rank: basePlayers.length + 1,
      };
      updatedPlayers = [...basePlayers, newPlayer];
      addToast(`Player ${playerData.user} registered successfully!`);
    }

    // Always ensure no orphaned match scores exist for non-active members
    const activeUsers = new Set(updatedPlayers.map((p) => p.user));
    updatedResults = updatedResults.filter(
      (r) => activeUsers.has(r.home_user) && activeUsers.has(r.away_user)
    );

    const now = Date.now();
    persistLocalMutationMeta(now);
    setBasePlayers(updatedPlayers);
    setResults(updatedResults);

    try {
      localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(updatedPlayers));
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(updatedResults));
    } catch (e) {}

    // Synchronize to Firestore with clean overwrite so deleted/old member data is purged from Firebase
    syncToServer(updatedPlayers, updatedResults, undefined, undefined, undefined, undefined, undefined, now);
    setIsPlayerEditModalOpen(false);
    setPlayerToEdit(null);
  };

  const handleDeletePlayer = (playerId: string) => {
    if (!isRegistrationOpen) {
      addToast('Cannot remove player once tournament results have been recorded.', 'error');
      return;
    }
    const playerToDelete = basePlayers.find((p) => p.id === playerId);
    const remaining = basePlayers.filter((p) => p.id !== playerId);
    if (remaining.length < 2) {
      addToast('Tournament requires at least 2 active players.', 'error');
      return;
    }

    // Purge any match scores from the removed member to free space on Firebase
    let updatedResults = results;
    if (playerToDelete) {
      updatedResults = results.filter(
        (r) => r.home_user !== playerToDelete.user && r.away_user !== playerToDelete.user
      );
    }

    const now = Date.now();
    persistLocalMutationMeta(now);
    setBasePlayers(remaining);
    setResults(updatedResults);
    try {
      localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(remaining));
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(updatedResults));
    } catch (e) {}

    syncToServer(remaining, updatedResults, undefined, undefined, undefined, undefined, undefined, now);
    addToast(
      `Removed ${playerToDelete?.user || 'player'} and purged member data from Firebase.`,
      'info'
    );
    setIsPlayerEditModalOpen(false);
    setPlayerToEdit(null);
  };

  // Feature: Delete All Players in administration to save time and easily start fresh
  const handleDeleteAllPlayers = () => {
    const previousCount = basePlayers.length;
    const now = Date.now();
    lastResultsResetAtRef.current = now;
    persistLocalMutationMeta(now);
    setBasePlayers([]);
    setResults([]);
    setSelectedPlayer(null);
    setPlayerToEdit(null);
    setIsPlayerEditModalOpen(false);
    setActiveFixtureToEdit(null);

    try {
      localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify([]));
    } catch (e) {}

    syncToServer([], [], undefined, undefined, undefined, undefined, undefined, now);
    addToast(
      `Deleted all ${previousCount} players and cleared all tournament records! Matches will start soon.`,
      'info'
    );
  };

  // Dedicated action to purge any orphaned old member data and clean up Firebase database space
  const handlePurgeOldMemberData = () => {
    const activeUsers = new Set(basePlayers.map((p) => p.user.trim().toLowerCase()));
    const initialCount = results.length;
    const cleanedResults = results.filter((r) => {
      const homeActive = activeUsers.has(r.home_user.trim().toLowerCase());
      const awayActive = activeUsers.has(r.away_user.trim().toLowerCase());
      return homeActive && awayActive;
    });

    const removedCount = initialCount - cleanedResults.length;
    const now = Date.now();
    persistLocalMutationMeta(now);
    setResults(cleanedResults);
    try {
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(cleanedResults));
    } catch (e) {}

    syncToServer(basePlayers, cleanedResults, undefined, undefined, undefined, undefined, undefined, now);
    if (removedCount > 0) {
      addToast(
        `Purged ${removedCount} old member match record(s)! Firebase database space has been freed.`
      );
    } else {
      addToast(
        'Firebase database is already optimized and clean! No orphaned member data found.'
      );
    }
  };

  // Match Result recording handlers
  const handleSaveResult = async (
    resultData: Omit<MatchResult, 'id' | 'submitted_at'>,
    existingId?: string
  ) => {
    const now = Date.now();
    let updatedResults: MatchResult[];
    if (existingId) {
      deletedResultIdsRef.current.delete(existingId);
      updatedResults = results.map((r) => {
        if (r.id === existingId) {
          const updated: MatchResult = {
            ...r,
            ...resultData,
            submitted_at: new Date(now).toISOString(),
          };
          if (!resultData.isPostponed) {
            delete (updated as any).postponedReason;
            delete (updated as any).rescheduledMatchday;
          }
          return updated;
        }
        return r;
      });
    } else {
      const newResult: MatchResult = {
        id: `res-${now}-${Math.random().toString(36).substr(2, 4)}`,
        ...resultData,
        submitted_at: new Date(now).toISOString(),
      };
      if (!resultData.isPostponed) {
        delete (newResult as any).postponedReason;
        delete (newResult as any).rescheduledMatchday;
      }
      updatedResults = [newResult, ...results];
    }

    persistLocalMutationMeta(now);
    setHasPendingCloudSync(true);
    setResults(updatedResults);
    try {
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(updatedResults));
    } catch (e) {}

    const syncRes = await syncToServer(
      basePlayers,
      updatedResults,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      now
    );

    if (syncRes.firestoreOk) {
      addToast(
        existingId
          ? 'Match result updated & published live to all visitors!'
          : 'Match result saved & published live to all visitors!',
        'success'
      );
    } else if (syncRes.reason === 'auth_required') {
      addToast(
        'Match result saved on this phone ONLY. Click "Sign In with Google" in Record Match Score so people opening the link can see it!',
        'info'
      );
    }
  };

  const handlePublishCloudNow = async (): Promise<boolean> => {
    if (!auth.currentUser) {
      setIsAuthModalOpen(true);
      return false;
    }
    const now = Date.now();
    const res = await syncToServer(
      basePlayers,
      results,
      adminPasscode,
      tournamentFormat,
      groupStageConfig,
      matchClockConfig,
      isRegistrationEnded,
      now
    );
    if (res.firestoreOk) {
      persistLocalMutationMeta(now);
      try {
        localStorage.removeItem(STORAGE_KEY_PENDING_CLOUD_SYNC);
      } catch {}
      setHasPendingCloudSync(false);
      addToast('All match results & standings published live to Firebase for everyone!', 'success');
      return true;
    }
    return false;
  };

  const handleDeleteResult = (resultId: string) => {
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return;
    }
    const now = Date.now();
    deletedResultIdsRef.current.add(resultId);
    persistLocalMutationMeta(now);
    const updatedResults = results.filter((r) => r.id !== resultId);
    setResults(updatedResults);
    try {
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(updatedResults));
    } catch (e) {}
    syncToServer(basePlayers, updatedResults, undefined, undefined, undefined, undefined, undefined, now);
    addToast('Match result deleted.', 'info');
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all match results? This will re-open player registrations.')) {
      const now = Date.now();
      lastResultsResetAtRef.current = now;
      results.forEach((r) => deletedResultIdsRef.current.add(r.id));
      persistLocalMutationMeta(now);
      setResults([]);
      setIsRegistrationEnded(false);
      try {
        localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEY_REGISTRATION_ENDED, 'false');
      } catch (e) {}
      syncToServer(basePlayers, [], undefined, undefined, undefined, undefined, false, now);
      addToast('All match records reset! Registrations re-opened.');
    }
  };

  const handleExportData = () => {
    const payload = {
      players: basePlayers,
      results,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `efootball-tournament-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Tournament data downloaded as JSON backup.');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const now = Date.now();
        if (parsed.players && Array.isArray(parsed.players)) {
          setBasePlayers(parsed.players);
          try {
            localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(parsed.players));
          } catch (err) {}
        }
        if (parsed.results && Array.isArray(parsed.results)) {
          deletedResultIdsRef.current.clear();
          lastResultsResetAtRef.current = 0;
          try {
            localStorage.removeItem(STORAGE_KEY_RESET_AT);
          } catch {}
          setResults(parsed.results);
          try {
            localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(parsed.results));
          } catch (err) {}
        }
        persistLocalMutationMeta(now);
        syncToServer(
          parsed.players && Array.isArray(parsed.players) ? parsed.players : basePlayers,
          parsed.results && Array.isArray(parsed.results) ? parsed.results : results,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          now
        );
        addToast('Tournament backup restored successfully!');
      } catch (err) {
        addToast('Failed to import JSON file. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectFixtureToRecord = (fixture: Fixture, existingResult?: MatchResult) => {
    setActiveFixtureToEdit({ fixture, existingResult });
    handleNavigateSection('admin');
  };

  const handlePasswordChanged = (newPass: string) => {
    setAdminPasscode(newPass);
    try {
      localStorage.setItem(STORAGE_KEY_PASSCODE, newPass);
    } catch (e) {}
    addToast('Administrator password updated! Use your new password for all future logins.');
  };

  // Live countdown timer state (Optional, configured in options)
  const [showCountdown, setShowCountdown] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('efootball_show_countdown');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [countdownTargetDate, setCountdownTargetDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('efootball_countdown_target_date');
      if (saved) return saved;
    } catch {}
    const def = new Date();
    def.setDate(def.getDate() + 2);
    def.setHours(19, 0, 0, 0);
    return def.toISOString();
  });

  const handleToggleCountdown = (val?: boolean) => {
    const now = Date.now();
    persistLocalMutationMeta(now);
    const nextVal = typeof val === 'boolean' ? val : !showCountdown;
    setShowCountdown(nextVal);
    const updatedClock = { ...matchClockConfig, enabled: nextVal };
    setMatchClockConfig(updatedClock);
    try {
      localStorage.setItem('efootball_show_countdown', String(nextVal));
      localStorage.setItem(STORAGE_KEY_MATCH_CLOCK, JSON.stringify(updatedClock));
    } catch {}
    syncToServer(basePlayers, results, adminPasscode, tournamentFormat, groupStageConfig, updatedClock, undefined, now);
    addToast(nextVal ? 'Country clock & match countdown enabled on Hero!' : 'Country clock & match countdown hidden on Hero.');
  };

  const handleUpdateCountdownTarget = (dateStr: string) => {
    const now = Date.now();
    persistLocalMutationMeta(now);
    setCountdownTargetDate(dateStr);
    const updatedClock = { ...matchClockConfig, startDate: dateStr };
    setMatchClockConfig(updatedClock);
    try {
      localStorage.setItem('efootball_countdown_target_date', dateStr);
      localStorage.setItem(STORAGE_KEY_MATCH_CLOCK, JSON.stringify(updatedClock));
    } catch {}
    syncToServer(basePlayers, results, adminPasscode, tournamentFormat, groupStageConfig, updatedClock, undefined, now);
    addToast('Scheduled matchday kickoff updated!');
  };

  const handleUpdateMatchClockConfig = (newConfig: MatchClockConfig) => {
    const now = Date.now();
    persistLocalMutationMeta(now);
    setMatchClockConfig(newConfig);
    setShowCountdown(newConfig.enabled);
    setCountdownTargetDate(newConfig.startDate);
    try {
      localStorage.setItem(STORAGE_KEY_MATCH_CLOCK, JSON.stringify(newConfig));
      localStorage.setItem('efootball_show_countdown', String(newConfig.enabled));
      localStorage.setItem('efootball_countdown_target_date', newConfig.startDate);
    } catch {}
    syncToServer(basePlayers, results, adminPasscode, tournamentFormat, groupStageConfig, newConfig, undefined, now);
    addToast('Country clock & match schedule updated!');
  };

  return (
    <div className="relative min-h-screen text-[#f4f6ff] overflow-x-hidden">
      {/* Viewport-locked stationary background image behind the boxes - never moves on scroll */}
      <div id="fixed-background-viewport" />

      {/* Navigation with dynamic active tab indicator */}
      <Navbar
        isAdmin={isAdmin}
        activeSection={activeSection}
        currentUser={currentUser}
        tournamentFormat={tournamentFormat}
        onNavigateSection={handleNavigateSection}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Fixed header height compensation spacer */}
      <div className="h-[96px] sm:h-[102px] shrink-0" aria-hidden="true" />

      <main className="relative z-10 w-full max-w-full mx-auto px-0 sm:px-1.5 md:px-3">
        {activeSection === 'admin' ? (
          <div className="py-2 sm:py-6 px-0 sm:px-0">
            {/* Top Bar for Dedicated Admin View: Fully fitted edge-to-edge on mobile and tab mode */}
            <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2.5 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y border-[#3ce7ff]/30 bg-[#070e52] px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg w-full">
              <button
                type="button"
                onClick={() => handleNavigateSection('hub')}
                className="flex items-center gap-2 rounded-xl border border-[#3ce7ff]/50 bg-[#050842] px-3.5 py-1.5 text-xs font-bold text-[#3ce7ff] transition-colors hover:bg-[#3ce7ff] hover:text-[#050842]"
              >
                <span>← Back to Tournament Hub</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-[#b9c4f0]">
                <span>Tournament Management Portal</span>
                {isAdmin && (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                    Owner Active
                  </span>
                )}
              </div>
            </div>

            {/* Administrator Section */}
            <AdminPage
              isAdmin={isAdmin}
              isCloudSignedIn={Boolean(currentUser?.uid)}
              hasPendingCloudSync={hasPendingCloudSync}
              onPublishCloudNow={handlePublishCloudNow}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              activePasscode={adminPasscode}
              players={calculatedPlayers}
              fixtures={tournamentFixtures}
              results={results}
              isRegistrationOpen={isRegistrationOpen}
              tournamentFormat={tournamentFormat}
              groupStageConfig={groupStageConfig}
              showCountdown={showCountdown}
              countdownTargetDate={countdownTargetDate}
              matchClockConfig={matchClockConfig}
              activeFixtureToEdit={activeFixtureToEdit}
              onClearActiveFixture={() => setActiveFixtureToEdit(null)}
              onAdminLogin={() => {
                setIsAdmin(true);
                addToast('Owner verified desk unlocked!');
              }}
              onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
              onOpenRegisterPlayer={handleOpenRegisterPlayer}
              onOpenEditPlayer={handleOpenEditPlayer}
              onDeleteAllPlayers={handleDeleteAllPlayers}
              onSaveResult={handleSaveResult}
              onDeleteResult={handleDeleteResult}
              onResetData={handleResetData}
              onExportData={handleExportData}
              onImportData={handleImportData}
              onGenerateMatches={handleGenerateMatches}
              onUpdateGroupConfig={handleUpdateGroupConfig}
              onToggleShowCountdown={handleToggleCountdown}
              onUpdateCountdownTarget={handleUpdateCountdownTarget}
              onUpdateMatchClockConfig={handleUpdateMatchClockConfig}
              onPurgeOldData={handlePurgeOldMemberData}
              onToast={addToast}
              onSelectPlayer={(player) => setSelectedPlayer(player)}
              onToggleRegistration={handleToggleRegistration}
            />
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <Hero
              players={calculatedPlayers}
              results={results}
              fixtures={tournamentFixtures}
              totalMatches={tournamentFixtures.length}
              totalMatchdays={totalMatchdays}
              tournamentFormat={tournamentFormat}
              config={groupStageConfig}
              showCountdown={showCountdown}
              countdownTargetDate={countdownTargetDate}
              matchClockConfig={matchClockConfig}
              isAdmin={isAdmin}
              onNavigateToAdminClock={() => handleNavigateSection('admin')}
              onToggleShowCountdown={handleToggleCountdown}
              onScrollToFixtures={() => handleNavigateSection('fixtures')}
              onScrollToTable={() => handleNavigateSection('table')}
              onSelectPlayer={(player) => setSelectedPlayer(player)}
            />

            {/* When registration is open, keep Current Registered Players prominently at the top */}
            {isRegistrationOpen && (
              <>
                <RegisteredPlayersSection
                  players={calculatedPlayers}
                  fixtures={tournamentFixtures}
                  results={results}
                  tournamentFormat={tournamentFormat}
                  isRegistrationOpen={isRegistrationOpen}
                  isAdmin={isAdmin}
                  resultsCount={results.length}
                  onOpenRegisterPlayer={handleOpenRegisterPlayer}
                  onSelectPlayer={(player) => setSelectedPlayer(player)}
                  onToggleRegistration={handleToggleRegistration}
                  onToast={addToast}
                />

                {/* How The Challenge Works */}
                <HowItWorks />
              </>
            )}

            {/* Fixtures & Results (Immediately below Hero once registration has ended) */}
            <FixturesSection
              fixtures={tournamentFixtures}
              results={results}
              players={calculatedPlayers}
              isAdmin={isAdmin}
              isRegistrationOpen={isRegistrationOpen}
              tournamentFormat={tournamentFormat}
              config={groupStageConfig}
              onSelectFixtureToRecord={handleSelectFixtureToRecord}
              onDeleteResult={handleDeleteResult}
              onNavigateToBracket={() => handleNavigateSection('bracket')}
              onSelectPlayer={(player) => setSelectedPlayer(player)}
              onToggleRegistration={handleToggleRegistration}
            />

            {/* Knockout Stage Bracket & Graphics Section */}
            {(tournamentFormat === 'knockout' ||
              tournamentFormat === 'group_knockout' ||
              tournamentFormat === 'knockout_cup' ||
              tournamentFormat === 'group_stage') && (
              <BracketPage
                players={calculatedPlayers}
                results={results}
                fixtures={tournamentFixtures}
                tournamentFormat={tournamentFormat}
                config={groupStageConfig}
                isAdmin={isAdmin}
                isRegistrationOpen={isRegistrationOpen}
                onSelectFixtureToRecord={handleSelectFixtureToRecord}
                onSelectPlayer={(player) => setSelectedPlayer(player)}
                onToast={addToast}
                onToggleRegistration={handleToggleRegistration}
              />
            )}

            {/* League / Group Standings Table (hidden in direct Knockout format) */}
            {tournamentFormat !== 'knockout' && tournamentFormat !== 'knockout_cup' && (
              <LeagueTable
                players={calculatedPlayers}
                results={results}
                tournamentFormat={tournamentFormat}
                config={groupStageConfig}
                onSelectPlayer={(player) => setSelectedPlayer(player)}
              />
            )}

            {/* Golden Boot Top Scorer Showcase */}
            <GoldenBoot
              players={calculatedPlayers}
              results={results}
              onSelectPlayer={(player) => setSelectedPlayer(player)}
            />

            {/* When registration has ended, display Current Registered Players below active matches & bracket (still accessible via Navbar Players tab) */}
            {!isRegistrationOpen && (
              <>
                <RegisteredPlayersSection
                  players={calculatedPlayers}
                  fixtures={tournamentFixtures}
                  results={results}
                  tournamentFormat={tournamentFormat}
                  isRegistrationOpen={isRegistrationOpen}
                  isAdmin={isAdmin}
                  resultsCount={results.length}
                  onOpenRegisterPlayer={handleOpenRegisterPlayer}
                  onSelectPlayer={(player) => setSelectedPlayer(player)}
                  onToggleRegistration={handleToggleRegistration}
                  onToast={addToast}
                />

                {/* How The Challenge Works */}
                <HowItWorks />
              </>
            )}

            {/* Rules & Fair Play */}
            <RulesSection />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer
        isAdmin={isAdmin}
        onNavigateSection={handleNavigateSection}
      />

      {/* Modals */}
      <AdminModal
        isOpen={isAdminModalOpen}
        activePasscode={adminPasscode}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminSuccess}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onPasswordChanged={handlePasswordChanged}
      />

      <PlayerModal
        player={selectedPlayer}
        players={calculatedPlayers}
        results={results}
        fixtures={tournamentFixtures}
        isAdmin={isAdmin}
        isRegistrationOpen={isRegistrationOpen}
        tournamentFormat={tournamentFormat}
        onClose={() => setSelectedPlayer(null)}
        onOpenEditPlayer={handleOpenEditPlayer}
        onSelectPlayer={(player) => setSelectedPlayer(player)}
      />

      <PlayerEditModal
        isOpen={isPlayerEditModalOpen}
        playerToEdit={playerToEdit}
        isRegistrationOpen={isRegistrationOpen}
        onClose={() => {
          setIsPlayerEditModalOpen(false);
          setPlayerToEdit(null);
        }}
        onSavePlayer={handleSavePlayer}
        onDeletePlayer={handleDeletePlayer}
      />

      {/* Google Sign-In & Firestore User Profile Modal */}
      <UserProfileModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        players={calculatedPlayers}
        showCountdown={showCountdown}
        onToggleShowCountdown={handleToggleCountdown}
        onClose={() => setIsAuthModalOpen(false)}
        onUserUpdated={(updated) => setCurrentUser(updated)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
