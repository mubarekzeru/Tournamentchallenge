import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Lock,
  Users,
  Calendar,
  RotateCcw,
  Download,
  Upload,
  UserPlus,
  Edit3,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Trophy,
  Sparkles,
  Zap,
  Clock,
  AlertCircle,
  PlayCircle,
  Plus,
  Minus,
  Shuffle,
  ArrowRight,
  Medal,
  Swords,
  GitBranch,
  ArrowLeftRight,
  Info,
  MessageSquare,
  LayoutGrid,
  Phone,
  Send,
} from 'lucide-react';
import {
  Player,
  Fixture,
  MatchResult,
  TournamentFormat,
  GroupStageConfig,
} from '../types/tournament';
import { ADMIN_PASSCODE } from '../data/tournamentData';
import { getNextScheduledMatchday } from '../utils/standings';
import {
  partitionPlayersIntoGroups,
  calculateGroupStandings,
  DEFAULT_GROUP_CONFIG,
  getGroupLetters,
} from '../utils/groupStage';
import { AdminMediaExporter } from './AdminMediaExporter';
import { TournamentStatsSection } from './TournamentStatsSection';

interface AdminPageProps {
  isAdmin: boolean;
  activePasscode?: string;
  players: Player[];
  fixtures: Fixture[];
  results: MatchResult[];
  isRegistrationOpen: boolean;
  tournamentFormat?: TournamentFormat;
  groupStageConfig?: GroupStageConfig;
  showCountdown?: boolean;
  countdownTargetDate?: string;
  activeFixtureToEdit: { fixture: Fixture; existingResult?: MatchResult } | null;
  onClearActiveFixture: () => void;
  onAdminLogin: () => void;
  onOpenChangePassword?: () => void;
  onOpenRegisterPlayer: () => void;
  onOpenEditPlayer: (player: Player) => void;
  onSaveResult: (result: Omit<MatchResult, 'id' | 'submitted_at'>, existingId?: string) => void;
  onDeleteResult: (resultId: string) => void;
  onResetData: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateMatches?: (format: TournamentFormat) => void;
  onUpdateGroupConfig?: (config: GroupStageConfig) => void;
  onToggleShowCountdown?: (val?: boolean) => void;
  onUpdateCountdownTarget?: (dateStr: string) => void;
  onPurgeOldData?: () => void;
  onDeleteAllPlayers?: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onSelectPlayer?: (player: Player) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  isAdmin,
  activePasscode,
  players,
  fixtures,
  results,
  isRegistrationOpen,
  tournamentFormat = 'league_double',
  groupStageConfig = DEFAULT_GROUP_CONFIG,
  showCountdown = true,
  countdownTargetDate,
  activeFixtureToEdit,
  onClearActiveFixture,
  onAdminLogin,
  onOpenChangePassword,
  onOpenRegisterPlayer,
  onOpenEditPlayer,
  onDeleteAllPlayers,
  onSaveResult,
  onDeleteResult,
  onResetData,
  onExportData,
  onImportData,
  onGenerateMatches,
  onUpdateGroupConfig,
  onToggleShowCountdown,
  onUpdateCountdownTarget,
  onPurgeOldData,
  onToast,
  onSelectPlayer,
}) => {
  const passToMatch = activePasscode || ADMIN_PASSCODE;
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  // Tournament format selection state
  const [selectedFormat, setSelectedFormat] = useState<TournamentFormat>(tournamentFormat);
  const [switchConfirmTarget, setSwitchConfirmTarget] = useState<{
    format: TournamentFormat;
    name: string;
  } | null>(null);

  // Knockout penalty shootout states
  const [penaltyWinner, setPenaltyWinner] = useState<string>('');
  const [penaltyHomeScore, setPenaltyHomeScore] = useState<string>('');
  const [penaltyAwayScore, setPenaltyAwayScore] = useState<string>('');

  // Partition calculations for Group Stage & Knockout
  const { groups: groupPartition } = useMemo(() => {
    return partitionPlayersIntoGroups(players, groupStageConfig, results);
  }, [players, groupStageConfig, results]);

  const groupAStandings = useMemo(() => {
    const mems = groupPartition['A'] || [];
    return calculateGroupStandings(
      mems,
      results,
      groupStageConfig.qualifiersPerGroup,
      groupStageConfig.manualTieBreakers?.['A']
    );
  }, [groupPartition, results, groupStageConfig]);

  const groupBStandings = useMemo(() => {
    const mems = groupPartition['B'] || [];
    return calculateGroupStandings(
      mems,
      results,
      groupStageConfig.qualifiersPerGroup,
      groupStageConfig.manualTieBreakers?.['B']
    );
  }, [groupPartition, results, groupStageConfig]);

  const handleRandomizeGroups = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const newAssignments: Record<string, string> = {};
    shuffled.forEach((p, idx) => {
      newAssignments[p.user] = idx % 2 === 0 ? 'A' : 'B';
    });
    const updated: GroupStageConfig = {
      ...groupStageConfig,
      groupAssignments: newAssignments,
    };
    onUpdateGroupConfig?.(updated);
    onToast?.('🎲 Players randomized into Group A and Group B!', 'success');
  };

  const handleMovePlayerGroup = (username: string, targetGroup: string) => {
    const updated: GroupStageConfig = {
      ...groupStageConfig,
      groupAssignments: {
        ...(groupStageConfig.groupAssignments || {}),
        [username]: targetGroup,
      },
    };
    onUpdateGroupConfig?.(updated);
    onToast?.(`Moved @${username} to Group ${targetGroup}`, 'info');
  };

  // Next scheduled matchday info for countdown options
  const nextInfo = React.useMemo(() => {
    return getNextScheduledMatchday(fixtures, results);
  }, [fixtures, results]);

  const targetDateObj = React.useMemo(() => {
    if (countdownTargetDate) {
      const parsed = new Date(countdownTargetDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const def = new Date();
    def.setDate(def.getDate() + 2);
    def.setHours(19, 0, 0, 0);
    return def;
  }, [countdownTargetDate]);

  const formatToDatetimeLocal = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleApplyPresetHours = (hoursToAdd: number) => {
    const d = new Date();
    d.setTime(d.getTime() + hoursToAdd * 3600 * 1000);
    if (onUpdateCountdownTarget) {
      onUpdateCountdownTarget(d.toISOString());
    }
  };

  React.useEffect(() => {
    if (tournamentFormat) {
      setSelectedFormat(tournamentFormat);
    }
  }, [tournamentFormat]);

  // Passcode login state
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Score submission state
  const totalMatchdays =
    fixtures.length > 0 ? Math.max(...fixtures.map((f) => f.matchday)) : 14;

  // Auto-detect the next active/pending matchday so recording firmly holds where pending matches are
  const nextPendingInfo = React.useMemo(() => {
    return getNextScheduledMatchday(fixtures, results);
  }, [fixtures, results]);

  const currentPendingMatchday = nextPendingInfo ? nextPendingInfo.matchday : 1;

  const [matchday, setMatchday] = useState<number>(() => {
    const nextInfo = getNextScheduledMatchday(fixtures, results);
    return nextInfo ? nextInfo.matchday : 1;
  });

  const [selectedFixtureIdx, setSelectedFixtureIdx] = useState<number>(0);
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [venue, setVenue] = useState<string>('PS5 • Online lobby');
  const [entryMode, setEntryMode] = useState<'score' | 'postpone'>('score');
  const [postponedReason, setPostponedReason] = useState<string>('Postponed for other day');
  const [rescheduledMatchday, setRescheduledMatchday] = useState<string>('');
  const [scoreFeedback, setScoreFeedback] = useState<{ text: string; isError: boolean } | null>(
    null
  );

  const [stageFilter, setStageFilter] = useState<'all' | 'group_A' | 'group_B' | 'knockout' | 'quarter' | 'semi' | 'final'>('all');
  const [showDiscussionReference, setShowDiscussionReference] = useState<boolean>(false);

  // Dedicated Partition state for Administrator Section:
  // 'upcoming' (upcoming matches only with itself) vs 'results' (match results only with itself) vs 'both' (side-by-side)
  const [adminMatchPartition, setAdminMatchPartition] = useState<'upcoming' | 'results' | 'both'>('upcoming');
  const [adminPartitionSearch, setAdminPartitionSearch] = useState<string>('');

  // Strictly upcoming/pending matches partition (only with itself)
  const partitionUpcomingFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      const res = results.find(
        (r) =>
          r.matchday === f.matchday &&
          ((r.home_user === f.home && r.away_user === f.away) ||
            (r.home_user === f.away && r.away_user === f.home))
      );
      return !res || res.isPostponed;
    });
  }, [fixtures, results]);

  // Strictly completed/recorded match results partition (only with itself)
  const partitionCompletedResults = useMemo(() => {
    return results.filter((r) => !r.isPostponed);
  }, [results]);

  const getFixtureStageInfo = useCallback(
    (f: Fixture | undefined) => {
      if (!f) return null;
      const isKnockoutFormat =
        selectedFormat === 'knockout' ||
        selectedFormat === 'group_knockout' ||
        selectedFormat === 'knockout_cup';
      const isGroupKnockout =
        selectedFormat === 'group_stage';

      if (f.isKnockout || f.knockoutStage || f.matchday >= 100 || isKnockoutFormat) {
        const isFinal = f.knockoutStage === 'final' || f.id.includes('final');
        const isThird = f.knockoutStage === 'third_place' || f.id.includes('third');
        const isSemi = f.knockoutStage === 'semi_final' || f.id.includes('semi');
        const isQuarter = f.knockoutStage === 'quarter_final' || f.id.includes('qf');
        const isSemi1 =
          f.id === 'ko-semi-1' ||
          f.stage?.toLowerCase().includes('semi-final 1') ||
          f.stage?.includes('1st A');
        const isSemi2 =
          f.id === 'ko-semi-2' ||
          f.stage?.toLowerCase().includes('semi-final 2') ||
          f.stage?.includes('1st B');
        const isQF1 = f.id === 'ko-qf-1' || f.stage?.toLowerCase().includes('quarter-final 1');
        const isQF2 = f.id === 'ko-qf-2' || f.stage?.toLowerCase().includes('quarter-final 2');

        const stageLabel = isFinal
          ? 'Grand Final 🏆'
          : isThird
          ? '3rd Place Playoff 🥉'
          : isSemi1
          ? 'Semi-Final 1'
          : isSemi2
          ? 'Semi-Final 2'
          : isSemi
          ? f.stage || 'Semi-Final (Single Leg)'
          : isQF1
          ? 'Quarter-Final 1'
          : isQF2
          ? 'Quarter-Final 2'
          : isQuarter
          ? f.stage || 'Quarter-Final (Single Leg)'
          : f.stage || 'Knockout Stage Match';

        const seasonPhaseLabel = isFinal
          ? 'Knockout Season • Grand Final'
          : isThird
          ? 'Knockout Season • 3rd Place Playoff'
          : isSemi1
          ? 'Knockout Season • Semi-Final 1'
          : isSemi2
          ? 'Knockout Season • Semi-Final 2'
          : isQF1
          ? 'Knockout Season • Quarter-Final 1'
          : isQF2
          ? 'Knockout Season • Quarter-Final 2'
          : isQuarter
          ? 'Knockout Season • Quarter-Final'
          : 'Knockout Season Phase';

        const seasonPhaseBadge = isFinal
          ? 'Grand Final 🏆'
          : isThird
          ? '3rd Place 🥉'
          : isSemi1
          ? 'Semi-Final 1'
          : isSemi2
          ? 'Semi-Final 2'
          : isQF1
          ? 'Quarter-Final 1'
          : isQF2
          ? 'Quarter-Final 2'
          : isQuarter
          ? 'Quarter-Final'
          : 'Knockout Stage';

        const matchupContext = isFinal
          ? 'Championship Decider · Single Leg Match'
          : isThird
          ? 'Bronze Medal Decider · Single Leg Playoff'
          : isSemi1
          ? 'Semi-Final 1 Tie · Winner advances to Grand Final'
          : isSemi2
          ? 'Semi-Final 2 Tie · Winner advances to Grand Final'
          : isQF1
          ? 'Quarter-Final 1 · Winner meets Seed 1 in Semi-Final 1'
          : isQF2
          ? 'Quarter-Final 2 · Winner meets Seed 2 in Semi-Final 2'
          : isQuarter
          ? 'Quarter-Final Tie · Single Leg Sudden Death'
          : 'Single-Leg Knockout Tie';

        const discussionNotes = isFinal
          ? 'Season Grand Final: Winner is crowned Tournament Champion! Decided in this single leg. In case of a draw at full time, penalty shootout winner decides the champion.'
          : isThird
          ? 'Bronze Medal Playoff: Decider between the two semi-final runners-up for 3rd and 4th place. Single leg with penalty shootout if level.'
          : isSemi1
          ? 'Semi-Final 1: Single-leg tie between Seed 1 and QF 1 winner. Winner advances to Grand Final; loser heads to 3rd Place Playoff.'
          : isSemi2
          ? 'Semi-Final 2: Single-leg tie between Seed 2 and QF 2 winner. Winner advances to Grand Final; loser heads to 3rd Place Playoff.'
          : isQuarter
          ? 'Quarter-Final: Single-elimination sudden death match. Winner advances to the Semi-Finals, loser is eliminated. Penalty shootout decides draw.'
          : 'Single elimination knockout match. Winner advances, loser is eliminated.';

        // Determine player origins
        const homePlayerObj = players.find((p) => p.user === f.home);
        const awayPlayerObj = players.find((p) => p.user === f.away);
        let homeOrigin = homePlayerObj ? `Seed #${homePlayerObj.rank} (${homePlayerObj.team})` : 'Knockout Seed';
        let awayOrigin = awayPlayerObj ? `Seed #${awayPlayerObj.rank} (${awayPlayerObj.team})` : 'Knockout Seed';

        if (isSemi1) {
          homeOrigin = 'Seed #1 (1st Round Bye)';
          awayOrigin = 'Winner Quarter-Final 1';
        } else if (isSemi2) {
          homeOrigin = 'Seed #2 (1st Round Bye)';
          awayOrigin = 'Winner Quarter-Final 2';
        } else if (isFinal) {
          homeOrigin = 'Semi-Final 1 Winner';
          awayOrigin = 'Semi-Final 2 Winner';
        } else if (isThird) {
          homeOrigin = 'Semi-Final 1 Runner-up';
          awayOrigin = 'Semi-Final 2 Runner-up';
        } else if (isQF1) {
          homeOrigin = homePlayerObj ? `Seed #${homePlayerObj.rank} (${homePlayerObj.team})` : 'Seed #4';
          awayOrigin = awayPlayerObj ? `Seed #${awayPlayerObj.rank} (${awayPlayerObj.team})` : 'Seed #5';
        } else if (isQF2) {
          homeOrigin = homePlayerObj ? `Seed #${homePlayerObj.rank} (${homePlayerObj.team})` : 'Seed #3';
          awayOrigin = awayPlayerObj ? `Seed #${awayPlayerObj.rank} (${awayPlayerObj.team})` : 'Seed #6';
        }

        return {
          type: 'knockout' as const,
          stage: f.knockoutStage || (isFinal ? 'final' : isThird ? 'third_place' : isSemi ? 'semi_final' : 'quarter_final'),
          label: stageLabel,
          shortTag: isFinal ? '🏆 Final' : isThird ? '🥉 3rd Pl' : isSemi1 ? '⚔️ SF 1' : isSemi2 ? '⚔️ SF 2' : isQF1 ? '⚔️ QF 1' : isQF2 ? '⚔️ QF 2' : '⚔️ KO',
          roundName: 'Single-Leg Knockout Stage',
          badgeClass: 'border-[#eaff28]/60 bg-[#eaff28]/15 text-[#eaff28]',
          pillClass: 'bg-[#eaff28] text-[#050842]',
          seasonPhaseLabel,
          seasonPhaseBadge,
          matchupContext,
          discussionNotes,
          homeOrigin,
          awayOrigin,
          isFinal,
          isThird,
          isSemi: isSemi || isSemi1 || isSemi2,
          isQuarter: isQuarter || isQF1 || isQF2,
          isSemi1,
          isSemi2,
        };
      }

      if (!isGroupKnockout) return null;

      // Group detection
      let groupLetter = f.group;
      if (!groupLetter) {
        if (groupPartition['A']?.some((p) => p.user === f.home || p.user === f.away)) groupLetter = 'A';
        else if (groupPartition['B']?.some((p) => p.user === f.home || p.user === f.away)) groupLetter = 'B';
      }

      const currentLetter = groupLetter || 'A';
      const isA = currentLetter === 'A';
      const activeStandings = isA ? groupAStandings.standings : groupBStandings.standings;
      const homeStats = activeStandings.find((p) => p.user === f.home);
      const awayStats = activeStandings.find((p) => p.user === f.away);

      const homeRankStr = homeStats ? `#${homeStats.rank}` : 'Unranked';
      const awayRankStr = awayStats ? `#${awayStats.rank}` : 'Unranked';
      const homePts = homeStats ? homeStats.points : 0;
      const awayPts = awayStats ? awayStats.points : 0;

      return {
        type: 'group' as const,
        group: currentLetter,
        label: `Group ${currentLetter} Match`,
        shortTag: `Group ${currentLetter}`,
        roundName: `Group ${currentLetter} Single League`,
        badgeClass: isA
          ? 'border-emerald-400/50 bg-emerald-950/40 text-emerald-300'
          : 'border-cyan-400/50 bg-cyan-950/40 text-cyan-300',
        pillClass: isA ? 'bg-emerald-400 text-[#050842]' : 'bg-cyan-400 text-[#050842]',
        seasonPhaseLabel: `Group Stage • Group ${currentLetter} League`,
        seasonPhaseBadge: `Group ${currentLetter}`,
        matchupContext: `Intra-Group League Matchday ${f.matchday} • Group ${currentLetter}`,
        discussionNotes: `Both teams compete in Group ${currentLetter}. Top 2 in the Group ${currentLetter} standings qualify for the Single-Leg Knockout Semi-Finals.`,
        homeOrigin: `Group ${currentLetter} Member (${homeRankStr} · ${homePts} pts)`,
        awayOrigin: `Group ${currentLetter} Member (${awayRankStr} · ${awayPts} pts)`,
        homeStats,
        awayStats,
        isFinal: false,
        isThird: false,
        isSemi: false,
        isSemi1: false,
        isSemi2: false,
      };
    },
    [selectedFormat, groupPartition, groupAStandings, groupBStandings]
  );

  const distinctMatchdays = useMemo(() => {
    const set = new Set(fixtures.map((f) => f.matchday));
    if (set.size === 0) return [1];
    return Array.from(set).sort((a, b) => a - b);
  }, [fixtures]);

  const availableFixtures = useMemo(() => {
    const isKo =
      selectedFormat === 'knockout' ||
      selectedFormat === 'group_knockout' ||
      selectedFormat === 'knockout_cup';

    if (isKo) {
      if (stageFilter === 'quarter') {
        return fixtures.filter((f) => f.knockoutStage === 'quarter_final' || f.id.includes('qf'));
      }
      if (stageFilter === 'semi') {
        return fixtures.filter((f) => f.knockoutStage === 'semi_final' || f.id.includes('semi'));
      }
      if (stageFilter === 'final') {
        return fixtures.filter(
          (f) =>
            f.knockoutStage === 'final' ||
            f.knockoutStage === 'third_place' ||
            f.id.includes('final') ||
            f.id.includes('third')
        );
      }
      return fixtures;
    }

    const list = fixtures.filter((f) => f.matchday === matchday);
    if (stageFilter === 'all') return list;
    if (stageFilter === 'group_A') {
      return list.filter((f) => getFixtureStageInfo(f)?.group === 'A');
    }
    if (stageFilter === 'group_B') {
      return list.filter((f) => getFixtureStageInfo(f)?.group === 'B');
    }
    if (stageFilter === 'knockout') {
      return list.filter((f) => f.isKnockout || f.knockoutStage || f.matchday >= 100);
    }
    return list;
  }, [fixtures, matchday, stageFilter, selectedFormat, getFixtureStageInfo]);

  const currentFixture = availableFixtures[selectedFixtureIdx] || availableFixtures[0];

  const currentStageInfo = useMemo(
    () => getFixtureStageInfo(currentFixture),
    [currentFixture, getFixtureStageInfo]
  );

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.user, p])),
    [players]
  );

  const currentResult = useMemo(() => {
    if (!currentFixture) return undefined;
    return results.find(
      (r) =>
        r.matchday === currentFixture.matchday &&
        ((r.home_user === currentFixture.home && r.away_user === currentFixture.away) ||
          (currentFixture.isKnockout && r.home_user === currentFixture.away && r.away_user === currentFixture.home))
    );
  }, [currentFixture, results]);

  const isCurrentCompleted = !!currentResult && !currentResult.isPostponed;
  const isCurrentPostponed = !!currentResult?.isPostponed;

  // Track if user manually switched away from pending matchday
  const hasUserManuallySelectedRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Hold on current pending matchday and pending fixture on initial load only
  React.useEffect(() => {
    if (!activeFixtureToEdit && fixtures.length > 0 && isInitialMountRef.current) {
      isInitialMountRef.current = false;
      const nextInfo = getNextScheduledMatchday(fixtures, results);
      if (nextInfo) {
        setMatchday(nextInfo.matchday);
        const mdFixtures = fixtures.filter((f) => f.matchday === nextInfo.matchday);
        const firstPending = mdFixtures.findIndex(
          (f) =>
            !results.some(
              (r) =>
                r.matchday === nextInfo.matchday &&
                r.home_user === f.home &&
                r.away_user === f.away
            )
        );
        setSelectedFixtureIdx(firstPending >= 0 ? firstPending : 0);
      }
    }
  }, [fixtures, results, activeFixtureToEdit]);

  // Always keep score inputs, venue, and entry mode reliably in sync with the active fixture's result
  React.useEffect(() => {
    if (!currentFixture) {
      setHomeScore('');
      setAwayScore('');
      return;
    }
    const existing = results.find(
      (r) =>
        r.matchday === currentFixture.matchday &&
        r.home_user === currentFixture.home &&
        r.away_user === currentFixture.away
    );
    if (existing) {
      if (existing.isPostponed) {
        setEntryMode('postpone');
        setPostponedReason(existing.postponedReason || 'Postponed for other day');
        setRescheduledMatchday(
          existing.rescheduledMatchday ? String(existing.rescheduledMatchday) : ''
        );
        setHomeScore('');
        setAwayScore('');
      } else {
        setEntryMode('score');
        setHomeScore(String(existing.home_score));
        setAwayScore(String(existing.away_score));
        setPenaltyWinner(existing.penaltyWinner || '');
        setPenaltyHomeScore(
          existing.penaltyHomeScore !== undefined ? String(existing.penaltyHomeScore) : ''
        );
        setPenaltyAwayScore(
          existing.penaltyAwayScore !== undefined ? String(existing.penaltyAwayScore) : ''
        );
        setPostponedReason('Postponed for other day');
        setRescheduledMatchday('');
      }
      setVenue(existing.venue || 'PS5 • Online lobby');
    } else {
      setEntryMode('score');
      setHomeScore('');
      setAwayScore('');
      setPenaltyWinner('');
      setPenaltyHomeScore('');
      setPenaltyAwayScore('');
      setPostponedReason('Postponed for other day');
      setRescheduledMatchday('');
    }
  }, [
    currentFixture?.matchday,
    currentFixture?.home,
    currentFixture?.away,
    results,
  ]);

  // Jump to / Hold on Current Pending Fixtures
  const handleHoldOnCurrentPending = () => {
    const nextInfo = getNextScheduledMatchday(fixtures, results);
    if (!nextInfo) return;
    hasUserManuallySelectedRef.current = false;
    setMatchday(nextInfo.matchday);
    const mdFixtures = fixtures.filter((f) => f.matchday === nextInfo.matchday);
    const firstPending = mdFixtures.findIndex(
      (f) =>
        !results.some(
          (r) =>
            r.matchday === nextInfo.matchday &&
            r.home_user === f.home &&
            r.away_user === f.away
        )
    );
    setSelectedFixtureIdx(firstPending >= 0 ? firstPending : 0);
    setScoreFeedback({
      text: `Holding on pending: Matchday ${nextInfo.matchday} (${nextInfo.pendingCount} pending)`,
      isError: false,
    });
  };

  // Synchronize activeFixtureToEdit if selected from fixtures list
  React.useEffect(() => {
    if (activeFixtureToEdit) {
      hasUserManuallySelectedRef.current = true;
      setMatchday(activeFixtureToEdit.fixture.matchday);
      const matchdayFixtures = fixtures.filter(
        (f) => f.matchday === activeFixtureToEdit.fixture.matchday
      );
      const idx = matchdayFixtures.findIndex(
        (f) =>
          f.home === activeFixtureToEdit.fixture.home &&
          f.away === activeFixtureToEdit.fixture.away
      );
      setSelectedFixtureIdx(idx >= 0 ? idx : 0);
    }
  }, [activeFixtureToEdit, fixtures]);

  // Login handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === passToMatch) {
      setLoginError('');
      setPasscode('');
      onAdminLogin();
    } else {
      setLoginError('Incorrect passcode.');
    }
  };

  // Score & Postponement submit handler: records result or postponement and automatically continues with the next match or next matchday
  const handleScoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) {
      setScoreFeedback({ text: 'Please choose a valid fixture.', isError: true });
      return;
    }

    const isPostponing = entryMode === 'postpone';
    let hs = 0;
    let as = 0;

    const existingResult = results.find(
      (r) =>
        r.matchday === currentFixture.matchday &&
        r.home_user === currentFixture.home &&
        r.away_user === currentFixture.away
    );

    if (!isPostponing) {
      const effHome =
        homeScore !== ''
          ? homeScore
          : existingResult && !existingResult.isPostponed
          ? String(existingResult.home_score)
          : '';
      const effAway =
        awayScore !== ''
          ? awayScore
          : existingResult && !existingResult.isPostponed
          ? String(existingResult.away_score)
          : '';

      if (effHome === '' || effAway === '') {
        setScoreFeedback({ text: 'Please enter both home and away scores.', isError: true });
        return;
      }

      hs = parseInt(effHome, 10);
      as = parseInt(effAway, 10);

      if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
        setScoreFeedback({ text: 'Scores must be valid non-negative numbers.', isError: true });
        return;
      }

      // Knockout matches cannot end in a draw
      if (currentFixture.isKnockout && hs === as && !penaltyWinner) {
        setScoreFeedback({
          text: 'Knockout matches cannot end in a draw! Please select the penalty-shootout winner before saving.',
          isError: true,
        });
        return;
      }
    }

    const resultToSave: Omit<MatchResult, 'id' | 'submitted_at'> = {
      matchday: currentFixture.matchday,
      home_user: currentFixture.home,
      away_user: currentFixture.away,
      home_score: hs,
      away_score: as,
      venue: venue.trim() || 'PS5 • Online lobby',
      isPostponed: isPostponing,
    };

    if (currentFixture.isKnockout) {
      resultToSave.isKnockout = true;
      resultToSave.stage = currentFixture.stage;
      if (hs === as && penaltyWinner) {
        resultToSave.penaltyWinner = penaltyWinner;
        if (penaltyHomeScore !== '' && !isNaN(parseInt(penaltyHomeScore, 10))) {
          resultToSave.penaltyHomeScore = parseInt(penaltyHomeScore, 10);
        }
        if (penaltyAwayScore !== '' && !isNaN(parseInt(penaltyAwayScore, 10))) {
          resultToSave.penaltyAwayScore = parseInt(penaltyAwayScore, 10);
        }
      }
    }
    if (currentFixture.group) {
      resultToSave.group = currentFixture.group;
    }
    if (isPostponing) {
      resultToSave.postponedReason = postponedReason.trim() || 'Postponed for other day';
      if (rescheduledMatchday && !isNaN(parseInt(rescheduledMatchday, 10))) {
        resultToSave.rescheduledMatchday = parseInt(rescheduledMatchday, 10);
      }
    }

    onSaveResult(
      resultToSave,
      existingResult ? existingResult.id : undefined
    );

    // Build simulated updated results to check for continuation
    const savedResultId = existingResult ? existingResult.id : `res-${Date.now()}`;
    const updatedResultsSimulated: MatchResult[] = [
      ...results.filter(
        (r) =>
          !(
            r.matchday === currentFixture.matchday &&
            r.home_user === currentFixture.home &&
            r.away_user === currentFixture.away
          )
      ),
      {
        id: savedResultId,
        ...resultToSave,
        submitted_at: new Date().toISOString(),
      },
    ];

    // Check if more fixtures remain unrecorded in this current matchday
    const remainingInCurrentDay = availableFixtures.filter(
      (f) =>
        !updatedResultsSimulated.some(
          (r) =>
            r.matchday === currentFixture.matchday &&
            r.home_user === f.home &&
            r.away_user === f.away
        )
    );

    if (remainingInCurrentDay.length > 0) {
      // Continue to next unrecorded game in this matchday
      const nextFixtureIdx = availableFixtures.findIndex(
        (f) =>
          f.home === remainingInCurrentDay[0].home &&
          f.away === remainingInCurrentDay[0].away
      );
      setSelectedFixtureIdx(nextFixtureIdx >= 0 ? nextFixtureIdx : 0);
      setHomeScore('');
      setAwayScore('');
      setScoreFeedback({
        text: isPostponing
          ? `Match marked as Postponed: ${currentFixture.home} vs ${currentFixture.away}. Next game queued up!`
          : `Score saved: ${currentFixture.home} ${hs} - ${as} ${currentFixture.away}. Next game queued up!`,
        isError: false,
      });
    } else {
      // All matches in this matchday are played or postponed! Advance to next matchday (e.g. from 3 to 4)
      const nextScheduled = getNextScheduledMatchday(fixtures, updatedResultsSimulated);
      if (nextScheduled) {
        setMatchday(nextScheduled.matchday);
        const nextDayFixtures = fixtures.filter((f) => f.matchday === nextScheduled.matchday);
        const nextFixtureIdx = nextDayFixtures.findIndex(
          (f) =>
            !updatedResultsSimulated.some(
              (r) =>
                r.matchday === nextScheduled.matchday &&
                r.home_user === f.home &&
                r.away_user === f.away
            )
        );
        setSelectedFixtureIdx(nextFixtureIdx >= 0 ? nextFixtureIdx : 0);
        setHomeScore('');
        setAwayScore('');
        setScoreFeedback({
          text: isPostponing
            ? `Match marked as Postponed for other day. Matchday ${currentFixture.matchday} completed! Continuing with Matchday ${nextScheduled.matchday}.`
            : `Matchday ${currentFixture.matchday} completed! Now continuing with Matchday ${nextScheduled.matchday}.`,
          isError: false,
        });
      } else {
        setHomeScore('');
        setAwayScore('');
        setScoreFeedback({
          text: isPostponing
            ? `Match marked as Postponed for other day. All tournament matchdays complete!`
            : `Score saved: ${currentFixture.home} ${hs} - ${as} ${currentFixture.away}. All tournament matchdays complete!`,
          isError: false,
        });
      }
    }

    onClearActiveFixture();

    setTimeout(() => {
      setScoreFeedback(null);
    }, 4500);
  };


  return (
    <section id="admin" className="py-10 border-b border-[#3ce7ff]/20 scroll-mt-20">
      {/* Header section beside league table */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28]">
              Tournament Management
            </p>
            {isAdmin ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                <span>Owner Mode Active</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-[#3ce7ff]/40 bg-[#071056] px-2 py-0.5 text-[9px] font-bold text-[#3ce7ff]">
                <Lock className="h-3 w-3" />
                <span>Passcode Protected</span>
              </span>
            )}
          </div>
          <h2 className="font-sports mt-1 text-2xl sm:text-3xl text-white">
            Tournament Administrator
          </h2>
          <p className="mt-1 text-xs text-[#b9c4f0] max-w-xl">
            Participant roster, profile management, match scoring, deep tournament stats & analytics, and official exports.
          </p>
        </div>

        {isAdmin && onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            className="flex items-center gap-1.5 rounded-full border border-[#eaff28]/60 bg-[#eaff28]/15 px-3 py-1.5 text-xs font-bold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#08104e] transition-colors"
            title="Change Administrator Password (2-Step Verification)"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Change Password</span>
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="mt-6">
        {!isAdmin ? (
          /* Authentication Gate */
          <div className="mx-auto max-w-md rounded-2xl border-2 border-[#3ce7ff]/50 bg-gradient-to-b from-[#0a0f52] to-[#040632] p-6 sm:p-8 text-center shadow-[0_0_35px_rgba(60,231,255,0.2)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3ce7ff]/50 bg-[#3ce7ff]/20 text-[#3ce7ff] shadow-[0_0_15px_rgba(60,231,255,0.3)]">
              <Lock className="h-7 w-7" />
            </div>

            <h3 className="font-sports text-2xl text-white">Administrator Access</h3>
            <p className="mt-1.5 text-xs text-[#b9c4f0]">
              Enter your passcode to unlock tournament roster editing, device photo uploads, and match scoring controls.
            </p>

            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <input
                  id="admin-page-passcode"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  placeholder="Enter passcode..."
                  className="w-full rounded-xl border border-[#3ce7ff]/70 bg-[#030632] px-4 py-2.5 pr-10 text-center font-mono text-sm tracking-wider text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9bd4] hover:text-white p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {loginError && (
                <p className="text-xs font-semibold text-rose-400">{loginError}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-[#eaff28] py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#08104e] transition-transform hover:scale-105 active:scale-95 shadow-lg"
              >
                Unlock Administrator
              </button>

              {onOpenChangePassword && (
                <div className="pt-2 text-center border-t border-[#3ce7ff]/15">
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="text-xs font-bold text-[#3ce7ff] hover:text-[#eaff28] transition-colors inline-flex items-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Change Admin Password (2-Step Verification)</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        ) : (
          /* Unlocked Administrator Suite */
          <div className="space-y-6">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-4 text-center shadow-lg">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#3ce7ff]">
                  Registered Players
                </span>
                <p className="font-sports mt-1 text-2xl sm:text-3xl text-white">{players.length}</p>
                <span className="text-[10px] text-[#b9c4f0]">
                  {isRegistrationOpen ? 'Registration Open' : 'Roster Locked'}
                </span>
              </div>

              <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-4 text-center shadow-lg">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#3ce7ff]">
                  Total Fixtures
                </span>
                <p className="font-sports mt-1 text-2xl sm:text-3xl text-[#eaff28]">
                  {fixtures.length}
                </p>
                <span className="text-[10px] text-[#b9c4f0]">{totalMatchdays} Matchdays</span>
              </div>

              <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-4 text-center shadow-lg">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#3ce7ff]">
                  Completed Matches
                </span>
                <p className="font-sports mt-1 text-2xl sm:text-3xl text-emerald-400">
                  {results.length}
                </p>
                <span className="text-[10px] text-[#b9c4f0]">
                  {fixtures.length > 0
                    ? `${Math.round((results.length / fixtures.length) * 100)}% Complete`
                    : '0%'}
                </span>
              </div>

              <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-4 text-center shadow-lg">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#3ce7ff]">
                  Pending Matches
                </span>
                <p className="font-sports mt-1 text-2xl sm:text-3xl text-amber-400">
                  {Math.max(0, fixtures.length - results.length)}
                </p>
                <span className="text-[10px] text-[#b9c4f0]">Remaining to play</span>
              </div>
            </div>

            {/* Suite Section 1: Player Roster & Registration Management (Phone & Telegram) */}
            <section className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-5 sm:p-7 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#3ce7ff]" />
                    <h3 className="font-sports text-xl text-white">Player Registration &amp; Roster Management</h3>
                  </div>
                  <p className="mt-1 text-xs text-[#b9c4f0]">
                    Manage player profiles with official phone contact, Telegram coordinates, custom team identity, and device avatar photos.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-lg bg-[#050842] border border-[#3ce7ff]/30 px-3 py-1.5 text-[11px] font-mono text-[#3ce7ff]">
                    {players.length} Active Competitors
                  </span>

                  {/* Delete All Players Button */}
                  <button
                    type="button"
                    onClick={() => setIsDeleteAllModalOpen(true)}
                    disabled={players.length === 0}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider transition-all border ${
                      players.length > 0
                        ? 'border-rose-500/50 bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 hover:text-white hover:border-rose-400 active:scale-95 shadow-md cursor-pointer'
                        : 'border-gray-700 bg-gray-900/40 text-gray-500 cursor-not-allowed opacity-40'
                    }`}
                    title="Clear all registered competitors to easily save time and start fresh"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete All Players</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenRegisterPlayer}
                    disabled={!isRegistrationOpen}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition-all ${
                      isRegistrationOpen
                        ? 'bg-[#eaff28] text-[#08104e] shadow-lg hover:scale-105 active:scale-95'
                        : 'border border-gray-600 bg-gray-800 text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Register New Player</span>
                  </button>
                </div>
              </div>

              {/* Roster Cards with Phone Number & Telegram Handle or Empty State */}
              {players.length === 0 ? (
                <div className="mt-5 rounded-2xl border-2 border-dashed border-[#3ce7ff]/30 bg-[#050842]/40 p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3ce7ff]/40 bg-[#071360] text-[#3ce7ff] shadow-[0_0_20px_rgba(60,231,255,0.2)]">
                    <Users className="h-7 w-7" />
                  </div>
                  <h4 className="mt-3 font-sports text-xl text-white font-black">
                    NO PLAYERS REGISTERED
                  </h4>
                  <p className="mx-auto mt-1 max-w-md text-xs text-[#b9c4f0]">
                    The competitor roster is currently empty. The display page is showing <strong className="text-[#eaff28]">"Match Starts Soon"</strong>. Click <strong className="text-white">"Register New Player"</strong> above to add contestants.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-xl border border-[#3ce7ff]/25 bg-[#050842] p-3.5 transition-all hover:border-[#3ce7ff] shadow-md group"
                  >
                    <div>
                      {/* Top Header Row: Avatar, Team & Edit */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectPlayer?.(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') onSelectPlayer?.(p);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group/player hover:opacity-95 transition-opacity text-left focus:outline-none"
                          title={`View ${p.team} (@${p.user}) player profile card`}
                        >
                          <img
                            src={p.avatarUrl}
                            alt={p.team}
                            className="h-11 w-11 rounded-full border-2 border-[#3ce7ff] object-cover shrink-0 shadow-sm group-hover/player:border-[#eaff28] group-hover/player:scale-105 transition-all"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <strong className="block text-xs sm:text-sm font-bold text-white truncate font-sports group-hover/player:text-[#eaff28] transition-colors">
                              {p.team}
                            </strong>
                            <span className="block text-[10.5px] text-[#3ce7ff] font-mono truncate leading-tight mt-0.5">
                              @{p.user}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenEditPlayer(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3ce7ff]/40 bg-[#071056] text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#08104e] transition-colors shrink-0"
                          title="Edit team, user, phone or telegram"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Contact Channels Row: Telegram & Phone Number */}
                      <div className="mt-3 pt-2.5 border-t border-[#3ce7ff]/15 space-y-1.5">
                        {/* Telegram Handle */}
                        <div className="flex items-center justify-between text-[10.5px] font-mono">
                          <span className="text-[#8e9bd4] flex items-center gap-1.5 shrink-0">
                            <Send className="h-3 w-3 text-[#3ce7ff]" />
                            <span>Telegram:</span>
                          </span>
                          <a
                            href={`https://t.me/${(p.telegramUsername || p.user).replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[#3ce7ff] truncate max-w-[150px] bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] px-2 py-0.5 rounded border border-[#3ce7ff]/30 transition-colors cursor-pointer"
                            title={`Open Telegram profile: @${(p.telegramUsername || p.user).replace(/^@/, '')}`}
                          >
                            @{p.telegramUsername || p.user}
                          </a>
                        </div>

                        {/* Phone Number */}
                        <div className="flex items-center justify-between text-[10.5px] font-mono">
                          <span className="text-[#8e9bd4] flex items-center gap-1.5 shrink-0">
                            <Phone className="h-3 w-3 text-[#eaff28]" />
                            <span>Phone:</span>
                          </span>
                          {p.phoneNumber ? (
                            <a
                              href={`tel:${p.phoneNumber.replace(/[^\d+]/g, '')}`}
                              className="font-bold text-[#eaff28] truncate max-w-[150px] bg-[#071360] hover:bg-[#eaff28] hover:text-[#050842] px-2 py-0.5 rounded border border-[#eaff28]/30 transition-colors cursor-pointer"
                              title={`Direct to Call/Dial: ${p.phoneNumber}`}
                            >
                              {p.phoneNumber}
                            </a>
                          ) : (
                            <span className="text-[#8e9bd4] text-[10px] italic">Not provided</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Stats Pill */}
                    <div className="mt-3 pt-2 border-t border-[#3ce7ff]/10 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
                      <span>Played: <strong className="text-white">{p.played}</strong></span>
                      <span>GD: <strong className={p.gd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.gd > 0 ? `+${p.gd}` : p.gd}</strong></span>
                      <span className="text-[#eaff28] font-bold">{p.points} PTS</span>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </section>

            {/* Delete All Players Confirmation Modal */}
            {isDeleteAllModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-md rounded-2xl border-2 border-rose-500/60 bg-gradient-to-b from-[#180826] via-[#0b0416] to-[#050842] p-6 shadow-[0_0_50px_rgba(244,63,94,0.35)] text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-rose-500 bg-rose-500/20 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                    <Trash2 className="h-7 w-7" />
                  </div>

                  <h3 className="mt-4 font-sports text-2xl font-black text-white tracking-wide">
                    DELETE ALL PLAYERS?
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-[#c5cef9]">
                    Are you sure you want to delete all <strong className="text-white font-bold">{players.length} players</strong>?
                  </p>

                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-left text-[11px] text-rose-200">
                    <p className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <span>
                        This will wipe all player profiles, avatars, scheduled fixtures, and recorded match scores from local storage and the Firebase database. The tournament display page will show <strong>"Match Starts Soon"</strong>.
                      </span>
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDeleteAllModalOpen(false)}
                      className="flex-1 rounded-xl border border-[#3ce7ff]/30 bg-[#071360] py-2.5 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-[#0a1b80] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeleteAllModalOpen(false);
                        onDeleteAllPlayers?.();
                      }}
                      className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:from-rose-500 hover:to-red-500 active:scale-95 transition-all cursor-pointer"
                    >
                      Yes, Delete All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Suite Section 2: Tournament Structure & Playing Style */}
            <section className="rounded-2xl border-2 border-[#eaff28]/40 bg-gradient-to-b from-[#09115d] to-[#050842] p-5 sm:p-7 shadow-[0_0_35px_rgba(234,255,40,0.15)]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-[#eaff28]" />
                    <h3 className="font-sports text-xl text-white">
                      Tournament Structure &amp; Playing Style
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#b9c4f0]">
                    Select the active competitive format for your tournament. Switch between <strong className="text-white">Knockout</strong>, <strong className="text-white">Single Leg League</strong>, or <strong className="text-white">Double Leg League</strong>.
                  </p>
                </div>

                {/* Active Match Type Badge */}
                <div className="flex items-center gap-2 rounded-xl border border-[#eaff28] bg-[#071360] px-4 py-2 shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#b9c4f0]">
                    Current Play Style:
                  </span>
                  <span className="font-sports text-sm font-black text-[#eaff28]">
                    {selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup'
                      ? 'Knockout (Single Elimination Bracket)'
                      : selectedFormat === 'group_stage'
                      ? 'Group Stage & Knockout'
                      : selectedFormat === 'league_single'
                      ? 'Single Leg League (1 match per pair)'
                      : 'Double Leg League (Home & Away)'}
                  </span>
                </div>
              </div>

              {/* Tournament Format Cards Grid */}
              <div className="mt-6 grid gap-4 lg:grid-cols-3 sm:grid-cols-2">
                {/* 1. Knockout (Featured / Direct Cup) */}
                <div
                  onClick={() => {
                    if (selectedFormat !== 'knockout' && selectedFormat !== 'group_knockout' && selectedFormat !== 'knockout_cup') {
                      setSwitchConfirmTarget({
                        format: 'knockout',
                        name: 'Knockout',
                      });
                    }
                  }}
                  className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all lg:col-span-1 sm:col-span-2 ${
                    selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup'
                      ? 'border-[#eaff28] bg-gradient-to-b from-[#0e1878] to-[#060a48] shadow-[0_0_25px_rgba(234,255,40,0.35)]'
                      : 'border-[#3ce7ff]/25 bg-[#060a48]/70 hover:border-[#3ce7ff]/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eaff28] text-xs font-black text-[#050842]">
                          ★
                        </span>
                        <h4 className="font-sports text-base text-white">Knockout</h4>
                        {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup') && (
                          <span className="rounded-full bg-[#eaff28] px-2 py-0.5 text-[9px] font-black text-[#050842] uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#b9c4f0]">
                        Direct single-elimination tournament. All users play on <strong className="text-[#eaff28]">Knockout ties</strong> directly through sudden-death bracket rounds.
                      </p>
                    </div>

                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup'
                          ? 'border-[#eaff28] bg-[#eaff28]'
                          : 'border-[#8e9bd4]'
                      }`}
                    >
                      {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup') && (
                        <div className="h-2 w-2 rounded-full bg-[#050842]" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#3ce7ff]/20 bg-[#050842]/90 p-3 text-xs text-[#b9c4f0] space-y-1">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#eaff28]">
                      Tournament Specifications:
                    </span>
                    <p className="text-[11px]">• <strong>Format</strong>: Direct single-elimination cup bracket</p>
                    <p className="text-[11px]">• <strong>Participants</strong>: All registered players in symmetrical draw</p>
                    <p className="text-[11px]">• <strong>Progression</strong>: Quarter-Finals → Semi-Finals → Grand Final &amp; 3rd Place</p>
                    <p className="text-[11px]">• <strong>Decider</strong>: Penalty shootout decider if tied at full time</p>
                    <p className="text-[11px]">• <strong>Championship</strong>: Winner awarded Grand Trophy 🏆</p>
                  </div>
                </div>

                {/* 2. Single Leg League Option */}
                <div
                  onClick={() => {
                    if (selectedFormat !== 'league_single') {
                      setSwitchConfirmTarget({
                        format: 'league_single',
                        name: 'Single Leg League',
                      });
                    }
                  }}
                  className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                    selectedFormat === 'league_single'
                      ? 'border-[#eaff28] bg-gradient-to-b from-[#0e1878] to-[#060a48] shadow-[0_0_25px_rgba(234,255,40,0.25)]'
                      : 'border-[#3ce7ff]/25 bg-[#060a48]/70 hover:border-[#3ce7ff]/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3ce7ff] text-xs font-black text-[#050842]">
                          1
                        </span>
                        <h4 className="font-sports text-base text-white">Single Leg League</h4>
                        {selectedFormat === 'league_single' && (
                          <span className="rounded-full bg-[#eaff28] px-2 py-0.5 text-[9px] font-black text-[#050842] uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#b9c4f0]">
                        1 match per opponent pair. Fast-paced, high-stakes single round-robin league.
                      </p>
                    </div>

                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        selectedFormat === 'league_single'
                          ? 'border-[#eaff28] bg-[#eaff28]'
                          : 'border-[#8e9bd4]'
                      }`}
                    >
                      {selectedFormat === 'league_single' && (
                        <div className="h-2 w-2 rounded-full bg-[#050842]" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#3ce7ff]/20 bg-[#050842]/90 p-3 text-xs text-[#b9c4f0] space-y-1">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#eaff28]">
                      Specifications:
                    </span>
                    <p className="text-[11px]">• Unified single table for all players</p>
                    <p className="text-[11px]">• Every competitor faces each rival once</p>
                    <p className="text-[11px]">• Total matches: {Math.max(1, Math.floor((players.length * (players.length - 1)) / 2))} fixtures</p>
                  </div>
                </div>

                {/* 3. Double Leg League Option */}
                <div
                  onClick={() => {
                    if (selectedFormat !== 'league_double') {
                      setSwitchConfirmTarget({
                        format: 'league_double',
                        name: 'Double Leg League (Home & Away)',
                      });
                    }
                  }}
                  className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                    selectedFormat === 'league_double'
                      ? 'border-[#eaff28] bg-gradient-to-b from-[#0e1878] to-[#060a48] shadow-[0_0_25px_rgba(234,255,40,0.25)]'
                      : 'border-[#3ce7ff]/25 bg-[#060a48]/70 hover:border-[#3ce7ff]/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3ce7ff] text-xs font-black text-[#050842]">
                          2
                        </span>
                        <h4 className="font-sports text-base text-white">Double Leg League</h4>
                        {selectedFormat === 'league_double' && (
                          <span className="rounded-full bg-[#eaff28] px-2 py-0.5 text-[9px] font-black text-[#050842] uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#b9c4f0]">
                        2 matches per opponent pair (Home fixture &amp; Away fixture). Full premier league.
                      </p>
                    </div>

                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        selectedFormat === 'league_double'
                          ? 'border-[#eaff28] bg-[#eaff28]'
                          : 'border-[#8e9bd4]'
                      }`}
                    >
                      {selectedFormat === 'league_double' && (
                        <div className="h-2 w-2 rounded-full bg-[#050842]" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#3ce7ff]/20 bg-[#050842]/90 p-3 text-xs text-[#b9c4f0] space-y-1">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#eaff28]">
                      Specifications:
                    </span>
                    <p className="text-[11px]">• Balanced home and away match distribution</p>
                    <p className="text-[11px]">• Total matches: {Math.max(2, players.length * (players.length - 1))} fixtures</p>
                    <p className="text-[11px]">• Table leader crowned premier champion</p>
                  </div>
                </div>
              </div>

              {/* Knockout Tournament & Bracket Control Center (when active) */}
              {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup') && (
                <div className="mt-7 border-t border-[#3ce7ff]/25 pt-6 space-y-6">
                  {/* Dashboard Action Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071360] p-4 rounded-2xl border border-[#3ce7ff]/30">
                    <div>
                      <h4 className="font-sports text-lg text-white flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-[#eaff28]" />
                        Knockout Bracket &amp; Seeding Control Center
                      </h4>
                      <p className="text-xs text-[#b9c4f0] mt-0.5">
                        Pure single-elimination tournament. All users play directly on sudden-death elimination ties with extra time and penalties.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href="#bracket"
                        className="flex items-center gap-1.5 rounded-xl border border-[#eaff28] bg-[#eaff28]/15 px-3.5 py-1.5 text-xs font-bold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] transition-colors shadow-sm"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        <span>View Championship Bracket</span>
                      </a>
                    </div>
                  </div>

                  {/* Knockout Tournament Pathway Cards */}
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* 1. Quarter-Finals */}
                    <div className="rounded-2xl border-2 border-[#3ce7ff]/30 bg-[#040a3e] p-4 shadow-lg space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3ce7ff] text-xs font-black text-[#050842]">
                            1
                          </span>
                          <span className="font-sports text-sm text-white font-bold">Quarter-Finals</span>
                        </div>
                        <span className="text-[10px] rounded-full bg-[#3ce7ff]/15 text-[#3ce7ff] px-2 py-0.5 border border-[#3ce7ff]/30 font-bold">
                          Single Leg
                        </span>
                      </div>
                      <p className="text-xs text-[#b9c4f0]">
                        Contestants play sudden-death matches to earn berths in the Semi-Finals.
                      </p>
                      <div className="space-y-1.5 text-xs">
                        <div className="rounded-lg bg-[#071360] p-2 border border-white/5">
                          <span className="text-[10px] text-[#3ce7ff] font-bold block uppercase">QF 1 (feeds SF 1)</span>
                          <span className="text-white font-semibold">
                            {players[3]?.team || 'Seed 4'} vs {players[4]?.team || 'Seed 5'}
                          </span>
                        </div>
                        <div className="rounded-lg bg-[#071360] p-2 border border-white/5">
                          <span className="text-[10px] text-[#3ce7ff] font-bold block uppercase">QF 2 (feeds SF 2)</span>
                          <span className="text-white font-semibold">
                            {players[2]?.team || 'Seed 3'} vs {players[5]?.team || 'Seed 6'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Semi-Finals */}
                    <div className="rounded-2xl border-2 border-emerald-400/40 bg-[#040a3e] p-4 shadow-lg space-y-2.5">
                      <div className="flex items-center justify-between border-b border-emerald-400/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400 text-xs font-black text-[#050842]">
                            2
                          </span>
                          <span className="font-sports text-sm text-white font-bold">Semi-Finals</span>
                        </div>
                        <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 border border-emerald-400/30 font-bold">
                          1st Round Byes
                        </span>
                      </div>
                      <p className="text-xs text-[#b9c4f0]">
                        Top seeds enter from byes to face quarter-final winners. Winners reach the Grand Final.
                      </p>
                      <div className="space-y-1.5 text-xs">
                        <div className="rounded-lg bg-[#071360] p-2 border border-white/5">
                          <span className="text-[10px] text-emerald-300 font-bold block uppercase">SF 1</span>
                          <span className="text-white font-semibold">
                            {players[0]?.team || 'Seed 1'} vs Winner QF 1
                          </span>
                        </div>
                        <div className="rounded-lg bg-[#071360] p-2 border border-white/5">
                          <span className="text-[10px] text-emerald-300 font-bold block uppercase">SF 2</span>
                          <span className="text-white font-semibold">
                            {players[1]?.team || 'Seed 2'} vs Winner QF 2
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Grand Final & 3rd Place */}
                    <div className="rounded-2xl border-2 border-[#eaff28]/40 bg-gradient-to-br from-[#0c1860] to-[#040a3e] p-4 shadow-lg space-y-2.5">
                      <div className="flex items-center justify-between border-b border-[#eaff28]/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eaff28] text-xs font-black text-[#050842]">
                            ★
                          </span>
                          <span className="font-sports text-sm text-white font-bold">Championship Finals</span>
                        </div>
                        <span className="text-[10px] rounded-full bg-[#eaff28]/20 text-[#eaff28] px-2 py-0.5 border border-[#eaff28]/40 font-bold">
                          Deciders
                        </span>
                      </div>
                      <p className="text-xs text-[#b9c4f0]">
                        Single-leg deciders for the Championship Trophy 🏆 and 3rd Place Bronze Medal 🥉.
                      </p>
                      <div className="space-y-1.5 text-xs">
                        <div className="rounded-lg bg-[#05093e] p-2 border border-[#eaff28]/30">
                          <span className="text-[10px] text-[#eaff28] font-black block uppercase">🏆 Grand Final</span>
                          <span className="text-white font-bold">Winner SF 1 vs Winner SF 2</span>
                        </div>
                        <div className="rounded-lg bg-[#05093e] p-2 border border-amber-400/30">
                          <span className="text-[10px] text-amber-300 font-bold block uppercase">🥉 3rd Place Playoff</span>
                          <span className="text-white">Loser SF 1 vs Loser SF 2</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registered Competitors Seeding Table */}
                  <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#040a3e] p-4">
                    <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#eaff28]" />
                        <h5 className="font-sports text-base text-white">Knockout Competitors &amp; Official Seeds</h5>
                      </div>
                      <span className="text-xs text-[#3ce7ff] font-mono">
                        {players.length} Competitors Seeded
                      </span>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {players.map((p, idx) => {
                        const seed = idx + 1;
                        const isTopSeed = seed <= 2;
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                              isTopSeed
                                ? 'border-[#eaff28]/50 bg-[#071360]'
                                : 'border-[#3ce7ff]/20 bg-[#050842]'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black shrink-0 ${
                                isTopSeed
                                  ? 'bg-[#eaff28] text-[#050842]'
                                  : 'bg-[#3ce7ff]/20 text-[#3ce7ff] border border-[#3ce7ff]/40'
                              }`}
                            >
                              #{seed}
                            </span>
                            <img
                              src={p.avatarUrl}
                              alt={p.team}
                              className="h-8 w-8 rounded-full border border-white/20 object-cover shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="truncate flex-1">
                              <span className="block text-xs font-bold text-white truncate">{p.team}</span>
                              <span className="block text-[10px] text-[#b9c4f0] font-mono truncate">@{p.user}</span>
                            </div>
                            <span
                              className={`text-[9px] font-bold uppercase rounded-md px-2 py-0.5 shrink-0 ${
                                isTopSeed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                  : 'bg-[#04083a] text-[#b9c4f0] border border-white/10'
                              }`}
                            >
                              {isTopSeed ? 'SF Bye' : 'Quarter-Final'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Group Stage Control Center (when active) */}
              {selectedFormat === 'group_stage' && (
                <div className="mt-7 border-t border-[#3ce7ff]/25 pt-6 space-y-6">
                  {/* Dashboard Action Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071360] p-4 rounded-2xl border border-[#3ce7ff]/30">
                    <div>
                      <h4 className="font-sports text-lg text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#eaff28]" />
                        Group A &amp; Group B Partition &amp; Qualification Status
                      </h4>
                      <p className="text-xs text-[#b9c4f0] mt-0.5">
                        Players are partitioned into Group A and Group B. Top 2 from each group advance to the single-leg Knockout Stage.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRandomizeGroups}
                        className="flex items-center gap-1.5 rounded-xl border border-[#eaff28]/60 bg-[#eaff28]/15 px-3 py-1.5 text-xs font-bold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] transition-colors shadow-sm"
                        title="Randomly shuffle all registered players evenly into Group A and Group B"
                      >
                        <Shuffle className="h-3.5 w-3.5" />
                        <span>Shuffle / Balance Groups</span>
                      </button>

                      <a
                        href="#bracket"
                        className="flex items-center gap-1.5 rounded-xl border border-[#3ce7ff]/50 bg-[#05093e] px-3 py-1.5 text-xs font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors shadow-sm"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        <span>View Knockout Graphics</span>
                      </a>
                    </div>
                  </div>

                  {/* 2-Column Responsive Groups Display */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Group A Card */}
                    <div className="rounded-2xl border-2 border-emerald-400/40 bg-[#040a3e] p-4 shadow-lg">
                      <div className="flex items-center justify-between border-b border-emerald-400/20 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500 text-xs font-black text-[#050842]">
                            A
                          </span>
                          <div>
                            <h5 className="font-sports text-base text-white">Group A</h5>
                            <span className="text-[10px] text-emerald-300 font-mono">
                              {groupPartition['A']?.length || 0} competitors &middot; Top 2 qualify
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 border border-emerald-400/30 font-bold">
                          {groupAStandings.isGroupComplete ? 'Matches Completed' : 'In Progress'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] font-sports font-black uppercase text-[#3ce7ff]">
                              <th className="py-2 px-2">#</th>
                              <th className="py-2 px-3">Player &amp; Club</th>
                              <th className="py-2 px-1 text-center">P</th>
                              <th className="py-2 px-1 text-center">W</th>
                              <th className="py-2 px-1 text-center">D</th>
                              <th className="py-2 px-1 text-center">L</th>
                              <th className="py-2 px-1 text-center">GD</th>
                              <th className="py-2 px-2 text-center text-[#eaff28]">PTS</th>
                              <th className="py-2 px-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {groupAStandings.standings.map((p, idx) => (
                              <tr
                                key={`grpA-${p.user}`}
                                className={`hover:bg-white/5 transition-colors ${
                                  idx < 2 ? 'bg-emerald-500/10' : ''
                                }`}
                              >
                                <td className="py-2 px-2 font-mono text-white">
                                  <span
                                    className={`inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
                                      idx === 0
                                        ? 'bg-[#eaff28] text-[#050842]'
                                        : idx === 1
                                        ? 'bg-emerald-400 text-[#050842]'
                                        : 'text-[#8e9bd4]'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={p.avatarUrl}
                                      alt=""
                                      className="h-6 w-6 rounded-full object-cover border border-[#3ce7ff]"
                                    />
                                    <div>
                                      <span className="block font-sports font-bold text-white leading-tight">
                                        {p.team || p.user}
                                      </span>
                                      <span className="block text-[9px] text-[#3ce7ff] font-mono leading-tight">
                                        @{p.user}
                                      </span>
                                      {idx < 2 && (
                                        <span className="text-[8px] text-emerald-300 font-extrabold uppercase">
                                          ★ Promoted to SF
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.played}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.w}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.d}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.l}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.gd}</td>
                                <td className="py-2 px-2 text-center font-sports font-black text-[#eaff28] text-sm">
                                  {p.points}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleMovePlayerGroup(p.user, 'B')}
                                    className="rounded-lg border border-[#3ce7ff]/40 bg-[#071056] px-2 py-0.5 text-[9px] font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                    title="Move player to Group B"
                                  >
                                    Move to B
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {groupAStandings.standings.length === 0 && (
                              <tr>
                                <td colSpan={9} className="py-4 text-center text-xs text-[#8e9bd4] italic">
                                  No players assigned to Group A yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Group B Card */}
                    <div className="rounded-2xl border-2 border-cyan-400/40 bg-[#040a3e] p-4 shadow-lg">
                      <div className="flex items-center justify-between border-b border-cyan-400/20 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500 text-xs font-black text-[#050842]">
                            B
                          </span>
                          <div>
                            <h5 className="font-sports text-base text-white">Group B</h5>
                            <span className="text-[10px] text-cyan-300 font-mono">
                              {groupPartition['B']?.length || 0} competitors &middot; Top 2 qualify
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] rounded-full bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 border border-cyan-400/30 font-bold">
                          {groupBStandings.isGroupComplete ? 'Matches Completed' : 'In Progress'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] font-sports font-black uppercase text-[#3ce7ff]">
                              <th className="py-2 px-2">#</th>
                              <th className="py-2 px-3">Player &amp; Club</th>
                              <th className="py-2 px-1 text-center">P</th>
                              <th className="py-2 px-1 text-center">W</th>
                              <th className="py-2 px-1 text-center">D</th>
                              <th className="py-2 px-1 text-center">L</th>
                              <th className="py-2 px-1 text-center">GD</th>
                              <th className="py-2 px-2 text-center text-[#eaff28]">PTS</th>
                              <th className="py-2 px-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {groupBStandings.standings.map((p, idx) => (
                              <tr
                                key={`grpB-${p.user}`}
                                className={`hover:bg-white/5 transition-colors ${
                                  idx < 2 ? 'bg-cyan-500/10' : ''
                                }`}
                              >
                                <td className="py-2 px-2 font-mono text-white">
                                  <span
                                    className={`inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
                                      idx === 0
                                        ? 'bg-[#eaff28] text-[#050842]'
                                        : idx === 1
                                        ? 'bg-cyan-400 text-[#050842]'
                                        : 'text-[#8e9bd4]'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={p.avatarUrl}
                                      alt=""
                                      className="h-6 w-6 rounded-full object-cover border border-[#3ce7ff]"
                                    />
                                    <div>
                                      <span className="block font-sports font-bold text-white leading-tight">
                                        {p.team || p.user}
                                      </span>
                                      <span className="block text-[9px] text-[#3ce7ff] font-mono leading-tight">
                                        @{p.user}
                                      </span>
                                      {idx < 2 && (
                                        <span className="text-[8px] text-cyan-300 font-extrabold uppercase">
                                          ★ Promoted to SF
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.played}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.w}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.d}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.l}</td>
                                <td className="py-2 px-1 text-center font-mono text-white">{p.gd}</td>
                                <td className="py-2 px-2 text-center font-sports font-black text-[#eaff28] text-sm">
                                  {p.points}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleMovePlayerGroup(p.user, 'A')}
                                    className="rounded-lg border border-[#3ce7ff]/40 bg-[#071056] px-2 py-0.5 text-[9px] font-bold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                    title="Move player to Group A"
                                  >
                                    Move to A
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {groupBStandings.standings.length === 0 && (
                              <tr>
                                <td colSpan={9} className="py-4 text-center text-xs text-[#8e9bd4] italic">
                                  No players assigned to Group B yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Knockout Progression Pathway Guide */}
                  <div className="rounded-2xl border border-[#eaff28]/40 bg-[#060c44] p-4 text-xs text-[#b9c4f0]">
                    <div className="flex items-center gap-2 mb-3">
                      <Swords className="h-4 w-4 text-[#eaff28]" />
                      <span className="font-sports text-sm font-black text-white uppercase tracking-wider">
                        Single-Leg Knockout Stage Pathway
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {/* SF 1 */}
                      <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#04083a] p-3 space-y-1">
                        <span className="block text-[10px] font-black uppercase text-[#3ce7ff]">
                          Semi-final 1 (Single Leg)
                        </span>
                        <div className="text-white font-bold text-xs flex items-center justify-between">
                          <span>🥇 1st Group A:</span>
                          <span className="text-[#eaff28]">
                            {groupAStandings.standings[0]?.team || groupAStandings.standings[0]?.user || 'Leader A'}
                          </span>
                        </div>
                        <div className="text-white font-bold text-xs flex items-center justify-between">
                          <span>🥈 2nd Group B:</span>
                          <span className="text-cyan-300">
                            {groupBStandings.standings[1]?.team || groupBStandings.standings[1]?.user || 'Runner-up B'}
                          </span>
                        </div>
                      </div>

                      {/* SF 2 */}
                      <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#04083a] p-3 space-y-1">
                        <span className="block text-[10px] font-black uppercase text-[#3ce7ff]">
                          Semi-final 2 (Single Leg)
                        </span>
                        <div className="text-white font-bold text-xs flex items-center justify-between">
                          <span>🥇 1st Group B:</span>
                          <span className="text-[#eaff28]">
                            {groupBStandings.standings[0]?.team || groupBStandings.standings[0]?.user || 'Leader B'}
                          </span>
                        </div>
                        <div className="text-white font-bold text-xs flex items-center justify-between">
                          <span>🥈 2nd Group A:</span>
                          <span className="text-emerald-300">
                            {groupAStandings.standings[1]?.team || groupAStandings.standings[1]?.user || 'Runner-up A'}
                          </span>
                        </div>
                      </div>

                      {/* 3rd Place */}
                      <div className="rounded-xl border border-amber-400/20 bg-[#04083a] p-3 space-y-1">
                        <span className="block text-[10px] font-black uppercase text-amber-400">
                          3rd Place Playoff (Single Leg)
                        </span>
                        <p className="text-[11px] text-[#b9c4f0]">
                          Loser of SF 1 faces Loser of SF 2 for tournament bronze.
                        </p>
                      </div>

                      {/* Grand Final */}
                      <div className="rounded-xl border border-[#eaff28]/40 bg-gradient-to-br from-[#0c1860] to-[#04083a] p-3 space-y-1">
                        <span className="block text-[10px] font-black uppercase text-[#eaff28]">
                          🏆 Grand Final (Single Leg)
                        </span>
                        <p className="text-[11px] text-white font-semibold">
                          Winner of SF 1 faces Winner of SF 2 to lift the Grand Championship Trophy!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* League Format Confirmation Modal */}
            {switchConfirmTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="relative w-full max-w-md rounded-2xl border-2 border-[#eaff28] bg-gradient-to-b from-[#09115d] to-[#040632] p-6 shadow-2xl text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#eaff28] bg-[#071360] text-[#eaff28]">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-sports text-lg text-white">
                        Confirm League Format Change
                      </h4>
                      <span className="text-xs text-[#3ce7ff] font-semibold">
                        Switching to {switchConfirmTarget.name}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#050842] p-4 text-xs text-[#b9c4f0] space-y-2">
                    <p>
                      Are you sure you want to change the league schedule format to{' '}
                      <strong className="text-[#eaff28]">{switchConfirmTarget.name}</strong>?
                    </p>
                    <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-2 text-emerald-200 font-semibold text-[11px]">
                      🛡️ Safe Operation: Switching league play style will <strong>NEVER delete players or saved match results</strong>. It safely updates scheduled fixtures and table standings.
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSwitchConfirmTarget(null)}
                      className="rounded-xl border border-[#3ce7ff]/40 bg-[#071056] px-4 py-2 text-xs font-bold text-white hover:bg-[#091572] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onGenerateMatches) {
                          onGenerateMatches(switchConfirmTarget.format);
                        }
                        setSelectedFormat(switchConfirmTarget.format);
                        setSwitchConfirmTarget(null);
                      }}
                      className="rounded-xl bg-[#eaff28] px-5 py-2 text-xs font-black uppercase text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] transition-transform hover:scale-105 active:scale-95"
                    >
                      Confirm &amp; Switch
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Suite Section 2.5: Matchday Kickoff Schedule & Countdown Options */}
            <section className="rounded-2xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#09115d] to-[#050842] p-5 sm:p-7 shadow-[0_0_35px_rgba(60,231,255,0.15)]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#3ce7ff] bg-[#071056] text-[#eaff28]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sports text-xl text-white">
                      Matchday Kickoff Schedule & Countdown Options
                    </h3>
                    <p className="mt-0.5 text-xs text-[#b9c4f0]">
                      Configure the live countdown timer on the Hero section (optional, can be toggled on/off anytime).
                    </p>
                  </div>
                </div>

                {/* Main Enable/Disable Toggle */}
                <button
                  type="button"
                  onClick={() => onToggleShowCountdown && onToggleShowCountdown(!showCountdown)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                    showCountdown
                      ? 'bg-emerald-500 text-[#050842] shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400'
                      : 'border border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                  }`}
                  title="Toggle countdown timer on Hero section"
                >
                  <span>{showCountdown ? '✓ Countdown Enabled' : '✕ Countdown Disabled'}</span>
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {/* Status Box */}
                <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#050842] p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3ce7ff]">
                      Next Scheduled Matchday Target
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-sports text-2xl sm:text-3xl text-[#eaff28]">
                        {nextInfo ? `Matchday ${nextInfo.matchday}` : 'Tournament Finished'}
                      </span>
                      {nextInfo && (
                        <span className="text-xs text-[#b9c4f0]">
                          ({nextInfo.pendingCount} of {nextInfo.totalCount} matches left)
                        </span>
                      )}
                    </div>
                    {nextInfo?.restingPlayer && (
                      <p className="mt-1 text-xs text-[#b9c4f0]">
                        Resting team: <strong className="text-[#3ce7ff]">@{nextInfo.restingPlayer}</strong>
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-[#8e9bd4] border-t border-[#3ce7ff]/15 pt-2">
                    Hero timer automatically detects unfinished fixtures and schedules the earliest pending matchday.
                  </p>
                </div>

                {/* Scheduled Kickoff Datetime Picker */}
                <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#050842] p-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#3ce7ff]">
                    Set Kickoff Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formatToDatetimeLocal(targetDateObj)}
                    onChange={(e) => {
                      if (e.target.value && onUpdateCountdownTarget) {
                        const parsed = new Date(e.target.value);
                        if (!isNaN(parsed.getTime())) {
                          onUpdateCountdownTarget(parsed.toISOString());
                        }
                      }
                    }}
                    className="mt-2 w-full rounded-lg border border-[#3ce7ff]/50 bg-[#060a48] px-3 py-2 text-xs font-mono text-white focus:border-[#eaff28] focus:outline-none"
                  />

                  {/* Quick Presets */}
                  <div className="mt-3">
                    <span className="block text-[9px] font-semibold text-[#8e9bd4] uppercase tracking-wider mb-1.5">
                      Quick Schedule Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyPresetHours(2)}
                        className="rounded-md border border-[#3ce7ff]/30 bg-[#071056] px-2.5 py-1 text-[10px] font-semibold text-[#b9c4f0] hover:text-white hover:border-[#3ce7ff] transition-colors"
                      >
                        +2 Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetHours(24)}
                        className="rounded-md border border-[#3ce7ff]/30 bg-[#071056] px-2.5 py-1 text-[10px] font-semibold text-[#b9c4f0] hover:text-white hover:border-[#3ce7ff] transition-colors"
                      >
                        Tomorrow (+24h)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetHours(72)}
                        className="rounded-md border border-[#3ce7ff]/30 bg-[#071056] px-2.5 py-1 text-[10px] font-semibold text-[#b9c4f0] hover:text-white hover:border-[#3ce7ff] transition-colors"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetHours(168)}
                        className="rounded-md border border-[#3ce7ff]/30 bg-[#071056] px-2.5 py-1 text-[10px] font-semibold text-[#b9c4f0] hover:text-white hover:border-[#3ce7ff] transition-colors"
                      >
                        +1 Week
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Suite Section 3: Matchday Score Recording */}
            <section className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-2.5 sm:p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/20 pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#eaff28]" />
                  <div>
                    <h3 className="font-sports text-xl text-white">Record Match Score</h3>
                    <p className="text-xs text-[#b9c4f0] mt-0.5">
                      Enter official full-time match scores, post-match penalties, or mark postponements.
                    </p>
                  </div>
                </div>

                {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup') && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#eaff28]/50 bg-[#eaff28]/10 px-3 py-1 text-xs font-black text-[#eaff28] shadow-sm">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Knockout Format Active</span>
                  </div>
                )}
                {selectedFormat === 'group_stage' && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#eaff28]/50 bg-[#eaff28]/10 px-3 py-1 text-xs font-black text-[#eaff28] shadow-sm">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Group &amp; Knockout Format Active</span>
                  </div>
                )}
              </div>

              {/* Stage Filter Bar for Knockout format */}
              {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup') && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#3ce7ff]/30 bg-[#04083a] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#b9c4f0] text-[11px] uppercase tracking-wider">
                      Stage Filter:
                    </span>

                    <button
                      type="button"
                      onClick={() => setStageFilter('all')}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                        stageFilter === 'all'
                          ? 'bg-[#3ce7ff] text-[#050842] shadow-sm font-black'
                          : 'bg-[#071360] text-white hover:text-[#3ce7ff]'
                      }`}
                    >
                      All Matches
                    </button>

                    <button
                      type="button"
                      onClick={() => setStageFilter('quarter')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                        stageFilter === 'quarter'
                          ? 'border-[#3ce7ff] bg-[#3ce7ff] text-[#050842] shadow-[0_0_10px_rgba(60,231,255,0.4)] font-black'
                          : 'border-[#3ce7ff]/40 bg-[#071360] text-[#3ce7ff] hover:bg-[#071360]/80'
                      }`}
                    >
                      <span>Quarter-Finals</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStageFilter('semi')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                        stageFilter === 'semi'
                          ? 'border-emerald-400 bg-emerald-500 text-[#050842] shadow-[0_0_10px_rgba(52,211,153,0.3)] font-black'
                          : 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      <span>Semi-Finals</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStageFilter('final')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                        stageFilter === 'final'
                          ? 'border-[#eaff28] bg-[#eaff28] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.4)] font-black'
                          : 'border-[#eaff28]/50 bg-[#eaff28]/10 text-[#eaff28] hover:bg-[#eaff28]/20'
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>Finals &amp; 3rd Place</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-[#3ce7ff]">
                    {availableFixtures.length} matches in this view
                  </span>
                </div>
              )}

              {/* Stage Filter Bar for Group Stage format */}
              {selectedFormat === 'group_stage' && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#3ce7ff]/30 bg-[#04083a] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#b9c4f0] text-[11px] uppercase tracking-wider">
                      Stage Filter:
                    </span>

                    <button
                      type="button"
                      onClick={() => setStageFilter('all')}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                        stageFilter === 'all'
                          ? 'bg-[#3ce7ff] text-[#050842] shadow-sm font-black'
                          : 'bg-[#071360] text-white hover:text-[#3ce7ff]'
                      }`}
                    >
                      All Matches
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStageFilter('group_A');
                        const firstA = fixtures.find((f) => getFixtureStageInfo(f)?.group === 'A');
                        if (firstA) {
                          hasUserManuallySelectedRef.current = true;
                          setMatchday(firstA.matchday);
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                        stageFilter === 'group_A'
                          ? 'border-emerald-400 bg-emerald-500 text-[#050842] shadow-[0_0_10px_rgba(52,211,153,0.3)] font-black'
                          : 'border-emerald-400/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>Group A Matches</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStageFilter('group_B');
                        const firstB = fixtures.find((f) => getFixtureStageInfo(f)?.group === 'B');
                        if (firstB) {
                          hasUserManuallySelectedRef.current = true;
                          setMatchday(firstB.matchday);
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                        stageFilter === 'group_B'
                          ? 'border-cyan-400 bg-cyan-500 text-[#050842] shadow-[0_0_10px_rgba(34,211,238,0.3)] font-black'
                          : 'border-cyan-400/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      <span>Group B Matches</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStageFilter('knockout');
                        const firstKo = fixtures.find((f) => f.isKnockout || f.knockoutStage || f.matchday >= 100);
                        if (firstKo) {
                          hasUserManuallySelectedRef.current = true;
                          setMatchday(firstKo.matchday);
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                        stageFilter === 'knockout'
                          ? 'border-[#eaff28] bg-[#eaff28] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.4)] font-black'
                          : 'border-[#eaff28]/50 bg-[#eaff28]/10 text-[#eaff28] hover:bg-[#eaff28]/20'
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>Knockout Stage (Single Leg)</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-[#3ce7ff]">
                    {availableFixtures.length} matches in this view
                  </span>
                </div>
              )}

              {/* Administrator Discussion & Stage Visibility Dashboard (for Knockout & Group format) */}
              {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentFixture && currentStageInfo && (
                <div
                  className={`mt-4 rounded-2xl border-2 p-4 sm:p-5 text-white transition-all shadow-xl ${
                    currentStageInfo.type === 'knockout'
                      ? 'border-[#eaff28] bg-gradient-to-r from-[#0d1656] via-[#141d70] to-[#0d1656] shadow-[0_0_25px_rgba(234,255,40,0.22)]'
                      : currentStageInfo.group === 'A'
                      ? 'border-emerald-400 bg-gradient-to-r from-[#032338] via-[#053a4e] to-[#032338] shadow-[0_0_25px_rgba(52,211,153,0.2)]'
                      : 'border-cyan-400 bg-gradient-to-r from-[#031d47] via-[#052d6a] to-[#031d47] shadow-[0_0_25px_rgba(34,211,238,0.2)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl shadow-lg font-sports font-black text-lg sm:text-xl text-[#050842] ${
                          currentStageInfo.type === 'knockout'
                            ? 'bg-[#eaff28] ring-2 ring-[#eaff28]/60 shadow-[0_0_15px_rgba(234,255,40,0.5)]'
                            : currentStageInfo.group === 'A'
                            ? 'bg-emerald-400 ring-2 ring-emerald-400/60 shadow-[0_0_15px_rgba(52,211,153,0.5)]'
                            : 'bg-cyan-400 ring-2 ring-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                        }`}
                      >
                        {currentStageInfo.type === 'knockout' ? (
                          <Trophy className="h-6 w-6 text-[#050842]" />
                        ) : (
                          currentStageInfo.group
                        )}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2.5 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-widest ${
                              currentStageInfo.type === 'knockout'
                                ? 'bg-[#eaff28] text-[#050842]'
                                : currentStageInfo.group === 'A'
                                ? 'bg-emerald-400 text-[#050842]'
                                : 'bg-cyan-400 text-[#050842]'
                            }`}
                          >
                            {currentStageInfo.type === 'knockout'
                              ? `🏆 ${currentStageInfo.seasonPhaseBadge}`
                              : `🛡️ Group ${currentStageInfo.group} Fixture`}
                          </span>
                          <span className="text-[11px] font-mono text-[#b9c4f0]">
                            Matchday {currentFixture.matchday} &middot;{' '}
                            {currentStageInfo.type === 'knockout'
                              ? 'Single-Leg Elimination Season'
                              : 'Intra-Group Single League'}
                          </span>
                        </div>
                        <h4 className="mt-1 font-sports text-lg sm:text-2xl font-black text-white tracking-wide">
                          {currentStageInfo.seasonPhaseLabel}
                        </h4>
                      </div>
                    </div>

                    {/* Quick Discussion Reference Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowDiscussionReference((prev) => !prev)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/30 bg-[#04083a]/90 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] hover:border-[#3ce7ff] transition-all shadow-sm"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[#eaff28]" />
                      <span>
                        {showDiscussionReference
                          ? (selectedFormat === 'group_stage'
                              ? 'Hide Group Standings & Knockout Pathway'
                              : 'Hide Knockout Bracket & Seeding Pathway')
                          : (selectedFormat === 'group_stage'
                              ? 'View Group Standings & Knockout Pathway Reference'
                              : 'View Knockout Bracket & Seeding Pathway Reference')}
                      </span>
                    </button>
                  </div>

                  {/* Stage Details & Administrator Discussion Guidelines */}
                  <div className="mt-3.5 grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border border-white/10 bg-[#03062d]/70 p-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#eaff28] block mb-1">
                        📋 Discussion Context &amp; Format Rules:
                      </span>
                      <p className="text-[#dbe3ff] text-xs leading-relaxed">
                        {currentStageInfo.discussionNotes}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        {currentStageInfo.type === 'knockout' ? (
                          <>
                            <span className="rounded bg-[#081156] px-2 py-0.5 border border-[#eaff28]/40 text-[#eaff28] font-bold">
                              ⚡ Single Leg Match (No Replays)
                            </span>
                            <span className="rounded bg-[#081156] px-2 py-0.5 border border-[#3ce7ff]/40 text-[#3ce7ff] font-bold">
                              ⚖️ Ties Decided by Penalty Shootout
                            </span>
                            <span className="rounded bg-[#081156] px-2 py-0.5 border border-emerald-400/40 text-emerald-300 font-bold">
                              {currentStageInfo.isFinal
                                ? '🏆 Winner Takes Trophy'
                                : currentStageInfo.isThird
                                ? '🥉 Bronze Medalist'
                                : '🚀 Winner Advances to Final'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="rounded bg-[#031d2e] px-2 py-0.5 border border-emerald-400/40 text-emerald-300 font-bold">
                              🛡️ Group {currentStageInfo.group} Table Match
                            </span>
                            <span className="rounded bg-[#031d2e] px-2 py-0.5 border border-[#3ce7ff]/40 text-[#3ce7ff] font-bold">
                              3 PTS Win &middot; 1 PT Draw &middot; 0 PTS Loss
                            </span>
                            <span className="rounded bg-[#031d2e] px-2 py-0.5 border border-[#eaff28]/40 text-[#eaff28] font-bold">
                              🎯 Top 2 in Group Qualify for Knockout
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#03062d]/70 p-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#3ce7ff] block mb-1">
                        ⚔️ Competitors Status for Discussion:
                      </span>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white truncate max-w-[150px]">
                            {playerMap.get(currentFixture.home)?.team || currentFixture.home} (Home):
                          </span>
                          <span className="rounded px-2 py-0.5 text-[10px] font-mono font-bold bg-[#071360] text-[#eaff28] border border-[#eaff28]/30">
                            {currentStageInfo.homeOrigin}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white truncate max-w-[150px]">
                            {playerMap.get(currentFixture.away)?.team || currentFixture.away} (Away):
                          </span>
                          <span className="rounded px-2 py-0.5 text-[10px] font-mono font-bold bg-[#071360] text-[#eaff28] border border-[#eaff28]/30">
                            {currentStageInfo.awayOrigin}
                          </span>
                        </div>
                      </div>

                      {/* Scenario impact for Group Stage discussions */}
                      {currentStageInfo.type === 'group' && currentStageInfo.homeStats && currentStageInfo.awayStats && (
                        <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-[#b9c4f0]">
                          <span className="text-[#eaff28] font-bold">Discussion Points Scenarios: </span>
                          <span>
                            If {playerMap.get(currentFixture.home)?.team || currentFixture.home} wins &rarr;{' '}
                            <strong className="text-emerald-300">{currentStageInfo.homeStats.points + 3} pts</strong>.
                            If {playerMap.get(currentFixture.away)?.team || currentFixture.away} wins &rarr;{' '}
                            <strong className="text-cyan-300">{currentStageInfo.awayStats.points + 3} pts</strong>.
                            Draw &rarr; +1 pt each.
                          </span>
                        </div>
                      )}

                      {/* Scenario impact for Knockout discussions */}
                      {currentStageInfo.type === 'knockout' && (
                        <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-[#b9c4f0]">
                          <span className="text-[#eaff28] font-bold">Knockout Stakes: </span>
                          <span>
                            {currentStageInfo.isFinal
                              ? 'Winner is crowned Champion! Full-time tie goes to instant penalties.'
                              : currentStageInfo.isThird
                              ? 'Winner secures 3rd place bronze medal finish.'
                              : 'Winner advances directly to Grand Final. Loser enters 3rd Place match.'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable Discussion Reference Drawer */}
                  {showDiscussionReference && (
                    <div className="mt-4 rounded-xl border border-white/20 bg-[#020526] p-4 text-xs animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-white/15 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-[#eaff28]" />
                          <h5 className="font-sports text-sm text-white uppercase tracking-wider">
                            {selectedFormat === 'group_stage'
                              ? 'Administrator Group Standings & Knockout Progression Reference'
                              : 'Administrator Knockout Championship Bracket & Seeding Pathway'}
                          </h5>
                        </div>
                        <span className="text-[10px] text-[#b9c4f0]">
                          {selectedFormat === 'group_stage'
                            ? 'Top 2 highlighted in green advance to Knockout Semi-Finals'
                            : 'Direct single-elimination sudden death with penalty deciders'}
                        </span>
                      </div>

                      {/* Group Stage Standings Mini-tables (when group stage format is active) */}
                      {selectedFormat === 'group_stage' && (
                        <div className="grid gap-4 lg:grid-cols-2">
                          {/* Group A Mini-Table */}
                          <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/20 p-3">
                            <div className="flex items-center justify-between mb-2 pb-1 border-b border-emerald-400/20">
                              <span className="font-sports font-black text-emerald-300 text-sm">
                                GROUP A STANDINGS
                              </span>
                              <span className="text-[10px] font-mono text-emerald-400">
                                Top 2 Qualify
                              </span>
                            </div>
                            <div className="space-y-1">
                              {groupAStandings.standings.map((p, idx) => {
                                const isQualifying = idx < 2;
                                const isPlayingNow =
                                  currentFixture.home === p.user || currentFixture.away === p.user;
                                return (
                                  <div
                                    key={p.user}
                                    className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                                      isPlayingNow
                                        ? 'bg-emerald-500/30 border border-emerald-400 text-white font-black'
                                        : isQualifying
                                        ? 'bg-emerald-900/30 text-emerald-200'
                                        : 'text-[#8e9bd4]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span
                                        className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                          isQualifying
                                            ? 'bg-emerald-400 text-[#050842]'
                                            : 'bg-[#0a1848] text-[#8e9bd4]'
                                        }`}
                                      >
                                        {idx + 1}
                                      </span>
                                      <span className="truncate max-w-[120px]">{p.team}</span>
                                      {isPlayingNow && (
                                        <span className="rounded bg-[#eaff28] px-1 text-[9px] font-black text-[#050842]">
                                          PLAYING
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                      <span>{p.played}P</span>
                                      <span>GD {p.gd >= 0 ? `+${p.gd}` : p.gd}</span>
                                      <strong className="text-white font-sports text-xs">{p.points} PTS</strong>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Group B Mini-Table */}
                          <div className="rounded-lg border border-cyan-400/40 bg-cyan-950/20 p-3">
                            <div className="flex items-center justify-between mb-2 pb-1 border-b border-cyan-400/20">
                              <span className="font-sports font-black text-cyan-300 text-sm">
                                GROUP B STANDINGS
                              </span>
                              <span className="text-[10px] font-mono text-cyan-400">
                                Top 2 Qualify
                              </span>
                            </div>
                            <div className="space-y-1">
                              {groupBStandings.standings.map((p, idx) => {
                                const isQualifying = idx < 2;
                                const isPlayingNow =
                                  currentFixture.home === p.user || currentFixture.away === p.user;
                                return (
                                  <div
                                    key={p.user}
                                    className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                                      isPlayingNow
                                        ? 'bg-cyan-500/30 border border-cyan-400 text-white font-black'
                                        : isQualifying
                                        ? 'bg-cyan-900/30 text-cyan-200'
                                        : 'text-[#8e9bd4]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span
                                        className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                          isQualifying
                                            ? 'bg-cyan-400 text-[#050842]'
                                            : 'bg-[#0a1848] text-[#8e9bd4]'
                                        }`}
                                      >
                                        {idx + 1}
                                      </span>
                                      <span className="truncate max-w-[120px]">{p.team}</span>
                                      {isPlayingNow && (
                                        <span className="rounded bg-[#eaff28] px-1 text-[9px] font-black text-[#050842]">
                                          PLAYING
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                      <span>{p.played}P</span>
                                      <span>GD {p.gd >= 0 ? `+${p.gd}` : p.gd}</span>
                                      <strong className="text-white font-sports text-xs">{p.points} PTS</strong>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Knockout Progression Pathway */}
                      <div className="mt-3 rounded-lg border border-[#eaff28]/30 bg-[#071050] p-3">
                        <div className="flex items-center justify-between text-xs font-bold text-[#eaff28] mb-2">
                          <span className="flex items-center gap-1.5">
                            <Trophy className="h-3.5 w-3.5" />
                            <span>Knockout Championship Bracket &amp; Progression Reference:</span>
                          </span>
                          <span className="text-[10px] text-[#3ce7ff] font-normal">
                            Single Leg · Penalties on Draw
                          </span>
                        </div>

                        {selectedFormat === 'group_stage' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#b9c4f0]">
                            <div className="rounded bg-[#04083a] p-2 border border-[#3ce7ff]/20">
                              <strong className="text-white block font-sports">Semi-Final 1</strong>
                              <span>1st Group A vs 2nd Group B</span>
                            </div>
                            <div className="rounded bg-[#04083a] p-2 border border-[#3ce7ff]/20">
                              <strong className="text-white block font-sports">Semi-Final 2</strong>
                              <span>1st Group B vs 2nd Group A</span>
                            </div>
                            <div className="rounded bg-[#04083a] p-2 border border-[#eaff28]/40">
                              <strong className="text-[#eaff28] block font-sports">Grand Final 🏆</strong>
                              <span>Winner SF1 vs Winner SF2</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-[#b9c4f0]">
                            {/* Quarter-Finals */}
                            <div className="rounded bg-[#04083a] p-2.5 border border-[#3ce7ff]/30 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-black text-[#3ce7ff] uppercase">
                                <span>Quarter-Finals</span>
                                <span className="text-[9px] text-[#b9c4f0]">Sudden Death</span>
                              </div>
                              <div className="rounded bg-[#071360] p-1.5 text-[11px] text-white">
                                <span className="block text-[9px] text-[#3ce7ff] font-bold">QF 1 (feeds SF 1):</span>
                                <span className="font-semibold">{players[3]?.team || 'Seed 4'} vs {players[4]?.team || 'Seed 5'}</span>
                              </div>
                              <div className="rounded bg-[#071360] p-1.5 text-[11px] text-white">
                                <span className="block text-[9px] text-[#3ce7ff] font-bold">QF 2 (feeds SF 2):</span>
                                <span className="font-semibold">{players[2]?.team || 'Seed 3'} vs {players[5]?.team || 'Seed 6'}</span>
                              </div>
                            </div>

                            {/* Semi-Finals */}
                            <div className="rounded bg-[#04083a] p-2.5 border border-emerald-400/30 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-black text-emerald-300 uppercase">
                                <span>Semi-Finals</span>
                                <span className="text-[9px] text-emerald-400">Top 2 Byes</span>
                              </div>
                              <div className="rounded bg-[#071360] p-1.5 text-[11px] text-white">
                                <span className="block text-[9px] text-emerald-300 font-bold">SF 1:</span>
                                <span>{players[0]?.team || 'Seed 1 (Bye)'} vs Winner QF 1</span>
                              </div>
                              <div className="rounded bg-[#071360] p-1.5 text-[11px] text-white">
                                <span className="block text-[9px] text-emerald-300 font-bold">SF 2:</span>
                                <span>{players[1]?.team || 'Seed 2 (Bye)'} vs Winner QF 2</span>
                              </div>
                            </div>

                            {/* 3rd Place */}
                            <div className="rounded bg-[#04083a] p-2.5 border border-amber-400/30 space-y-1">
                              <span className="block text-[10px] font-black text-amber-300 uppercase">
                                🥉 3rd Place Playoff
                              </span>
                              <div className="rounded bg-[#071360] p-2 text-[11px] text-[#dbe3ff]">
                                <span>Loser SF 1 vs Loser SF 2</span>
                                <span className="block text-[10px] text-amber-300 mt-1">Bronze medal honor</span>
                              </div>
                            </div>

                            {/* Grand Final */}
                            <div className="rounded bg-gradient-to-b from-[#091568] to-[#04083a] p-2.5 border border-[#eaff28]/50 space-y-1">
                              <span className="block text-[10px] font-black text-[#eaff28] uppercase">
                                🏆 Grand Championship Final
                              </span>
                              <div className="rounded bg-[#071360] p-2 text-[11px] text-[#eaff28] font-bold">
                                <span>Winner SF 1 vs Winner SF 2</span>
                                <span className="block text-[10px] text-[#3ce7ff] font-normal mt-1">
                                  Winner lifts the Tournament Trophy 🏆
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleScoreSubmit} className="mt-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#b9c4f0]">
                        1. Matchday / Stage Round
                      </label>
                      <button
                        type="button"
                        onClick={handleHoldOnCurrentPending}
                        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold transition-all ${
                          matchday === currentPendingMatchday
                            ? 'bg-[#eaff28] text-[#050842] shadow-[0_0_8px_rgba(234,255,40,0.5)]'
                            : 'border border-[#eaff28]/60 bg-[#eaff28]/10 text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842]'
                        }`}
                        title="Click to hold on the current pending fixtures"
                      >
                        <span>🔒</span>
                        <span>
                          {matchday === currentPendingMatchday
                            ? `Holding on Pending (MD ${matchday})`
                            : `Hold on Pending (MD ${currentPendingMatchday})`}
                        </span>
                      </button>
                    </div>
                    <select
                      value={matchday}
                      onChange={(e) => {
                        const newMd = Number(e.target.value);
                        hasUserManuallySelectedRef.current = true;
                        setMatchday(newMd);
                        const mdFixtures = fixtures.filter((f) => f.matchday === newMd);
                        const firstPending = mdFixtures.findIndex(
                          (f) =>
                            !results.some(
                              (r) =>
                                r.matchday === newMd &&
                                r.home_user === f.home &&
                                r.away_user === f.away
                            )
                        );
                        setSelectedFixtureIdx(firstPending >= 0 ? firstPending : 0);
                      }}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none transition-all ${
                        matchday === currentPendingMatchday
                          ? 'border-[#eaff28] bg-[#071158] ring-1 ring-[#eaff28]/50 shadow-[0_0_14px_rgba(234,255,40,0.22)]'
                          : 'border-[#3ce7ff]/60 bg-[#060a48] focus:border-[#eaff28]'
                      }`}
                    >
                      {distinctMatchdays.map((d) => {
                        const dayFixtures = fixtures.filter((f) => f.matchday === d);
                        const dayResults = results.filter((r) => r.matchday === d);
                        const isDone = dayFixtures.length > 0 && dayResults.length >= dayFixtures.length;
                        const isProgress = !isDone && dayResults.length > 0;
                        const isCurrentPending = d === currentPendingMatchday;
                        const pendingCount = dayFixtures.length - dayResults.length;
                        const isKnockoutDay = dayFixtures.some((f) => f.isKnockout || f.knockoutStage || d >= 100);

                        let stagePrefix = '';
                        if (
                          selectedFormat === 'knockout' ||
                          selectedFormat === 'group_knockout' ||
                          selectedFormat === 'knockout_cup' ||
                          selectedFormat === 'group_stage'
                        ) {
                          if (isKnockoutDay) {
                            if (d === 100 || dayFixtures.some((f) => f.knockoutStage === 'quarter_final' || f.id.includes('qf'))) stagePrefix = '🏆 KNOCKOUT: Quarter-Finals · ';
                            else if (d === 101 || dayFixtures.some((f) => f.knockoutStage === 'semi_final' || f.id.includes('semi'))) stagePrefix = '🏆 KNOCKOUT: Semi-Finals · ';
                            else if (d === 102 || dayFixtures.some((f) => f.knockoutStage === 'final' || f.knockoutStage === 'third_place' || f.id.includes('final') || f.id.includes('third'))) stagePrefix = '🏆 KNOCKOUT: Grand Final & 3rd Place · ';
                            else stagePrefix = '🏆 KNOCKOUT STAGE · ';
                          } else {
                            const groupsInDay = Array.from(
                              new Set(dayFixtures.map((f) => getFixtureStageInfo(f)?.group).filter(Boolean))
                            ).sort();
                            stagePrefix = groupsInDay.length > 0
                              ? `GROUP STAGE (${groupsInDay.map((g) => `Group ${g}`).join(' & ')}) · `
                              : 'GROUP STAGE · ';
                          }
                        }

                        const labelSuffix = isDone
                          ? '✓ Completed'
                          : isCurrentPending
                          ? `🔒 PENDING (${pendingCount} left)`
                          : isProgress
                          ? `⏳ In Progress (${dayResults.length}/${dayFixtures.length})`
                          : 'Upcoming';

                        return (
                          <option key={d} value={d}>
                            {isCurrentPending
                              ? `▶ ${stagePrefix}Matchday ${d} · ${labelSuffix}`
                              : `${stagePrefix}Matchday ${d} · ${labelSuffix}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#b9c4f0]">
                        2. Scheduled Fixture
                      </label>
                      <span className="text-[10px] font-medium text-[#3ce7ff]">
                        {availableFixtures.length > 0
                          ? `${availableFixtures.length - results.filter((r) => r.matchday === matchday && !r.isPostponed).length} to complete`
                          : ''}
                      </span>
                    </div>
                    <select
                      value={selectedFixtureIdx}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setSelectedFixtureIdx(idx);
                      }}
                      className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2.5 text-xs font-bold text-white focus:border-[#eaff28] focus:outline-none transition-colors"
                    >
                      {availableFixtures.length > 0 ? (
                        availableFixtures.map((f, idx) => {
                          const existing = results.find(
                            (r) =>
                              r.matchday === f.matchday &&
                              r.home_user === f.home &&
                              r.away_user === f.away
                          );
                          const isDone = !!existing && !existing.isPostponed;
                          const isPost = !!existing?.isPostponed;
                          const statusTag = isDone
                            ? `✓ ENDED: ${existing.home_score} - ${existing.away_score}`
                            : isPost
                            ? `⏸ POSTPONED: ${existing.postponedReason || 'For other day'}`
                            : '⏳ Scheduled / Pending';

                          const fInfo = getFixtureStageInfo(f);
                          const stagePrefix = fInfo
                            ? fInfo.type === 'knockout'
                              ? `[🏆 ${fInfo.label.toUpperCase()}] `
                              : `[GROUP ${fInfo.group}] `
                            : '';

                          return (
                            <option key={f.id} value={idx}>
                              {isDone
                                ? `${stagePrefix}[${statusTag}] ${f.home} vs ${f.away}`
                                : `${stagePrefix}${f.home} vs ${f.away} · (${statusTag})`}
                            </option>
                          );
                        })
                      ) : (
                        <option value={0}>No fixtures for this selection</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Matchday Quick Fixture Chips (Showing Group/Knockout Badges & Ended Scores) */}
                {availableFixtures.length > 0 && (
                  <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#040632]/90 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider text-[#b9c4f0] mb-2">
                      <span className="flex items-center gap-1.5 text-[#3ce7ff]">
                        <Calendar className="h-3.5 w-3.5 text-[#eaff28]" />
                        <span>
                          {selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup'
                            ? `Knockout Season Fixtures · Stage Status:`
                            : `Matchday ${matchday} Fixtures · Group & Knockout Status:`}
                        </span>
                      </span>
                      <span className="text-[10px] text-[#8e9bd4] font-normal">
                        Click any match to load &amp; view score
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {availableFixtures.map((f, idx) => {
                        const existing = results.find(
                          (r) =>
                            r.matchday === f.matchday &&
                            r.home_user === f.home &&
                            r.away_user === f.away
                        );
                        const isSelected = selectedFixtureIdx === idx;
                        const isEnded = !!existing && !existing.isPostponed;
                        const isPostponed = !!existing?.isPostponed;
                        const fInfo = getFixtureStageInfo(f);

                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setSelectedFixtureIdx(idx)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all border ${
                              isSelected
                                ? 'border-[#eaff28] bg-[#071360] text-[#eaff28] ring-2 ring-[#eaff28]/40 shadow-[0_0_10px_rgba(234,255,40,0.3)] font-black'
                                : isEnded
                                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-900/60 font-semibold'
                                : isPostponed
                                ? 'border-amber-400/40 bg-amber-950/40 text-amber-300 hover:border-amber-400 hover:bg-amber-900/50'
                                : 'border-[#3ce7ff]/30 bg-[#060a48] text-[#b9c4f0] hover:text-white hover:border-[#3ce7ff]'
                            }`}
                            title={`${fInfo?.label || `Matchday ${matchday}`}: ${f.home} vs ${f.away}`}
                          >
                            {/* Group or Knockout Stage Tag on Chip */}
                            {fInfo && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                  fInfo.type === 'knockout'
                                    ? 'bg-[#eaff28] text-[#050842]'
                                    : fInfo.group === 'A'
                                    ? 'bg-emerald-400 text-[#050842]'
                                    : 'bg-cyan-400 text-[#050842]'
                                }`}
                              >
                                {fInfo.shortTag}
                              </span>
                            )}

                            {isEnded ? (
                              <>
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span className="font-sports">{f.home}</span>
                                <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 font-sports text-[11px] font-black text-[#eaff28] shadow-sm">
                                  {existing.home_score} - {existing.away_score}
                                </span>
                                <span className="font-sports">{f.away}</span>
                                <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-extrabold">
                                  Ended
                                </span>
                              </>
                            ) : isPostponed ? (
                              <>
                                <span>⏸</span>
                                <span className="font-sports">{f.home} vs {f.away}</span>
                                <span className="text-[9px] text-amber-300 font-bold uppercase">(Postponed)</span>
                              </>
                            ) : (
                              <>
                                <span>⏳</span>
                                <span className="font-sports">{f.home} vs {f.away}</span>
                                <span className="text-[9px] text-[#8e9bd4] font-medium">(Pending)</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Match Mode Tabs: Score vs Postponed */}
                {currentFixture && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3ce7ff]/20 bg-[#040632] p-2">
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setEntryMode('score')}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                          entryMode === 'score'
                            ? 'bg-gradient-to-r from-[#eaff28] to-[#99ff33] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.4)] font-black'
                            : 'text-[#b9c4f0] hover:text-white hover:bg-[#071056]'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Record Final Score</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEntryMode('postpone')}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                          entryMode === 'postpone'
                            ? 'bg-amber-400 text-[#050842] shadow-[0_0_12px_rgba(251,191,36,0.5)] font-black'
                            : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Postpone Match (For Other Day)</span>
                      </button>
                    </div>

                    {results.find(
                      (r) =>
                        r.matchday === currentFixture.matchday &&
                        r.home_user === currentFixture.home &&
                        r.away_user === currentFixture.away &&
                        r.isPostponed
                    ) && (
                      <span className="rounded-full border border-amber-400 bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                        Currently Postponed
                      </span>
                    )}
                  </div>
                )}

                {/* Postponed Notice if fixture is already postponed */}
                {currentFixture && (() => {
                  const existingPostponed = results.find(
                    (r) =>
                      r.matchday === currentFixture.matchday &&
                      r.home_user === currentFixture.home &&
                      r.away_user === currentFixture.away &&
                      r.isPostponed
                  );
                  if (!existingPostponed) return null;
                  return (
                    <div className="rounded-xl border border-amber-400/50 bg-amber-500/15 p-3.5 text-xs text-amber-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">⏸</span>
                          <div>
                            <strong className="text-white block font-sports tracking-wide">
                              This Match is Marked as Postponed for Another Day
                            </strong>
                            <span className="text-[11px] text-amber-300/90">
                              Reason: &quot;{existingPostponed.postponedReason || 'Postponed for other day'}&quot;
                              {existingPostponed.rescheduledMatchday
                                ? ` · Rescheduled to Matchday ${existingPostponed.rescheduledMatchday}`
                                : ' · Rescheduled date pending'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {entryMode !== 'score' && (
                            <button
                              type="button"
                              onClick={() => setEntryMode('score')}
                              className="rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-400 hover:text-[#050842] transition-colors"
                            >
                              Play Now / Enter Score
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteResult(existingPostponed.id);
                              setEntryMode('score');
                              setScoreFeedback({
                                text: `Postponement removed for ${currentFixture.home} vs ${currentFixture.away}. Fixture returned to pending status!`,
                                isError: false,
                              });
                            }}
                            className="rounded-lg border border-rose-400/50 bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500 hover:text-white transition-colors"
                            title="Remove postponement and return fixture to pending"
                          >
                            Reset to Pending
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {currentFixture && entryMode === 'score' && (
                  <div className="rounded-2xl border border-[#3ce7ff]/30 bg-gradient-to-b from-[#070e4e] to-[#040632] p-2 sm:p-5 text-center shadow-xl transition-all">
                    {isCurrentCompleted && currentResult ? (
                      /* --- PREVIOUS / ENDED MATCH VIEW: SHOW FULL ENDED RESULT INSTEAD OF 0 - 0 --- */
                      <div className="space-y-4">
                        {/* Status bar with outcome announcement */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3ce7ff]/20 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="rounded-md border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                              ✓ Match Ended · Official Score Recorded
                            </span>
                          </div>

                          <div>
                            {currentResult.home_score > currentResult.away_score ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#eaff28]/50 bg-[#eaff28]/15 px-3 py-1 text-xs font-black text-[#eaff28] shadow-[0_0_10px_rgba(234,255,40,0.2)]">
                                <Trophy className="h-3.5 w-3.5 text-[#eaff28]" />
                                <span>Winner: {playerMap.get(currentFixture.home)?.team || currentFixture.home} (+3 PTS)</span>
                              </span>
                            ) : currentResult.away_score > currentResult.home_score ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#eaff28]/50 bg-[#eaff28]/15 px-3 py-1 text-xs font-black text-[#eaff28] shadow-[0_0_10px_rgba(234,255,40,0.2)]">
                                <Trophy className="h-3.5 w-3.5 text-[#eaff28]" />
                                <span>Winner: {playerMap.get(currentFixture.away)?.team || currentFixture.away} (+3 PTS)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#3ce7ff]/50 bg-[#3ce7ff]/15 px-3 py-1 text-xs font-black text-[#3ce7ff]">
                                <span>🤝 Full-Time Draw · 1 PT Each</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stage & Group / Knockout Season Clarification Ribbon in Ended Match Card */}
                        {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentStageInfo && (
                          <div
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-2 text-left shadow-md ${
                              currentStageInfo.type === 'knockout'
                                ? 'border-[#eaff28] bg-gradient-to-r from-[#121c70] via-[#1b258e] to-[#121c70]'
                                : currentStageInfo.group === 'A'
                                ? 'border-emerald-400 bg-gradient-to-r from-[#03273e] via-[#053d5a] to-[#03273e]'
                                : 'border-cyan-400 bg-gradient-to-r from-[#03204e] via-[#053070] to-[#03204e]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {currentStageInfo.type === 'knockout' ? (
                                <Trophy className="h-4 w-4 text-[#eaff28] shrink-0" />
                              ) : (
                                <Swords
                                  className={`h-4 w-4 shrink-0 ${
                                    currentStageInfo.group === 'A' ? 'text-emerald-300' : 'text-cyan-300'
                                  }`}
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-sports text-xs sm:text-sm font-black uppercase tracking-wider ${
                                      currentStageInfo.type === 'knockout'
                                        ? 'text-[#eaff28]'
                                        : currentStageInfo.group === 'A'
                                        ? 'text-emerald-300'
                                        : 'text-cyan-300'
                                    }`}
                                  >
                                    {currentStageInfo.type === 'knockout'
                                      ? currentStageInfo.seasonPhaseLabel
                                      : `Group Stage • Group ${currentStageInfo.group} Match`}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase text-[#050842] ${
                                      currentStageInfo.type === 'knockout'
                                        ? 'bg-[#eaff28]'
                                        : currentStageInfo.group === 'A'
                                        ? 'bg-emerald-400'
                                        : 'bg-cyan-400'
                                    }`}
                                  >
                                    {currentStageInfo.type === 'knockout'
                                      ? 'Single Leg Knockout'
                                      : `Group ${currentStageInfo.group} League`}
                                  </span>
                                </div>
                                <span className="text-[10px] text-[#b9c4f0]">
                                  {currentStageInfo.matchupContext} &middot; Matchday {currentFixture.matchday}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-[#eaff28] bg-black/30 px-2 py-0.5 rounded border border-white/10">
                              {currentStageInfo.type === 'knockout' ? 'Knockout Season' : `Group ${currentStageInfo.group}`}
                            </span>
                          </div>
                        )}

                        {/* Grand Match Result Scoreboard */}
                        <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#03062d] p-4 sm:p-5 shadow-inner">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
                            {/* Home Side */}
                            <div className="flex flex-col items-center text-center">
                              {/* Group or Knockout Origin Tag */}
                              {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentStageInfo && (
                                <span
                                  className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border truncate max-w-[130px] sm:max-w-[170px] ${
                                    currentStageInfo.type === 'knockout'
                                      ? 'border-[#eaff28]/60 bg-[#eaff28]/15 text-[#eaff28]'
                                      : currentStageInfo.group === 'A'
                                      ? 'border-emerald-400/60 bg-emerald-950/60 text-emerald-300'
                                      : 'border-cyan-400/60 bg-cyan-950/60 text-cyan-300'
                                  }`}
                                  title={currentStageInfo.homeOrigin}
                                >
                                  {currentStageInfo.type === 'knockout'
                                    ? `🏆 ${currentStageInfo.homeOrigin}`
                                    : `🛡️ Grp ${currentStageInfo.group} (#${currentStageInfo.homeStats?.rank ?? '-'} · ${currentStageInfo.homeStats?.points ?? 0}p)`}
                                </span>
                              )}
                              <img
                                src={playerMap.get(currentFixture.home)?.avatarUrl}
                                alt={playerMap.get(currentFixture.home)?.team || currentFixture.home}
                                className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 object-cover shadow-lg ${
                                  currentResult.home_score > currentResult.away_score
                                    ? 'border-[#eaff28] ring-2 ring-[#eaff28]/50'
                                    : 'border-[#3ce7ff]/50'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                              <strong className="mt-2 block font-sports text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[180px]">
                                {playerMap.get(currentFixture.home)?.team || currentFixture.home}
                              </strong>
                              <span className="text-[10px] text-[#3ce7ff] font-mono truncate max-w-[110px]">
                                @{currentFixture.home}
                              </span>
                              <span className="mt-1 rounded bg-[#060e52] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#b9c4f0]">
                                Home
                              </span>
                            </div>

                            {/* Huge Ended Score Badge */}
                            <div className="flex flex-col items-center px-2 sm:px-4">
                              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 mb-1">
                                Match Ended Result
                              </span>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <span className="rounded-2xl border-2 border-[#3ce7ff] bg-[#071360] px-4 sm:px-5 py-2 font-sports text-3xl sm:text-4xl font-black text-[#eaff28] shadow-[0_0_20px_rgba(234,255,40,0.35)]">
                                  {currentResult.home_score}
                                </span>
                                <span className="font-sports text-2xl font-black text-[#b9c4f0]">—</span>
                                <span className="rounded-2xl border-2 border-[#3ce7ff] bg-[#071360] px-4 sm:px-5 py-2 font-sports text-3xl sm:text-4xl font-black text-[#eaff28] shadow-[0_0_20px_rgba(234,255,40,0.35)]">
                                  {currentResult.away_score}
                                </span>
                              </div>
                              <span className="mt-2.5 inline-block rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                Official Final Score
                              </span>
                              <span className="mt-1 text-[10px] text-[#8e9bd4] italic">
                                {currentResult.home_score === currentResult.away_score
                                  ? 'Even split · 1 point each'
                                  : `Goal Margin: ${Math.abs(currentResult.home_score - currentResult.away_score)} goals`}
                              </span>
                            </div>

                            {/* Away Side */}
                            <div className="flex flex-col items-center text-center">
                              {/* Group or Knockout Origin Tag */}
                              {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentStageInfo && (
                                <span
                                  className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border truncate max-w-[130px] sm:max-w-[170px] ${
                                    currentStageInfo.type === 'knockout'
                                      ? 'border-[#eaff28]/60 bg-[#eaff28]/15 text-[#eaff28]'
                                      : currentStageInfo.group === 'A'
                                      ? 'border-emerald-400/60 bg-emerald-950/60 text-emerald-300'
                                      : 'border-cyan-400/60 bg-cyan-950/60 text-cyan-300'
                                  }`}
                                  title={currentStageInfo.awayOrigin}
                                >
                                  {currentStageInfo.type === 'knockout'
                                    ? `🏆 ${currentStageInfo.awayOrigin}`
                                    : `🛡️ Grp ${currentStageInfo.group} (#${currentStageInfo.awayStats?.rank ?? '-'} · ${currentStageInfo.awayStats?.points ?? 0}p)`}
                                </span>
                              )}
                              <img
                                src={playerMap.get(currentFixture.away)?.avatarUrl}
                                alt={playerMap.get(currentFixture.away)?.team || currentFixture.away}
                                className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 object-cover shadow-lg ${
                                  currentResult.away_score > currentResult.home_score
                                    ? 'border-[#eaff28] ring-2 ring-[#eaff28]/50'
                                    : 'border-[#3ce7ff]/50'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                              <strong className="mt-2 block font-sports text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[180px]">
                                {playerMap.get(currentFixture.away)?.team || currentFixture.away}
                              </strong>
                              <span className="text-[10px] text-[#3ce7ff] font-mono truncate max-w-[110px]">
                                @{currentFixture.away}
                              </span>
                              <span className="mt-1 rounded bg-[#060e52] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#b9c4f0]">
                                Away
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Score Adjustment Controls */}
                        <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#050842]/80 p-3.5 text-left">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#b9c4f0]">
                              <Edit3 className="h-3.5 w-3.5 text-[#eaff28]" />
                              <span>Edit or Update Recorded Score:</span>
                            </div>
                            <span className="text-[11px] text-[#3ce7ff]">
                              Currently ended as: <strong className="text-[#eaff28] font-sports">{currentResult.home_score} - {currentResult.away_score}</strong>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
                            {/* Home input */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white max-w-[90px] sm:max-w-none truncate">
                                {playerMap.get(currentFixture.home)?.team || currentFixture.home}:
                              </span>
                              <button
                                type="button"
                                onClick={() => setHomeScore((prev) => String(Math.max(0, (Number(prev) || 0) - 1)))}
                                className="h-8 w-8 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                title="Decrease home score"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                required
                                value={homeScore}
                                onChange={(e) => setHomeScore(e.target.value)}
                                placeholder={String(currentResult.home_score)}
                                className="w-14 sm:w-16 rounded-lg border-2 border-[#3ce7ff] bg-[#030632] py-1.5 text-center font-sports text-xl text-[#eaff28] focus:border-[#eaff28] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setHomeScore((prev) => String((Number(prev) || 0) + 1))}
                                className="h-8 w-8 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                title="Increase home score"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <span className="text-base font-black text-[#b9c4f0]">—</span>

                            {/* Away input */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white max-w-[90px] sm:max-w-none truncate">
                                {playerMap.get(currentFixture.away)?.team || currentFixture.away}:
                              </span>
                              <button
                                type="button"
                                onClick={() => setAwayScore((prev) => String(Math.max(0, (Number(prev) || 0) - 1)))}
                                className="h-8 w-8 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                title="Decrease away score"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                required
                                value={awayScore}
                                onChange={(e) => setAwayScore(e.target.value)}
                                placeholder={String(currentResult.away_score)}
                                className="w-14 sm:w-16 rounded-lg border-2 border-[#3ce7ff] bg-[#030632] py-1.5 text-center font-sports text-xl text-[#eaff28] focus:border-[#eaff28] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setAwayScore((prev) => String((Number(prev) || 0) + 1))}
                                className="h-8 w-8 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                title="Increase away score"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* --- PENDING / UNPLAYED FIXTURE VIEW --- */
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3ce7ff]/20 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#3ce7ff]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-[#3ce7ff]">
                              Pending Fixture · Not Played Yet
                            </span>
                          </div>
                          <span className="text-[10px] text-[#b9c4f0]">
                            Enter match score when played
                          </span>
                        </div>

                        {/* Stage & Group / Knockout Season Clarification Ribbon in Pending Fixture View */}
                        {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentStageInfo && (
                          <div
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-3 sm:px-3.5 py-2 text-left shadow-md ${
                              currentStageInfo.type === 'knockout'
                                ? 'border-[#eaff28] bg-gradient-to-r from-[#121c70] via-[#1b258e] to-[#121c70]'
                                : currentStageInfo.group === 'A'
                                ? 'border-emerald-400 bg-gradient-to-r from-[#03273e] via-[#053d5a] to-[#03273e]'
                                : 'border-cyan-400 bg-gradient-to-r from-[#03204e] via-[#053070] to-[#03204e]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {currentStageInfo.type === 'knockout' ? (
                                <Trophy className="h-4 w-4 text-[#eaff28] shrink-0" />
                              ) : (
                                <Swords
                                  className={`h-4 w-4 shrink-0 ${
                                    currentStageInfo.group === 'A' ? 'text-emerald-300' : 'text-cyan-300'
                                  }`}
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-sports text-xs sm:text-sm font-black uppercase tracking-wider ${
                                      currentStageInfo.type === 'knockout'
                                        ? 'text-[#eaff28]'
                                        : currentStageInfo.group === 'A'
                                        ? 'text-emerald-300'
                                        : 'text-cyan-300'
                                    }`}
                                  >
                                    {currentStageInfo.type === 'knockout'
                                      ? currentStageInfo.seasonPhaseLabel
                                      : `Group Stage • Group ${currentStageInfo.group} Match`}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase text-[#050842] ${
                                      currentStageInfo.type === 'knockout'
                                        ? 'bg-[#eaff28]'
                                        : currentStageInfo.group === 'A'
                                        ? 'bg-emerald-400'
                                        : 'bg-cyan-400'
                                    }`}
                                  >
                                    {currentStageInfo.type === 'knockout'
                                      ? 'Single Leg Knockout'
                                      : `Group ${currentStageInfo.group} League`}
                                  </span>
                                </div>
                                <span className="text-[10px] text-[#b9c4f0]">
                                  {currentStageInfo.matchupContext} &middot; Matchday {currentFixture.matchday}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-[#eaff28] bg-black/30 px-2 py-0.5 rounded border border-white/10">
                              {currentStageInfo.type === 'knockout' ? 'Knockout Season' : `Group ${currentStageInfo.group}`}
                            </span>
                          </div>
                        )}

                        {/* Responsive Balanced Score Editor (Fits completely on mobile with zero crop) */}
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-4 py-1">
                          {/* Home Side with Stepper */}
                          <div className="flex flex-col items-center text-center">
                            {/* Group or Knockout Origin Tag */}
                            {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentStageInfo && (
                              <span
                                className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border truncate max-w-[100px] sm:max-w-[150px] ${
                                  currentStageInfo.type === 'knockout'
                                    ? 'border-[#eaff28]/60 bg-[#eaff28]/15 text-[#eaff28]'
                                    : currentStageInfo.group === 'A'
                                    ? 'border-emerald-400/60 bg-emerald-950/60 text-emerald-300'
                                    : 'border-cyan-400/60 bg-cyan-950/60 text-cyan-300'
                                }`}
                                title={currentStageInfo.homeOrigin}
                              >
                                {currentStageInfo.type === 'knockout'
                                  ? `🏆 ${currentStageInfo.homeOrigin}`
                                  : `🛡️ Grp ${currentStageInfo.group} (#${currentStageInfo.homeStats?.rank ?? '-'} · ${currentStageInfo.homeStats?.points ?? 0}p)`}
                              </span>
                            )}
                            <img
                              src={playerMap.get(currentFixture.home)?.avatarUrl}
                              alt={playerMap.get(currentFixture.home)?.team || currentFixture.home}
                              className="h-11 w-11 sm:h-13 sm:w-13 rounded-full border border-[#3ce7ff] object-cover shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <span className="mt-1.5 block font-sports text-xs sm:text-base text-white truncate max-w-[105px] sm:max-w-[160px] font-bold">
                              {playerMap.get(currentFixture.home)?.team || currentFixture.home}
                            </span>
                            <span className="text-[10px] text-[#3ce7ff] mb-2 font-medium">Home</span>

                            {/* Home Score Stepper */}
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <button
                                type="button"
                                onClick={() => setHomeScore((prev) => String(Math.max(0, (Number(prev) || 0) - 1)))}
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] active:scale-95 transition-all shadow-sm"
                                title="Decrease home score"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                required
                                value={homeScore}
                                onChange={(e) => setHomeScore(e.target.value)}
                                placeholder="0"
                                className="w-11 sm:w-16 rounded-lg border-2 border-[#3ce7ff] bg-[#030632] py-1.5 sm:py-2 text-center font-sports text-xl sm:text-2xl text-[#eaff28] focus:border-[#eaff28] focus:outline-none shadow-inner"
                              />
                              <button
                                type="button"
                                onClick={() => setHomeScore((prev) => String((Number(prev) || 0) + 1))}
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] active:scale-95 transition-all shadow-sm"
                                title="Increase home score"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Center VS Divider */}
                          <div className="flex flex-col items-center justify-center px-1 sm:px-2 pt-6 sm:pt-8">
                            <div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full border border-[#3ce7ff]/40 bg-[#071360] text-center font-sports text-xs sm:text-sm font-black text-[#eaff28] shadow-[0_0_10px_rgba(60,231,255,0.2)]">
                              VS
                            </div>
                            <span className="mt-1 text-[9px] uppercase tracking-wider text-[#8e9bd4] font-semibold">
                              Match
                            </span>
                          </div>

                          {/* Away Side with Stepper */}
                          <div className="flex flex-col items-center text-center">
                            {/* Group or Knockout Origin Tag */}
                            {(selectedFormat === 'knockout' || selectedFormat === 'group_knockout' || selectedFormat === 'knockout_cup' || selectedFormat === 'group_stage') && currentStageInfo && (
                              <span
                                className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border truncate max-w-[100px] sm:max-w-[150px] ${
                                  currentStageInfo.type === 'knockout'
                                    ? 'border-[#eaff28]/60 bg-[#eaff28]/15 text-[#eaff28]'
                                    : currentStageInfo.group === 'A'
                                    ? 'border-emerald-400/60 bg-emerald-950/60 text-emerald-300'
                                    : 'border-cyan-400/60 bg-cyan-950/60 text-cyan-300'
                                }`}
                                title={currentStageInfo.awayOrigin}
                              >
                                {currentStageInfo.type === 'knockout'
                                  ? `🏆 ${currentStageInfo.awayOrigin}`
                                  : `🛡️ Grp ${currentStageInfo.group} (#${currentStageInfo.awayStats?.rank ?? '-'} · ${currentStageInfo.awayStats?.points ?? 0}p)`}
                              </span>
                            )}
                            <img
                              src={playerMap.get(currentFixture.away)?.avatarUrl}
                              alt={playerMap.get(currentFixture.away)?.team || currentFixture.away}
                              className="h-11 w-11 sm:h-13 sm:w-13 rounded-full border border-[#3ce7ff] object-cover shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <span className="mt-1.5 block font-sports text-xs sm:text-base text-white truncate max-w-[105px] sm:max-w-[160px] font-bold">
                              {playerMap.get(currentFixture.away)?.team || currentFixture.away}
                            </span>
                            <span className="text-[10px] text-[#3ce7ff] mb-2 font-medium">Away</span>

                            {/* Away Score Stepper */}
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <button
                                type="button"
                                onClick={() => setAwayScore((prev) => String(Math.max(0, (Number(prev) || 0) - 1)))}
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] active:scale-95 transition-all shadow-sm"
                                title="Decrease away score"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                required
                                value={awayScore}
                                onChange={(e) => setAwayScore(e.target.value)}
                                placeholder="0"
                                className="w-11 sm:w-16 rounded-lg border-2 border-[#3ce7ff] bg-[#030632] py-1.5 sm:py-2 text-center font-sports text-xl sm:text-2xl text-[#eaff28] focus:border-[#eaff28] focus:outline-none shadow-inner"
                              />
                              <button
                                type="button"
                                onClick={() => setAwayScore((prev) => String((Number(prev) || 0) + 1))}
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg border border-[#3ce7ff]/40 bg-[#071360] flex items-center justify-center text-xs font-bold text-white hover:bg-[#3ce7ff] hover:text-[#050842] active:scale-95 transition-all shadow-sm"
                                title="Increase away score"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 border-t border-[#3ce7ff]/15">
                          <span className="text-[10px] font-semibold text-[#8e9bd4] uppercase tracking-wider mr-1">
                            Quick Score Presets:
                          </span>
                          {[
                            ['1', '0'],
                            ['2', '1'],
                            ['2', '0'],
                            ['3', '1'],
                            ['1', '1'],
                            ['0', '1'],
                            ['1', '2'],
                            ['0', '2'],
                          ].map(([h, a]) => (
                            <button
                              key={`${h}-${a}`}
                              type="button"
                              onClick={() => {
                                setHomeScore(h);
                                setAwayScore(a);
                              }}
                              className="rounded-md border border-[#3ce7ff]/30 bg-[#071056] px-2 py-0.5 text-[10px] font-sports font-bold text-[#b9c4f0] hover:text-[#eaff28] hover:border-[#eaff28] transition-colors active:scale-95"
                            >
                              {h} - {a}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Knockout Match Penalty Shootout Box (Required if score is level) */}
                    {currentFixture?.isKnockout &&
                      entryMode === 'score' &&
                      homeScore !== '' &&
                      awayScore !== '' &&
                      Number(homeScore) === Number(awayScore) && (
                        <div className="mt-4 rounded-xl border-2 border-[#eaff28] bg-gradient-to-b from-[#0c187a] to-[#050942] p-4 text-center space-y-3 shadow-lg">
                          <div className="flex items-center justify-center gap-2">
                            <Trophy className="h-4 w-4 text-[#eaff28]" />
                            <span className="font-sports text-sm text-[#eaff28] uppercase tracking-wide">
                              Knockout Match Level ({homeScore} - {awayScore}) · Penalty Shootout Winner Required
                            </span>
                          </div>
                          <p className="text-xs text-[#b9c4f0]">
                            Knockout matches cannot end in a draw. Please designate the winner who advanced via penalties:
                          </p>

                          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                            <button
                              type="button"
                              onClick={() => setPenaltyWinner(currentFixture.home)}
                              className={`rounded-xl border p-2.5 text-xs font-bold transition-all ${
                                penaltyWinner === currentFixture.home
                                  ? 'border-[#eaff28] bg-[#eaff28] text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] font-black scale-105'
                                  : 'border-[#3ce7ff]/40 bg-[#060a48] text-white hover:border-[#eaff28]'
                              }`}
                            >
                              <span className="block truncate">
                                🏆 {playerMap.get(currentFixture.home)?.team || currentFixture.home}
                              </span>
                              <span className="block text-[10px] text-[#3ce7ff] font-mono">
                                {penaltyWinner === currentFixture.home ? 'Shootout Winner ✓' : 'Click if won on PK'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPenaltyWinner(currentFixture.away)}
                              className={`rounded-xl border p-2.5 text-xs font-bold transition-all ${
                                penaltyWinner === currentFixture.away
                              ? 'border-[#eaff28] bg-[#eaff28] text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] font-black scale-105'
                              : 'border-[#3ce7ff]/40 bg-[#060a48] text-white hover:border-[#eaff28]'
                              }`}
                            >
                              <span className="block truncate">
                                🏆 {playerMap.get(currentFixture.away)?.team || currentFixture.away}
                              </span>
                              <span className="block text-[10px] text-[#3ce7ff] font-mono">
                                {penaltyWinner === currentFixture.away ? 'Shootout Winner ✓' : 'Click if won on PK'}
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-xs text-[#b9c4f0] pt-1">
                            <span>Shootout Score (Optional):</span>
                            <input
                              type="number"
                              min="0"
                              value={penaltyHomeScore}
                              onChange={(e) => setPenaltyHomeScore(e.target.value)}
                              placeholder="5"
                              className="w-12 rounded border border-[#3ce7ff]/50 bg-[#030632] px-2 py-1 text-center font-sports text-white text-xs"
                            />
                            <span className="font-bold text-[#eaff28]">PK</span>
                            <input
                              type="number"
                              min="0"
                              value={penaltyAwayScore}
                              onChange={(e) => setPenaltyAwayScore(e.target.value)}
                              placeholder="4"
                              className="w-12 rounded border border-[#3ce7ff]/50 bg-[#030632] px-2 py-1 text-center font-sports text-white text-xs"
                            />
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Postponement Configuration Box */}
                {currentFixture && entryMode === 'postpone' && (
                  <div className="rounded-xl border border-amber-400/40 bg-gradient-to-b from-[#09115d] to-[#050842] p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-400/20 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <h4 className="font-sports text-sm text-white uppercase tracking-wider">
                          Postpone Match: {currentFixture.home} vs {currentFixture.away}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-amber-300">
                        MD {currentFixture.matchday}
                      </span>
                    </div>

                    <p className="text-xs text-[#b9c4f0]">
                      Marking a match as postponed holds it for another day. It will remain clearly marked on the schedule and will not affect points, goal difference, or table rankings until officially played.
                    </p>

                    {/* Quick Preset Reasons */}
                    <div>
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-400 mb-1.5">
                        Choose Postponement Reason:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Postponed for other day',
                          'Player unavailable / Offline',
                          'Connection / Lag issues',
                          'Rescheduled by Admin',
                          'Time conflict',
                          'Mutual agreement',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPostponedReason(preset)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors border ${
                              postponedReason === preset
                                ? 'border-amber-400 bg-amber-400 text-[#050842] font-bold shadow-sm'
                                : 'border-[#3ce7ff]/30 bg-[#060a48] text-[#b9c4f0] hover:text-white hover:border-amber-400/60'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#b9c4f0] mb-1">
                          Custom Reason / Notes:
                        </label>
                        <input
                          type="text"
                          value={postponedReason}
                          onChange={(e) => setPostponedReason(e.target.value)}
                          placeholder="e.g. Postponed for other day, player not available..."
                          className="w-full rounded-xl border border-[#3ce7ff]/50 bg-[#050842] px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#b9c4f0] mb-1">
                          Rescheduled To (Optional):
                        </label>
                        <select
                          value={rescheduledMatchday}
                          onChange={(e) => setRescheduledMatchday(e.target.value)}
                          className="w-full rounded-xl border border-[#3ce7ff]/50 bg-[#050842] px-3.5 py-2 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
                        >
                          <option value="">Later Date (TBD / Pending)</option>
                          {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              Reschedule to Matchday {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {scoreFeedback && (
                  <div
                    className={`rounded-xl border p-3 text-xs font-semibold ${
                      scoreFeedback.isError
                        ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                        : 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    }`}
                  >
                    {scoreFeedback.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {entryMode === 'postpone' ? (
                    <button
                      type="submit"
                      disabled={!currentFixture}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#08104e] shadow-[0_0_15px_rgba(251,191,36,0.35)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <Clock className="h-4 w-4" />
                      <span>Save Match as Postponed for Other Day</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!currentFixture}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#eaff28] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-[#08104e] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 shadow-[0_0_15px_rgba(234,255,40,0.35)]"
                    >
                      <CheckCircle2 className="h-4 w-4 text-[#08104e]" />
                      <span>
                        {isCurrentCompleted
                          ? `Update Recorded Score (${currentResult?.home_score}-${currentResult?.away_score} → ${homeScore || '0'}-${awayScore || '0'})`
                          : isCurrentPostponed
                          ? 'Publish Played Score (Clear Postponement)'
                          : 'Save & Publish Result'}
                      </span>
                    </button>
                  )}
                </div>
              </form>

              {/* ========================================================================= */}
              {/* PARTITIONED MATCH CENTER: UPCOMING MATCHES & MATCH RESULTS                */}
              {/* ========================================================================= */}
              <div className="mt-8 border-t border-[#3ce7ff]/20 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="font-sports text-base text-white flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-[#eaff28]" />
                      <span>Tournament Matches &amp; Records Partition</span>
                    </h4>
                    <p className="text-[11px] text-[#b9c4f0]">
                      Partitioned sections: upcoming matches strictly only with itself, and recorded match results strictly only with itself.
                    </p>
                  </div>

                  {/* Partition Switcher Tabs: Fully fitted edge-to-edge */}
                  <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#3ce7ff]/30 bg-[#04083a] p-1 shadow-inner w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setAdminMatchPartition('upcoming')}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                        adminMatchPartition === 'upcoming'
                          ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
                          : 'text-[#b9c4f0] hover:text-white hover:bg-[#071360]'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>Upcoming ({partitionUpcomingFixtures.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminMatchPartition('results')}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                        adminMatchPartition === 'results'
                          ? 'bg-[#eaff28] text-[#050842] font-black shadow-md'
                          : 'text-[#b9c4f0] hover:text-white hover:bg-[#071360]'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Results ({partitionCompletedResults.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminMatchPartition('both')}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all ${
                        adminMatchPartition === 'both'
                          ? 'bg-[#071360] text-white border border-[#3ce7ff]/50 font-black'
                          : 'text-[#8e9bd4] hover:text-white hover:bg-[#071360]'
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span>Both</span>
                    </button>
                  </div>
                </div>

                {/* Optional Search / Filter for Partitioned Lists */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      value={adminPartitionSearch}
                      onChange={(e) => setAdminPartitionSearch(e.target.value)}
                      placeholder="Filter by club or @username..."
                      className="w-full rounded-xl border border-[#3ce7ff]/30 bg-[#040838] px-3 py-1.5 text-xs text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
                    />
                    {adminPartitionSearch && (
                      <button
                        type="button"
                        onClick={() => setAdminPartitionSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8e9bd4] hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. UPCOMING MATCHES ONLY PARTITION */}
                {(adminMatchPartition === 'upcoming' || adminMatchPartition === 'both') && (
                  <div className={`space-y-2 ${adminMatchPartition === 'both' ? 'mb-6' : ''}`}>
                    <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#3ce7ff]" />
                        <h5 className="font-sports text-sm font-black text-white uppercase tracking-wider">
                          Upcoming Matches Partition ({partitionUpcomingFixtures.filter((f) => {
                            if (!adminPartitionSearch.trim()) return true;
                            const q = adminPartitionSearch.toLowerCase();
                            const hP = playerMap.get(f.home);
                            const aP = playerMap.get(f.away);
                            return (
                              f.home.toLowerCase().includes(q) ||
                              f.away.toLowerCase().includes(q) ||
                              (hP?.team && hP.team.toLowerCase().includes(q)) ||
                              (aP?.team && aP.team.toLowerCase().includes(q))
                            );
                          }).length} Scheduled / Pending)
                        </h5>
                      </div>
                      <span className="text-[10px] text-[#3ce7ff] font-mono">
                        Upcoming Matches Only
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 max-h-80 overflow-y-auto pr-1">
                      {partitionUpcomingFixtures
                        .filter((f) => {
                          if (!adminPartitionSearch.trim()) return true;
                          const q = adminPartitionSearch.toLowerCase();
                          const hP = playerMap.get(f.home);
                          const aP = playerMap.get(f.away);
                          return (
                            f.home.toLowerCase().includes(q) ||
                            f.away.toLowerCase().includes(q) ||
                            (hP?.team && hP.team.toLowerCase().includes(q)) ||
                            (aP?.team && aP.team.toLowerCase().includes(q))
                          );
                        })
                        .map((f) => {
                          const hP = playerMap.get(f.home);
                          const aP = playerMap.get(f.away);
                          const existingRes = results.find(
                            (r) =>
                              r.matchday === f.matchday &&
                              r.home_user === f.home &&
                              r.away_user === f.away
                          );
                          const isPpd = !!existingRes?.isPostponed;

                          return (
                            <div
                              key={f.id}
                              className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-colors ${
                                currentFixture?.matchday === f.matchday &&
                                currentFixture?.home === f.home &&
                                currentFixture?.away === f.away
                                  ? 'border-[#eaff28] bg-[#071360] ring-1 ring-[#eaff28]'
                                  : 'border-[#3ce7ff]/25 bg-[#03072c] hover:border-[#3ce7ff]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#3ce7ff] mb-1">
                                  <span className="rounded bg-[#071158] px-1.5 py-0.5 font-bold">
                                    MD {f.matchday}
                                  </span>
                                  <span>{f.stage || (f.group ? `Group ${f.group}` : 'Scheduled')}</span>
                                  {isPpd && (
                                    <span className="rounded bg-amber-500/20 px-1 py-0.5 text-amber-300 font-bold">
                                      Postponed
                                    </span>
                                  )}
                                </div>

                                {/* Home vs Away straight rows with usernames */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={hP?.avatarUrl}
                                      alt=""
                                      className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff]/60 shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="text-[11px] font-sports font-bold text-white truncate leading-tight tracking-normal">
                                      {hP?.team || f.home}
                                    </span>
                                    <span className="text-[8.5px] text-[#3ce7ff] font-mono truncate leading-none">
                                      @{f.home}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <img
                                      src={aP?.avatarUrl}
                                      alt=""
                                      className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff]/60 shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="text-[11px] font-sports font-bold text-white truncate leading-tight tracking-normal">
                                      {aP?.team || f.away}
                                    </span>
                                    <span className="text-[8.5px] text-[#3ce7ff] font-mono truncate leading-none">
                                      @{f.away}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action: Record Score */}
                              <div className="shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    hasUserManuallySelectedRef.current = true;
                                    setMatchday(f.matchday);
                                    const mdFixtures = fixtures.filter((fx) => fx.matchday === f.matchday);
                                    const idx = mdFixtures.findIndex(
                                      (fx) => fx.home === f.home && fx.away === f.away
                                    );
                                    if (idx >= 0) {
                                      setSelectedFixtureIdx(idx);
                                    }
                                    const formEl = document.querySelector('section#admin form');
                                    if (formEl) {
                                      formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                    }
                                    if (onToast) onToast(`Loaded MD ${f.matchday} into score form above!`, 'info');
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-[#3ce7ff]/60 bg-[#071360] px-2.5 py-1 text-[10px] font-extrabold text-[#3ce7ff] hover:bg-[#3ce7ff] hover:text-[#050842] transition-colors"
                                >
                                  <PlayCircle className="h-3 w-3" />
                                  <span>Record</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {partitionUpcomingFixtures.length === 0 && (
                        <div className="col-span-2 text-center text-xs text-[#8e9bd4] italic py-6 border border-dashed border-[#3ce7ff]/20 rounded-xl">
                          All tournament matches have concluded! No pending fixtures left.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. MATCH RESULTS ONLY PARTITION */}
                {(adminMatchPartition === 'results' || adminMatchPartition === 'both') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[#eaff28]" />
                        <h5 className="font-sports text-sm font-black text-white uppercase tracking-wider">
                          Match Results Partition ({partitionCompletedResults.filter((r) => {
                            if (!adminPartitionSearch.trim()) return true;
                            const q = adminPartitionSearch.toLowerCase();
                            const hP = playerMap.get(r.home_user);
                            const aP = playerMap.get(r.away_user);
                            return (
                              r.home_user.toLowerCase().includes(q) ||
                              r.away_user.toLowerCase().includes(q) ||
                              (hP?.team && hP.team.toLowerCase().includes(q)) ||
                              (aP?.team && aP.team.toLowerCase().includes(q))
                            );
                          }).length} Completed)
                        </h5>
                      </div>
                      <span className="text-[10px] text-[#eaff28] font-mono">
                        Match Results Only
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 max-h-80 overflow-y-auto pr-1">
                      {partitionCompletedResults
                        .filter((r) => {
                          if (!adminPartitionSearch.trim()) return true;
                          const q = adminPartitionSearch.toLowerCase();
                          const hP = playerMap.get(r.home_user);
                          const aP = playerMap.get(r.away_user);
                          return (
                            r.home_user.toLowerCase().includes(q) ||
                            r.away_user.toLowerCase().includes(q) ||
                            (hP?.team && hP.team.toLowerCase().includes(q)) ||
                            (aP?.team && aP.team.toLowerCase().includes(q))
                          );
                        })
                        .map((r) => {
                          const hP = playerMap.get(r.home_user);
                          const aP = playerMap.get(r.away_user);
                          const isHomeWinner = r.home_score > r.away_score || r.penaltyWinner === r.home_user;
                          const isAwayWinner = r.away_score > r.home_score || r.penaltyWinner === r.away_user;

                          return (
                            <div
                              key={r.id}
                              className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-colors ${
                                currentFixture?.matchday === r.matchday &&
                                currentFixture?.home === r.home_user &&
                                currentFixture?.away === r.away_user
                                  ? 'border-[#eaff28] bg-[#071360] ring-1 ring-[#eaff28]'
                                  : 'border-[#3ce7ff]/20 bg-[#050842]/90 hover:border-[#3ce7ff]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#8e9bd4] mb-1">
                                  <span className="rounded bg-[#071158] px-1.5 py-0.5 text-[#3ce7ff] font-bold">
                                    MD {r.matchday}
                                  </span>
                                  <span>{r.stage || 'Recorded Match'}</span>
                                  <span className="text-emerald-400 font-bold uppercase">FT</span>
                                </div>

                                {/* Straight team and score rows */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between pr-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <img
                                        src={hP?.avatarUrl}
                                        alt=""
                                        className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff]/60 shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className={`text-[11px] font-sports truncate leading-tight font-bold tracking-normal ${isHomeWinner ? 'text-[#eaff28]' : 'text-white'}`}>
                                        {hP?.team || r.home_user}
                                      </span>
                                      <span className="text-[8.5px] text-[#3ce7ff] font-mono truncate leading-none">
                                        @{r.home_user}
                                      </span>
                                    </div>
                                    <span className="font-sports text-xs font-black text-white bg-[#071360] border border-[#3ce7ff]/30 px-1.5 py-0.5 rounded">
                                      {r.home_score}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pr-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <img
                                        src={aP?.avatarUrl}
                                        alt=""
                                        className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff]/60 shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className={`text-[11px] font-sports truncate leading-tight font-bold tracking-normal ${isAwayWinner ? 'text-[#eaff28]' : 'text-white'}`}>
                                        {aP?.team || r.away_user}
                                      </span>
                                      <span className="text-[8.5px] text-[#3ce7ff] font-mono truncate leading-none">
                                        @{r.away_user}
                                      </span>
                                    </div>
                                    <span className="font-sports text-xs font-black text-white bg-[#071360] border border-[#3ce7ff]/30 px-1.5 py-0.5 rounded">
                                      {r.away_score}
                                    </span>
                                  </div>
                                </div>

                                {r.penaltyWinner && (
                                  <div className="text-[8.5px] text-[#eaff28] font-mono mt-1 pt-1 border-t border-[#3ce7ff]/10">
                                    Penalties: @{r.penaltyWinner} won
                                  </div>
                                )}
                              </div>

                              {/* Action Controls: Edit & Delete */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    hasUserManuallySelectedRef.current = true;
                                    setMatchday(r.matchday);
                                    const mdFixtures = fixtures.filter((f) => f.matchday === r.matchday);
                                    const idx = mdFixtures.findIndex(
                                      (f) => f.home === r.home_user && f.away === r.away_user
                                    );
                                    if (idx >= 0) {
                                      setSelectedFixtureIdx(idx);
                                    }
                                    const formEl = document.querySelector('section#admin form');
                                    if (formEl) {
                                      formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                    }
                                    if (onToast) onToast(`Loaded score for MD ${r.matchday} into editor!`, 'info');
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-[#eaff28]/50 bg-[#eaff28]/10 px-2 py-1 text-[10px] font-extrabold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#08104e] transition-colors"
                                  title="Edit this recorded match score"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onDeleteResult(r.id)}
                                  className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                                  title="Delete this match score"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {partitionCompletedResults.length === 0 && (
                        <div className="col-span-2 text-center text-xs text-[#8e9bd4] italic py-6 border border-dashed border-[#3ce7ff]/20 rounded-xl">
                          No match results recorded yet. Use the score entry form above or Upcoming Matches partition to record scores.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Suite Section: Tournament Stats & Deep Insights */}
            <TournamentStatsSection
              players={players}
              fixtures={fixtures}
              results={results}
              tournamentFormat={tournamentFormat}
              onToast={onToast}
            />

            {/* Suite Section: Official Graphics & Image Exporter (PNG) - Admin Only */}
            <AdminMediaExporter
              players={players}
              fixtures={fixtures}
              results={results}
              tournamentFormat={tournamentFormat}
              groupStageConfig={groupStageConfig}
              onToast={onToast}
            />

            {/* Suite Section 3: Data Management & Backup */}
            <section className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070b4a] p-5 sm:p-7 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-sports text-xl text-white">Data Management & Backup</h3>
                  <p className="mt-1 text-xs text-[#b9c4f0]">
                    Export tournament records to JSON, restore backups, or reset results to re-open player registration.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onExportData}
                    className="flex items-center gap-1.5 rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] px-4 py-2 text-xs font-bold text-white transition-colors hover:border-[#3ce7ff]"
                  >
                    <Download className="h-4 w-4 text-[#3ce7ff]" />
                    <span>Export JSON</span>
                  </button>

                  <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] px-4 py-2 text-xs font-bold text-white transition-colors hover:border-[#3ce7ff]">
                    <Upload className="h-4 w-4 text-[#3ce7ff]" />
                    <span>Import JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={onImportData}
                      className="hidden"
                    />
                  </label>

                  {onPurgeOldData && (
                    <button
                      type="button"
                      onClick={onPurgeOldData}
                      className="flex items-center gap-1.5 rounded-xl border border-[#eaff28]/60 bg-[#071360] px-4 py-2 text-xs font-bold text-[#eaff28] transition-colors hover:border-[#eaff28] hover:bg-[#eaff28]/20"
                      title="Purges obsolete records, old member scores, and cleans database space on Firebase"
                    >
                      <Sparkles className="h-4 w-4 text-[#eaff28]" />
                      <span>Purge Old Member Data on Firebase</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onResetData}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-950/60 px-4 py-2 text-xs font-bold text-rose-300 transition-colors hover:border-rose-400 hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Reset Results (Re-Open Registration)</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
};
