import React, { useState, useRef, useMemo, useCallback } from 'react';
import { exportElementToPng, downloadDataUrl } from '../utils/exportImage';
import {
  Download,
  Image,
  Calendar,
  Trophy,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Medal,
  Swords,
  ChevronRight,
  Flame,
  LayoutGrid,
  Award,
  Users,
} from 'lucide-react';
import {
  Player,
  Fixture,
  MatchResult,
  TournamentFormat,
  GroupStageConfig,
} from '../types/tournament';
import { buildSymmetricalBracket, BracketTieModel } from '../utils/bracketEngine';
import { calculateStandings } from '../utils/standings';
import {
  partitionPlayersIntoGroups,
  calculateGroupStandings,
  DEFAULT_GROUP_CONFIG,
} from '../utils/groupStage';
import { PlayerStatsExportCard, PlayerStatEntry } from './PlayerStatsExportCard';
import { PlayerRevealExportCard } from './PlayerRevealExportCard';
import { BatchPlayerRevealExportCard } from './BatchPlayerRevealExportCard';
import { TotalRosterExportCard } from './TotalRosterExportCard';
import { EFootballLogo } from './EFootballLogo';

interface AdminMediaExporterProps {
  players: Player[];
  fixtures: Fixture[];
  results: MatchResult[];
  tournamentFormat?: TournamentFormat;
  groupStageConfig?: GroupStageConfig;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type ExportTab =
  | 'bracket'
  | 'results'
  | 'upcoming'
  | 'fixtures'
  | 'standings'
  | 'stats'
  | 'player_reveal'
  | 'total_roster';

export const AdminMediaExporter: React.FC<AdminMediaExporterProps> = ({
  players,
  fixtures,
  results,
  tournamentFormat = 'league_double',
  groupStageConfig = DEFAULT_GROUP_CONFIG,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('results');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMatchday, setSelectedMatchday] = useState<number | 'upcoming'>('upcoming');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedRevealPlayerId, setSelectedRevealPlayerId] = useState<string>('');
  const [revealMode, setRevealMode] = useState<'single' | 'batch'>('single');
  const [selectedBatchPlayerIds, setSelectedBatchPlayerIds] = useState<string[]>([]);

  // DOM Refs to exportable elements
  const bracketExportRef = useRef<HTMLDivElement>(null);
  const resultsExportRef = useRef<HTMLDivElement>(null);
  const upcomingExportRef = useRef<HTMLDivElement>(null);
  const fixturesExportRef = useRef<HTMLDivElement>(null);
  const standingsExportRef = useRef<HTMLDivElement>(null);
  const statsExportRef = useRef<HTMLDivElement>(null);
  const playerRevealExportRef = useRef<HTMLDivElement>(null);
  const batchRevealExportRef = useRef<HTMLDivElement>(null);
  const totalRosterExportRef = useRef<HTMLDivElement>(null);

  // Selected player for reveal card
  const selectedRevealPlayer = useMemo(() => {
    if (selectedRevealPlayerId) {
      const found = players.find((p) => p.id === selectedRevealPlayerId);
      if (found) return found;
    }
    return players[players.length - 1] || players[0];
  }, [players, selectedRevealPlayerId]);

  const selectedRevealPlayerNumber = useMemo(() => {
    if (!selectedRevealPlayer) return 1;
    const idx = players.findIndex((p) => p.id === selectedRevealPlayer.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [players, selectedRevealPlayer]);

  // Players to reveal together in batch mode
  const batchPlayers = useMemo(() => {
    if (selectedBatchPlayerIds.length > 0) {
      const filtered = players.filter((p) => selectedBatchPlayerIds.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    // Default to all players up to 6
    return players.slice(0, 6);
  }, [players, selectedBatchPlayerIds]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.user, p])), [players]);

  // Total matchdays
  const totalMatchdays = useMemo(() => {
    return fixtures.length > 0 ? Math.max(...fixtures.map((f) => f.matchday)) : 10;
  }, [fixtures]);

  // Symmetrical Bracket Data
  const bracketData = useMemo(() => {
    return buildSymmetricalBracket(players, results, tournamentFormat, groupStageConfig);
  }, [players, results, tournamentFormat, groupStageConfig]);

  const isGroupMode = tournamentFormat === 'group_knockout' || tournamentFormat === 'group_stage';

  // Group Stage Standings if applicable
  const groupData = useMemo(() => {
    if (!isGroupMode) return null;
    return partitionPlayersIntoGroups(players, groupStageConfig, results);
  }, [players, isGroupMode, groupStageConfig, results]);

  // Overall or Group Standings
  const standings = useMemo(() => {
    if (isGroupMode && groupData) {
      if (selectedGroup !== 'all' && groupData.groups[selectedGroup]) {
        const calc = calculateGroupStandings(
          groupData.groups[selectedGroup],
          results,
          groupStageConfig.qualifiersPerGroup,
          groupStageConfig.manualTieBreakers?.[selectedGroup]
        );
        return calc.standings;
      } else {
        const allGroupStandings: Player[] = [];
        groupData.groupLetters.forEach((l) => {
          const calc = calculateGroupStandings(
            groupData.groups[l] || [],
            results,
            groupStageConfig.qualifiersPerGroup,
            groupStageConfig.manualTieBreakers?.[l]
          );
          allGroupStandings.push(...calc.standings);
        });
        return allGroupStandings;
      }
    }
    return calculateStandings(players, results);
  }, [players, results, isGroupMode, groupData, selectedGroup, groupStageConfig]);

  // Filtered fixtures for the fixtures poster
  const displayedFixtures = useMemo(() => {
    if (selectedMatchday === 'upcoming') {
      const pending = fixtures.filter((f) => {
        const res = results.find(
          (r) =>
            r.isKnockout === f.isKnockout &&
            r.matchday === f.matchday &&
            ((r.home_user === f.home && r.away_user === f.away) ||
              (r.home_user === f.away && r.away_user === f.home))
        );
        return !res || res.isPostponed;
      });
      return pending.length > 0 ? pending : fixtures.slice(0, 12);
    }
    return fixtures.filter((f) => f.matchday === selectedMatchday);
  }, [fixtures, results, selectedMatchday]);

  // Completed results vs upcoming
  const completedResults = useMemo(() => {
    return results
      .filter((r) => !r.isPostponed)
      .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  }, [results]);

  const upcomingFixtures = useMemo(() => {
    return fixtures
      .filter((f) => {
        const r = results.find(
          (res) =>
            res.isKnockout === f.isKnockout &&
            res.matchday === f.matchday &&
            ((res.home_user === f.home && res.away_user === f.away) ||
              (res.home_user === f.away && res.away_user === f.home))
        );
        return !r || r.isPostponed;
      })
      .slice(0, 8);
  }, [fixtures, results]);

  // Player Status & Competition Statistics Data for Media Exporter
  const {
    allScorers,
    allCleanSheets,
    allLosses,
    top5Scorers,
    top5CleanSheets,
    top5Losses,
    totalGoalsScored,
    totalHomeGoals,
    totalAwayGoals,
    averageGoalsPerMatch,
    totalCleanSheets,
    highestMatch,
    biggestBlowout,
    outcomeStats,
    completionPct,
  } = useMemo(() => {
    const validResults = results.filter((r) => !r.isPostponed);
    const pStats = new Map<string, PlayerStatEntry>();

    players.forEach((p) => {
      pStats.set(p.user.toLowerCase().trim(), {
        user: p.user,
        team: p.team,
        avatarUrl: p.avatarUrl || '',
        played: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        cleanSheets: 0,
        winRatePct: '0',
        points: 0,
      });
    });

    let homeGoals = 0;
    let awayGoals = 0;
    let totalCS = 0;
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let highest: { result: MatchResult; totalGoals: number; homeTeam: string; awayTeam: string } | null = null;
    let blowout: { result: MatchResult; diff: number; winner: string; winnerTeam: string; loser: string; loserTeam: string } | null = null;

    validResults.forEach((r) => {
      const hScore = r.home_score || 0;
      const aScore = r.away_score || 0;
      homeGoals += hScore;
      awayGoals += aScore;

      const hUser = (r.home_user || '').toLowerCase().trim();
      const aUser = (r.away_user || '').toLowerCase().trim();
      const homeP = playerMap.get(r.home_user);
      const awayP = playerMap.get(r.away_user);
      const homeTeam = homeP?.team || r.home_user;
      const awayTeam = awayP?.team || r.away_user;

      const hStat = pStats.get(hUser);
      const aStat = pStats.get(aUser);

      if (hStat) {
        hStat.played += 1;
        hStat.gf += hScore;
        hStat.ga += aScore;
        if (aScore === 0) hStat.cleanSheets += 1;
        if (hScore > aScore) {
          hStat.w += 1;
          hStat.points += 3;
        } else if (hScore === aScore) {
          hStat.d += 1;
          hStat.points += 1;
        } else {
          hStat.l += 1;
        }
      }

      if (aStat) {
        aStat.played += 1;
        aStat.gf += aScore;
        aStat.ga += hScore;
        if (hScore === 0) aStat.cleanSheets += 1;
        if (aScore > hScore) {
          aStat.w += 1;
          aStat.points += 3;
        } else if (aScore === hScore) {
          aStat.d += 1;
          aStat.points += 1;
        } else {
          aStat.l += 1;
        }
      }

      if (hScore === 0 || aScore === 0) {
        totalCS += 1;
      }

      if (hScore > aScore) {
        homeWins += 1;
      } else if (aScore > hScore) {
        awayWins += 1;
      } else {
        draws += 1;
      }

      const mGoals = hScore + aScore;
      if (!highest || mGoals > highest.totalGoals) {
        highest = { result: r, totalGoals: mGoals, homeTeam, awayTeam };
      }

      const diff = Math.abs(hScore - aScore);
      if (!blowout || diff > blowout.diff) {
        if (hScore > aScore) {
          blowout = { result: r, diff, winner: r.home_user, winnerTeam: homeTeam, loser: r.away_user, loserTeam: awayTeam };
        } else if (aScore > hScore) {
          blowout = { result: r, diff, winner: r.away_user, winnerTeam: awayTeam, loser: r.home_user, loserTeam: homeTeam };
        }
      }
    });

    const pList = Array.from(pStats.values()).map((p) => ({
      ...p,
      winRatePct: p.played > 0 ? ((p.w / p.played) * 100).toFixed(1) : '0',
    }));

    const allScorers = [...pList].sort((a, b) => {
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (a.played !== b.played) return a.played - b.played;
      if (b.points !== a.points) return b.points - a.points;
      return a.user.localeCompare(b.user);
    });

    const allCleanSheets = [...pList].sort((a, b) => {
      if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
      if (a.ga !== b.ga) return a.ga - b.ga;
      if (a.played !== b.played) return a.played - b.played;
      return a.user.localeCompare(b.user);
    });

    const allLosses = [...pList].sort((a, b) => {
      if (b.l !== a.l) return b.l - a.l;
      if (b.ga !== a.ga) return b.ga - a.ga;
      if (a.points !== b.points) return a.points - b.points;
      return a.user.localeCompare(b.user);
    });

    const top5Scorers = allScorers.slice(0, 5);
    const top5CleanSheets = allCleanSheets.slice(0, 5);
    const top5Losses = allLosses.slice(0, 5);

    const totalGoals = homeGoals + awayGoals;
    const avgGoals = validResults.length > 0 ? (totalGoals / validResults.length).toFixed(2) : '0.00';
    const cPct = fixtures.length > 0 ? Math.min(100, Math.round((validResults.length / fixtures.length) * 100)) : 0;

    const hPct = validResults.length > 0 ? ((homeWins / validResults.length) * 100).toFixed(1) : '0';
    const aPct = validResults.length > 0 ? ((awayWins / validResults.length) * 100).toFixed(1) : '0';
    const dPct = validResults.length > 0 ? ((draws / validResults.length) * 100).toFixed(1) : '0';

    return {
      allScorers,
      allCleanSheets,
      allLosses,
      top5Scorers,
      top5CleanSheets,
      top5Losses,
      totalGoalsScored: totalGoals,
      totalHomeGoals: homeGoals,
      totalAwayGoals: awayGoals,
      averageGoalsPerMatch: avgGoals,
      totalCleanSheets: totalCS,
      highestMatch: highest,
      biggestBlowout: blowout,
      outcomeStats: {
        homeWins,
        awayWins,
        draws,
        homeWinPct: hPct,
        awayWinPct: aPct,
        drawPct: dPct,
      },
      completionPct: cPct,
    };
  }, [results, players, fixtures, playerMap]);

  // General export handler
  const handleExport = useCallback(
    async (elementRef: React.RefObject<HTMLDivElement | null>, fileName: string) => {
      if (!elementRef.current) {
        if (onToast) onToast('Target element not ready for export.', 'error');
        return;
      }

      setIsExporting(true);
      try {
        const dataUrl = await exportElementToPng(elementRef.current, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#020520',
        });

        downloadDataUrl(dataUrl, `${fileName}-${Date.now()}`);
        if (onToast) onToast(`Official ${fileName} exported as PNG image!`, 'success');
      } catch (err) {
        console.error('Failed to export image:', err);
        if (onToast) onToast('Failed to generate image. Please try again.', 'error');
      } finally {
        setIsExporting(false);
      }
    },
    [onToast]
  );

  return (
    <section id="admin-media-exporter" className="rounded-2xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#070e52] to-[#030628] p-5 sm:p-7 shadow-[0_0_35px_rgba(60,231,255,0.15)] my-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/20 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#3ce7ff] to-[#050b40] text-[#050842] shadow-lg">
            <Image className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#eaff28] px-2 py-0.5 text-[9px] font-black uppercase text-[#050842]">
                Admin Only Exporter
              </span>
              <span className="text-xs text-[#3ce7ff] font-mono">PNG High-Resolution</span>
            </div>
            <h3 className="font-sports text-xl sm:text-2xl text-white font-black tracking-wide mt-0.5">
              Official Graphics &amp; Image Exporter
            </h3>
            <p className="text-xs text-[#b9c4f0]">
              Generate broadcast-quality official images for Telegram announcements, social media, and player channels.
            </p>
          </div>
        </div>

        {/* Current Tab Download Button */}
        <div>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => {
              if (activeTab === 'bracket') {
                handleExport(bracketExportRef, 'ethiopian-efootball-bracket');
              } else if (activeTab === 'results') {
                handleExport(resultsExportRef, 'ethiopian-efootball-match-results');
              } else if (activeTab === 'upcoming') {
                handleExport(upcomingExportRef, 'ethiopian-efootball-upcoming-matches');
              } else if (activeTab === 'fixtures') {
                handleExport(fixturesExportRef, 'ethiopian-efootball-matchday-fixtures');
              } else if (activeTab === 'standings') {
                handleExport(standingsExportRef, 'ethiopian-efootball-standings');
              } else if (activeTab === 'stats') {
                handleExport(statsExportRef, 'ethiopian-efootball-player-status-and-stats');
              } else if (activeTab === 'player_reveal') {
                if (revealMode === 'batch') {
                  handleExport(
                    batchRevealExportRef,
                    `ethiopian-efootball-new-players-reveal-batch-${batchPlayers.length}-players`
                  );
                } else {
                  handleExport(
                    playerRevealExportRef,
                    `ethiopian-efootball-player-reveal-${selectedRevealPlayer?.user || 'competitor'}`
                  );
                }
              } else if (activeTab === 'total_roster') {
                handleExport(totalRosterExportRef, 'ethiopian-efootball-total-registered-players');
              }
            }}
            className="flex items-center gap-2 rounded-xl border border-[#eaff28] bg-[#eaff28] hover:bg-[#d8ec1f] text-[#050842] px-4 py-2 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(234,255,40,0.4)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-4 w-4 stroke-[2.5]" />
            <span>{isExporting ? 'Generating PNG...' : 'Download Image (PNG)'}</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap md:flex-nowrap gap-2 mb-6 border-b border-[#3ce7ff]/15 pb-3 w-full">
        <button
          type="button"
          onClick={() => setActiveTab('player_reveal')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'player_reveal'
              ? 'bg-[#eaff28] text-[#050842] font-black shadow-md'
              : 'border border-[#eaff28]/40 bg-[#071360] text-[#eaff28] hover:border-[#eaff28]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-[#eaff28] stroke-[2.5]" />
          <span>New Player Reveal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('total_roster')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'total_roster'
              ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
              : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Total Registered Players</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'stats'
              ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
              : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>Player Status &amp; Stats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'results'
              ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
              : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>Match Results Bulletin</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'upcoming'
              ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
              : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Upcoming Matches Bulletin</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fixtures')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'fixtures'
              ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
              : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Matchday Schedule Table</span>
        </button>

        {(tournamentFormat === 'group_knockout' || tournamentFormat === 'group_stage' || tournamentFormat === 'knockout_cup') && (
          <button
            type="button"
            onClick={() => setActiveTab('bracket')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              activeTab === 'bracket'
                ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
                : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Cup Bracket Graphic</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('standings')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            activeTab === 'standings'
              ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
              : 'border border-[#3ce7ff]/30 bg-[#071360] text-white hover:border-[#3ce7ff]'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Standings / Table Graphic</span>
        </button>
      </div>

      {/* Options Toolbar depending on activeTab */}
      {activeTab === 'fixtures' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#05093e] p-3 rounded-xl border border-[#3ce7ff]/20 mb-4">
          <div className="flex items-center gap-2 text-xs text-[#b9c4f0]">
            <span className="font-bold text-white">Filter Matchday:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedMatchday('upcoming')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                  selectedMatchday === 'upcoming'
                    ? 'bg-[#eaff28] text-[#050842]'
                    : 'bg-[#071360] text-white hover:border-[#3ce7ff]'
                }`}
              >
                Next Upcoming Matches
              </button>
              {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((md) => (
                <button
                  key={`md-btn-${md}`}
                  type="button"
                  onClick={() => setSelectedMatchday(md)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    selectedMatchday === md
                      ? 'bg-[#3ce7ff] text-[#050842]'
                      : 'bg-[#071360] text-white hover:text-[#3ce7ff]'
                  }`}
                >
                  MD {md}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[11px] text-[#3ce7ff] font-mono">
            {displayedFixtures.length} matches will be rendered in image
          </span>
        </div>
      )}

      {activeTab === 'standings' && groupData && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#05093e] p-3 rounded-xl border border-[#3ce7ff]/20 mb-4">
          <div className="flex items-center gap-2 text-xs text-[#b9c4f0]">
            <span className="font-bold text-white">Group Selection:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                  selectedGroup === 'all'
                    ? 'bg-[#eaff28] text-[#050842]'
                    : 'bg-[#071360] text-white hover:text-[#eaff28]'
                }`}
              >
                All Groups
              </button>
              {groupData.groupLetters.map((l) => (
                <button
                  key={`grp-btn-${l}`}
                  type="button"
                  onClick={() => setSelectedGroup(l)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    selectedGroup === l
                      ? 'bg-[#3ce7ff] text-[#050842]'
                      : 'bg-[#071360] text-white hover:text-[#3ce7ff]'
                  }`}
                >
                  Group {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MATCH RESULTS ONLY BULLETIN EXPORT TARGET                                */}
      {/* ========================================================================= */}
      {activeTab === 'results' && (
        <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
          <div
            ref={resultsExportRef}
            className="w-[1240px] min-w-[1240px] mx-auto rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#050d4a] via-[#03072c] to-[#01041b] p-6 lg:p-8 shadow-2xl relative select-none"
            style={{ boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            {/* Header Stamp */}
            <div className="flex items-center justify-between border-b border-[#3ce7ff]/25 pb-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#eaff28] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#eaff28] p-2 shadow-lg">
                  <EFootballLogo className="h-7 w-7" />
                </div>
                <div style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                    <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
                    <p
                      className="font-efootball-stencil font-sports text-[11px] font-black uppercase tracking-wider text-[#eaff28] m-0 whitespace-nowrap inline-block"
                      style={{ lineHeight: '1.2', whiteSpace: 'nowrap', minWidth: 'max-content' }}
                    >
                      OFFICIAL MATCH RESULTS BULLETIN &middot; ETHIOPIAN eFOOTBALL
                    </p>
                  </div>
                  <h2
                    className="font-efootball-stencil font-sports text-2xl sm:text-3xl font-black text-white tracking-wide m-0 my-1"
                    style={{ lineHeight: '1.25' }}
                  >
                    OFFICIAL MATCH RESULTS
                  </h2>
                  <p
                    className="text-xs text-[#3ce7ff] font-mono m-0 mt-1"
                    style={{ lineHeight: '1.3' }}
                  >
                    Verified Final Scores &middot; Completed Matchday Records
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-1 text-[10px] font-black uppercase text-[#eaff28]">
                  Verified Records
                </span>
                <p className="text-[10px] text-[#8e9bd4] font-mono mt-1">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-3 gap-3 mb-6 bg-[#040938] p-3.5 rounded-2xl border border-[#3ce7ff]/20 text-center">
              <div>
                <span className="block text-2xl font-sports font-black text-white">
                  {completedResults.length}
                </span>
                <span className="text-[10px] uppercase text-[#8e9bd4] font-mono">Matches Completed</span>
              </div>
              <div className="border-x border-[#3ce7ff]/20">
                <span className="block text-2xl font-sports font-black text-[#eaff28]">
                  {completedResults.reduce((acc, r) => acc + r.home_score + r.away_score, 0)}
                </span>
                <span className="text-[10px] uppercase text-[#8e9bd4] font-mono">Total Goals Scored</span>
              </div>
              <div>
                <span className="block text-2xl font-sports font-black text-[#3ce7ff]">
                  {completedResults.length > 0
                    ? (completedResults.reduce((acc, r) => acc + r.home_score + r.away_score, 0) / completedResults.length).toFixed(1)
                    : '0.0'}
                </span>
                <span className="text-[10px] uppercase text-[#8e9bd4] font-mono">Avg Goals / Match</span>
              </div>
            </div>

            {/* All Results Grid */}
            <div className="grid grid-cols-2 gap-4">
              {completedResults.map((r) => {
                const homeP = playerMap.get(r.home_user);
                const awayP = playerMap.get(r.away_user);
                const isHomeWinner = r.home_score > r.away_score || r.penaltyWinner === r.home_user;
                const isAwayWinner = r.away_score > r.home_score || r.penaltyWinner === r.away_user;

                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-[#3ce7ff]/25 bg-[#050a48]/90 p-3 shadow-md"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#3ce7ff] mb-2 font-mono border-b border-[#3ce7ff]/15 pb-1">
                      <span>Matchday {r.matchday} &middot; {r.stage || 'Official Fixture'}</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                        FINAL FT
                      </span>
                    </div>

                    {/* Home Team */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <img
                          src={homeP?.avatarUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover border border-[#3ce7ff] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className={`text-[11.5px] font-sports block truncate leading-tight tracking-normal ${isHomeWinner ? 'text-[#eaff28] font-black' : 'text-white font-bold'}`}>
                            {homeP?.team || r.home_user}
                          </span>
                          <span className="text-[9px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5 tracking-normal">
                            @{r.home_user}
                          </span>
                        </div>
                      </div>
                      <span className="font-sports text-sm font-black text-white shrink-0 bg-[#071360] border border-[#3ce7ff]/30 px-2.5 py-0.5 rounded-lg leading-none">
                        {r.home_score}
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-between py-1 mt-1">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <img
                          src={awayP?.avatarUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover border border-[#3ce7ff] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className={`text-[11.5px] font-sports block truncate leading-tight tracking-normal ${isAwayWinner ? 'text-[#eaff28] font-black' : 'text-white font-bold'}`}>
                            {awayP?.team || r.away_user}
                          </span>
                          <span className="text-[9px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5 tracking-normal">
                            @{r.away_user}
                          </span>
                        </div>
                      </div>
                      <span className="font-sports text-sm font-black text-white shrink-0 bg-[#071360] border border-[#3ce7ff]/30 px-2.5 py-0.5 rounded-lg leading-none">
                        {r.away_score}
                      </span>
                    </div>

                    {r.penaltyWinner && (
                      <div className="text-[9px] text-[#eaff28] text-center font-mono mt-1.5 pt-1 border-t border-[#3ce7ff]/10">
                        Penalty Shootout Winner: @{r.penaltyWinner}
                      </div>
                    )}
                  </div>
                );
              })}
              {completedResults.length === 0 && (
                <div className="col-span-2 text-center text-xs text-[#8e9bd4] italic py-8 border border-dashed border-[#3ce7ff]/20 rounded-xl">
                  No completed match results recorded yet.
                </div>
              )}
            </div>

            {/* Poster Footer Stamp */}
            <div className="mt-8 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Official Ethiopian eFootball Certified Match Results</span>
              </span>
              <span>Telegram Announcement Broadcast</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UPCOMING MATCHES ONLY BULLETIN EXPORT TARGET                           */}
      {/* ========================================================================= */}
      {activeTab === 'upcoming' && (
        <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
          <div
            ref={upcomingExportRef}
            className="w-[1240px] min-w-[1240px] mx-auto rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#050d4a] via-[#03072c] to-[#01041b] p-6 lg:p-8 shadow-2xl relative select-none"
            style={{ boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            {/* Header Stamp */}
            <div className="flex items-center justify-between border-b border-[#3ce7ff]/25 pb-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#3ce7ff] p-2 shadow-lg">
                  <EFootballLogo className="h-7 w-7" />
                </div>
                <div style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                    <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
                    <p
                      className="font-efootball-stencil font-sports text-[11px] font-black uppercase tracking-wider text-[#eaff28] m-0 whitespace-nowrap inline-block"
                      style={{ lineHeight: '1.2', whiteSpace: 'nowrap', minWidth: 'max-content' }}
                    >
                      OFFICIAL MATCH SCHEDULE &middot; ETHIOPIAN eFOOTBALL
                    </p>
                  </div>
                  <h2
                    className="font-efootball-stencil font-sports text-2xl sm:text-3xl font-black text-white tracking-wide m-0 my-1"
                    style={{ lineHeight: '1.25' }}
                  >
                    UPCOMING MATCHES BULLETIN
                  </h2>
                  <p
                    className="text-xs text-[#3ce7ff] font-mono m-0 mt-1"
                    style={{ lineHeight: '1.3' }}
                  >
                    Scheduled Pairings &middot; Next Competitive Matchdays
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-1 text-[10px] font-black uppercase text-[#3ce7ff]">
                  Official Fixtures
                </span>
                <p className="text-[10px] text-[#8e9bd4] font-mono mt-1">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-3 gap-3 mb-6 bg-[#040938] p-3.5 rounded-2xl border border-[#3ce7ff]/20 text-center">
              <div>
                <span className="block text-2xl font-sports font-black text-[#3ce7ff]">
                  {upcomingFixtures.length}
                </span>
                <span className="text-[10px] uppercase text-[#8e9bd4] font-mono">Pending Fixtures</span>
              </div>
              <div className="border-x border-[#3ce7ff]/20">
                <span className="block text-2xl font-sports font-black text-[#eaff28]">
                  {totalMatchdays}
                </span>
                <span className="text-[10px] uppercase text-[#8e9bd4] font-mono">Total Matchdays</span>
              </div>
              <div>
                <span className="block text-2xl font-sports font-black text-white">
                  {players.length}
                </span>
                <span className="text-[10px] uppercase text-[#8e9bd4] font-mono">Active Players</span>
              </div>
            </div>

            {/* Upcoming Matches Grid */}
            <div className="grid grid-cols-2 gap-4">
              {upcomingFixtures.map((f) => {
                const homeP = playerMap.get(f.home);
                const awayP = playerMap.get(f.away);

                return (
                  <div
                    key={f.id}
                    className="rounded-xl border border-[#3ce7ff]/25 bg-[#03072c] p-3 shadow-md"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#8e9bd4] mb-2 font-mono border-b border-[#3ce7ff]/15 pb-1">
                      <span>Matchday {f.matchday} &middot; {f.stage || 'Online League'}</span>
                      <span className="rounded bg-[#3ce7ff]/15 px-2 py-0.5 text-[#3ce7ff] border border-[#3ce7ff]/30 font-bold uppercase">
                        SCHEDULED
                      </span>
                    </div>

                    <div className="space-y-1.5 py-1">
                      {/* Home Team Row */}
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-[#050a44] px-2.5 py-1.5 border border-[#3ce7ff]/15">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img
                            src={homeP?.avatarUrl}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover border border-[#3ce7ff]/60 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[11.5px] font-sports text-white block truncate font-bold leading-tight tracking-normal">
                              {homeP?.team || f.home}
                            </span>
                            <span className="text-[9px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5 tracking-normal">
                              @{f.home}
                            </span>
                          </div>
                        </div>
                        <span className="rounded bg-[#071360] border border-[#3ce7ff]/30 px-2 py-0.5 text-[8.5px] font-mono font-bold text-[#b9c4f0] shrink-0">
                          HOME
                        </span>
                      </div>

                      {/* Away Team Row */}
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-[#050a44] px-2.5 py-1.5 border border-[#3ce7ff]/15">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img
                            src={awayP?.avatarUrl}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover border border-[#3ce7ff]/60 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[11.5px] font-sports text-white block truncate font-bold leading-tight tracking-normal">
                              {awayP?.team || f.away}
                            </span>
                            <span className="text-[9px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5 tracking-normal">
                              @{f.away}
                            </span>
                          </div>
                        </div>
                        <span className="rounded bg-[#071360] border border-[#3ce7ff]/30 px-2 py-0.5 text-[8.5px] font-mono font-bold text-[#b9c4f0] shrink-0">
                          AWAY
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {upcomingFixtures.length === 0 && (
                <div className="col-span-2 text-center text-xs text-[#8e9bd4] italic py-8 border border-dashed border-[#3ce7ff]/20 rounded-xl">
                  No upcoming fixtures pending. All scheduled matches have concluded!
                </div>
              )}
            </div>

            {/* Poster Footer Stamp */}
            <div className="mt-8 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Official Ethiopian eFootball Upcoming Fixture Schedule</span>
              </span>
              <span>Telegram Broadcast Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MATCHDAY FIXTURES & UPCOMING SCHEDULE TABLE EXPORT TARGET              */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. MATCHDAY FIXTURES & UPCOMING SCHEDULE TABLE EXPORT TARGET              */}
      {/* ========================================================================= */}
      {activeTab === 'fixtures' && (
        <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
          <div
            ref={fixturesExportRef}
            className="w-[1240px] min-w-[1240px] mx-auto rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#050d4a] via-[#03072c] to-[#01041b] p-6 lg:p-8 shadow-2xl relative select-none"
            style={{ boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            {/* Poster Header */}
            <div className="flex items-center justify-between border-b border-[#3ce7ff]/25 pb-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#3ce7ff] p-2 shadow-lg shrink-0">
                  <EFootballLogo className="h-7 w-7" />
                </div>
                <div style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                  <div className="flex items-center gap-2 mb-1 flex-nowrap" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                    <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
                    <p
                      className="font-sports text-[11px] font-black uppercase tracking-wider text-[#eaff28] m-0 whitespace-nowrap inline-block"
                      style={{ lineHeight: '1.2', whiteSpace: 'nowrap', minWidth: 'max-content', display: 'inline-block' }}
                    >
                      OFFICIAL FIXTURE SCHEDULE &middot; ETHIOPIAN eFOOTBALL
                    </p>
                  </div>
                  <h2
                    className="font-efootball-stencil font-sports text-2xl sm:text-3xl font-black text-white tracking-wide m-0 my-1"
                    style={{ lineHeight: '1.25' }}
                  >
                    {selectedMatchday === 'upcoming'
                      ? 'UPCOMING MATCHES & PAIRINGS'
                      : `MATCHDAY ${selectedMatchday} FIXTURES`}
                  </h2>
                  <p
                    className="text-xs text-[#3ce7ff] font-mono m-0 mt-1"
                    style={{ lineHeight: '1.3' }}
                  >
                    Official Head-to-Head Pairings &middot; Scheduled Venues &middot; Verified Results
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-1 text-[10px] font-black uppercase text-[#eaff28] tracking-wider">
                  Verified Schedule
                </span>
                <p className="text-[10px] text-[#8e9bd4] font-mono mt-1">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Fixtures Table */}
            <div className="overflow-hidden rounded-2xl border border-[#3ce7ff]/30 bg-[#040938] shadow-lg">
              <table className="w-full text-left text-xs table-fixed">
                <thead>
                  <tr className="border-b border-[#3ce7ff]/20 bg-[#071360] text-[10px] font-sports font-black uppercase tracking-wider text-[#3ce7ff]">
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3 w-28 text-center">Stage / MD</th>
                    <th className="py-3 px-5 w-[420px] text-right">Home Team / Player</th>
                    <th className="py-3 px-3 w-36 text-center">Score / VS</th>
                    <th className="py-3 px-5 w-[420px]">Away Team / Player</th>
                    <th className="py-3 px-3 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3ce7ff]/10">
                  {displayedFixtures.map((f, idx) => {
                    const homeP = playerMap.get(f.home);
                    const awayP = playerMap.get(f.away);
                    const res = results.find(
                      (r) =>
                        r.isKnockout === f.isKnockout &&
                        r.matchday === f.matchday &&
                        ((r.home_user === f.home && r.away_user === f.away) ||
                          (r.home_user === f.away && r.away_user === f.home))
                    );
                    const isPlayed = !!res && !res.isPostponed;

                    return (
                      <tr key={f.id} className="hover:bg-[#071568]/50 transition-colors">
                        <td className="py-3.5 px-3 font-mono text-[#8e9bd4] text-center">{idx + 1}</td>
                        <td className="py-3.5 px-3 font-sports text-white text-center">
                          <span className="rounded bg-[#050842] border border-[#3ce7ff]/30 px-2 py-0.5 text-[10px]">
                            MD {f.matchday}
                          </span>
                        </td>

                        {/* Home team */}
                        <td className="py-3.5 px-5 text-right w-[420px]">
                          <div className="flex items-center justify-end gap-3">
                            <div className="text-right min-w-0">
                              <span
                                className="font-efootball-stencil font-club-name font-sports font-bold text-white block text-sm tracking-wide whitespace-nowrap overflow-hidden text-ellipsis"
                                style={{ lineHeight: '1.25' }}
                                data-club-name="true"
                              >
                                {homeP?.team || f.home}
                              </span>
                              <span
                                className="text-[11px] text-[#3ce7ff] font-mono block whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 tracking-normal"
                                style={{ lineHeight: '1.2' }}
                              >
                                @{f.home}
                              </span>
                            </div>
                            <img
                              src={homeP?.avatarUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover border-2 border-[#3ce7ff] shrink-0 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </td>

                        {/* Score or VS: STRICTLY HORIZONTAL SIDE-BY-SIDE */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {isPlayed ? (
                            <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-sports font-black text-sm bg-[#050842] px-3.5 py-1.5 rounded-lg border border-[#eaff28]/50 shadow-md">
                              <span className="text-white text-base font-black tabular-nums">{res.home_score}</span>
                              <span className="text-[#eaff28] text-sm font-bold opacity-80 px-0.5">–</span>
                              <span className="text-white text-base font-black tabular-nums">{res.away_score}</span>
                            </div>
                          ) : (
                            <span className="inline-block font-sports text-xs font-black text-[#3ce7ff] px-3 py-1 bg-[#050842] rounded-lg border border-[#3ce7ff]/30 tracking-wider">
                              VS
                            </span>
                          )}
                        </td>

                        {/* Away team */}
                        <td className="py-3.5 px-5 text-left w-[420px]">
                          <div className="flex items-center gap-3">
                            <img
                              src={awayP?.avatarUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover border-2 border-[#3ce7ff] shrink-0 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <div className="text-left min-w-0">
                              <span
                                className="font-efootball-stencil font-club-name font-sports font-bold text-white block text-sm tracking-wide whitespace-nowrap overflow-hidden text-ellipsis"
                                style={{ lineHeight: '1.25' }}
                                data-club-name="true"
                              >
                                {awayP?.team || f.away}
                              </span>
                              <span
                                className="text-[11px] text-[#3ce7ff] font-mono block whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 tracking-normal"
                                style={{ lineHeight: '1.2' }}
                              >
                                @{f.away}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center font-mono text-[10px]">
                          {isPlayed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> FT
                            </span>
                          ) : (
                            <span className="text-[#3ce7ff] font-semibold bg-[#050842] px-2 py-0.5 rounded border border-[#3ce7ff]/30">
                              Scheduled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Poster Footer Stamp */}
            <div className="mt-8 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Official Ethiopian eFootball League Schedule Table</span>
              </span>
              <span>Telegram Channel Broadcast Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TOURNAMENT CUP BRACKET GRAPHIC EXPORT TARGET                           */}
      {/* ========================================================================= */}
      {activeTab === 'bracket' && (
        <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
          <div
            ref={bracketExportRef}
            className="w-[1240px] min-w-[1240px] mx-auto rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#050d4a] via-[#03072c] to-[#01041b] p-6 shadow-2xl relative select-none"
            style={{ boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            {/* Header Stamp */}
            <div className="flex items-center justify-between mb-6 relative z-10 border-b border-[#3ce7ff]/20 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#3ce7ff] p-2 shadow-lg shrink-0">
                  <EFootballLogo className="h-7 w-7" />
                </div>
                <div style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                    <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
                    <p
                      className="font-efootball-stencil font-sports text-[11px] font-black uppercase tracking-wider text-[#eaff28] m-0 whitespace-nowrap inline-block"
                      style={{ lineHeight: '1.2', whiteSpace: 'nowrap', minWidth: 'max-content' }}
                    >
                      OFFICIAL CUP DRAW &middot; ETHIOPIAN eFOOTBALL CHAMPIONSHIP
                    </p>
                  </div>
                  <h1
                    className="font-efootball-stencil font-sports text-3xl font-black text-white tracking-wider m-0 mt-0.5"
                    style={{ lineHeight: '1.25' }}
                  >
                    GRAND CHAMPIONSHIP BRACKET
                  </h1>
                  <p
                    className="text-xs text-[#3ce7ff] font-mono m-0 mt-0.5"
                    style={{ lineHeight: '1.3' }}
                  >
                    {bracketData.stats.completedTies}/{bracketData.stats.totalTies} Matches Decided &middot; {bracketData.stats.totalGoals} Goals Recorded
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-1 text-[10px] font-black uppercase text-[#eaff28] tracking-wider">
                  Verified Eliminatory Path
                </span>
                <p className="text-[10px] text-[#8e9bd4] font-mono mt-1">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Symmetrical Dual-Wing Grid Layout */}
            <div className="flex items-center justify-center gap-6 relative z-10">
              {/* Left Wing */}
              <div className="flex items-center gap-6 justify-end">
                {bracketData.rounds.map((round) => (
                  <div
                    key={`export-col-left-${round.stage}`}
                    className="flex flex-col justify-around gap-6 h-full py-2 w-[210px] items-center shrink-0"
                  >
                    <span className="font-sports text-xs font-black uppercase text-[#3ce7ff]">
                      {round.title} (Left)
                    </span>
                    {round.leftTies.map((tie) => renderTieCardExport(tie, playerMap))}
                  </div>
                ))}
              </div>

              {/* Centerpiece: Grand Final & Trophy */}
              <div className="flex flex-col items-center justify-center gap-5 w-[230px] text-center shrink-0">
                <div className="text-center">
                  <Trophy className="h-16 w-16 text-[#eaff28] mx-auto animate-bounce" />
                  <span className="mt-1 block font-sports text-[10px] font-black uppercase tracking-widest text-[#eaff28]">
                    Grand Championship Cup
                  </span>
                </div>

                {bracketData.finalTie && (
                  <div className="w-full">
                    <span className="block font-sports text-xs font-black text-[#eaff28] uppercase mb-1">
                      🏆 GRAND FINAL
                    </span>
                    {renderTieCardExport(bracketData.finalTie, playerMap)}
                  </div>
                )}

                {bracketData.thirdPlaceTie && (
                  <div className="w-full">
                    <span className="block font-sports text-[10px] font-bold text-amber-400 uppercase mb-1">
                      🥉 3RD PLACE PLAYOFF
                    </span>
                    {renderTieCardExport(bracketData.thirdPlaceTie, playerMap)}
                  </div>
                )}
              </div>

              {/* Right Wing */}
              <div className="flex items-center gap-6 flex-row-reverse justify-start">
                {bracketData.rounds.map((round) => (
                  <div
                    key={`export-col-right-${round.stage}`}
                    className="flex flex-col justify-around gap-6 h-full py-2 w-[210px] items-center shrink-0"
                  >
                    <span className="font-sports text-xs font-black uppercase text-[#3ce7ff]">
                      {round.title} (Right)
                    </span>
                    {round.rightTies.map((tie) => renderTieCardExport(tie, playerMap))}
                  </div>
                ))}
              </div>
            </div>

            {/* Champion Coronation Banner on Export Poster */}
            {bracketData.champion && (
              <div className="mt-8 rounded-2xl border-2 border-[#eaff28] bg-gradient-to-r from-[#050b44] via-[#0f1d82] to-[#050b44] p-4 text-center shadow-[0_0_25px_rgba(234,255,40,0.3)]">
                <div className="flex items-center justify-center gap-3">
                  <Trophy className="h-8 w-8 text-[#eaff28] shrink-0" />
                  <div>
                    <span className="block font-sports text-[10px] font-black uppercase tracking-[0.3em] text-[#eaff28]">
                      🏆 OFFICIAL TOURNAMENT CHAMPION 🏆
                    </span>
                    <h3 className="font-sports text-2xl font-black text-white tracking-wider">
                      {bracketData.champion.team || bracketData.champion.user} (@{bracketData.champion.user})
                    </h3>
                  </div>
                  {bracketData.finalTie?.loserUser && (
                    <span className="text-xs text-[#3ce7ff] font-mono border-l border-[#3ce7ff]/30 pl-3">
                      Runner-up: {playerMap.get(bracketData.finalTie.loserUser)?.team || bracketData.finalTie.loserUser}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Official Match Results Summary List on Export Poster */}
            <div className="mt-8 rounded-2xl border border-[#3ce7ff]/30 bg-[#030733]/90 p-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h4 className="font-sports text-xs font-black uppercase tracking-wider text-white">
                    CUP DRAW MATCH RESULTS &amp; RECORDED SCORES ({bracketData.stats.completedTies}/{bracketData.stats.totalTies} ENDED)
                  </h4>
                </div>
                <span className="text-[10px] text-[#eaff28] font-mono font-bold">
                  {bracketData.stats.totalGoals} Total Goals Scored
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {bracketData.allTies.map((tie) => {
                  const homeP = tie.home ? playerMap.get(tie.home.user) : undefined;
                  const awayP = tie.away ? playerMap.get(tie.away.user) : undefined;
                  const isCompleted = tie.isCompleted;

                  return (
                    <div
                      key={`poster-res-${tie.id}`}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                        isCompleted
                          ? 'border-emerald-500/40 bg-[#061056]'
                          : 'border-[#3ce7ff]/20 bg-[#04083a]/70 opacity-60'
                      }`}
                    >
                      <div className="truncate flex-1 pr-1.5 min-w-0">
                        <span className="font-sports text-[9px] font-black uppercase text-[#3ce7ff] block tracking-normal">
                          {tie.stageBadge}
                        </span>
                        <div className="min-w-0">
                          <span className={`block font-sports text-[11px] truncate leading-tight font-bold tracking-normal ${tie.home?.isWinner ? 'text-[#eaff28]' : 'text-white'}`}>
                            {homeP?.team || tie.home?.user || 'TBD'}
                          </span>
                          {tie.home?.user && (
                            <span className="block text-[8px] text-[#3ce7ff] font-mono truncate leading-none">
                              @{tie.home.user}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 mt-0.5">
                          <span className={`block font-sports text-[11px] truncate leading-tight font-bold tracking-normal ${tie.away?.isWinner ? 'text-[#eaff28]' : 'text-white'}`}>
                            {awayP?.team || tie.away?.user || 'TBD'}
                          </span>
                          {tie.away?.user && (
                            <span className="block text-[8px] text-[#3ce7ff] font-mono truncate leading-none">
                              @{tie.away.user}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        {isCompleted ? (
                          <>
                            <span className="font-sports text-xs font-black text-[#eaff28] bg-[#020528] px-1.5 py-0.5 rounded border border-[#eaff28]/40 leading-none">
                              {tie.home?.score ?? 0}–{tie.away?.score ?? 0}
                            </span>
                            <span className="text-[8px] text-emerald-300 font-mono mt-0.5 uppercase">
                              {tie.penaltyWinner ? 'PEN' : 'FT'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[8px] text-[#8e9bd4] font-mono">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Poster Footer Stamp */}
            <div className="mt-8 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
              <span>Official Bracket Draw &middot; Verified Eliminatory Path</span>
              <span>Certified by League Administration</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. LEAGUE & GROUP STANDINGS TABLE EXPORT TARGET                           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 4. LEAGUE & GROUP STANDINGS TABLE EXPORT TARGET                           */}
      {/* ========================================================================= */}
      {activeTab === 'standings' && (
        <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
          <div
            ref={standingsExportRef}
            className="w-[1240px] min-w-[1240px] mx-auto rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#050d4a] via-[#03072c] to-[#01041b] p-6 lg:p-8 shadow-2xl relative select-none"
            style={{ boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            {/* Poster Header */}
            <div className="flex items-center justify-between border-b border-[#3ce7ff]/25 pb-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#3ce7ff] p-2 shadow-lg shrink-0">
                  <EFootballLogo className="h-7 w-7" />
                </div>
                <div style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                  <div className="flex items-center gap-2 mb-1 flex-nowrap" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                    <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
                    <p
                      className="font-sports text-[11px] font-black uppercase tracking-wider text-[#eaff28] m-0 whitespace-nowrap inline-block"
                      style={{ lineHeight: '1.2', whiteSpace: 'nowrap', minWidth: 'max-content', display: 'inline-block' }}
                    >
                      OFFICIAL TABLE &middot; ETHIOPIAN eFOOTBALL
                    </p>
                  </div>
                  <h2
                    className="font-efootball-stencil font-sports text-2xl sm:text-3xl font-black text-white tracking-wide m-0 my-1"
                    style={{ lineHeight: '1.25' }}
                  >
                    {tournamentFormat === 'group_knockout' || tournamentFormat === 'group_stage'
                      ? selectedGroup === 'all'
                        ? 'GROUP STAGE STANDINGS'
                        : `GROUP ${selectedGroup} STANDINGS`
                      : 'LEAGUE CHAMPIONSHIP TABLE'}
                  </h2>
                  <p
                    className="text-xs text-[#3ce7ff] font-mono m-0 mt-1"
                    style={{ lineHeight: '1.3' }}
                  >
                    Points &middot; Goal Difference &middot; Direct Head-to-Head Criteria
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-1 text-[10px] font-black uppercase text-[#eaff28] tracking-wider">
                  Certified Standings
                </span>
                <p className="text-[10px] text-[#8e9bd4] font-mono mt-1">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Standings Table */}
            <div className="overflow-hidden rounded-2xl border border-[#3ce7ff]/30 bg-[#040938] shadow-lg">
              <table className="w-full text-left text-xs table-fixed">
                <thead>
                  <tr className="border-b border-[#3ce7ff]/20 bg-[#071360] text-[10px] font-sports font-black uppercase tracking-wider text-[#3ce7ff]">
                    <th className="py-3.5 px-3 w-16 text-center">Pos</th>
                    <th className="py-3.5 px-5 w-[460px]">Team &amp; Player</th>
                    <th className="py-3.5 px-3 text-center w-14">P</th>
                    <th className="py-3.5 px-3 text-center w-14">W</th>
                    <th className="py-3.5 px-3 text-center w-14">D</th>
                    <th className="py-3.5 px-3 text-center w-14">L</th>
                    <th className="py-3.5 px-3 text-center w-14">GF</th>
                    <th className="py-3.5 px-3 text-center w-14">GA</th>
                    <th className="py-3.5 px-3 text-center w-16">GD</th>
                    <th className="py-3.5 px-4 text-center w-24 text-[#eaff28]">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3ce7ff]/10">
                  {standings.map((p, idx) => (
                    <tr
                      key={p.user}
                      className={`hover:bg-[#071568]/50 transition-colors ${
                        idx < 2 ? 'bg-[#eaff28]/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 font-sports font-black text-white text-center">
                        <span
                          className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? 'bg-[#eaff28] text-[#050842] shadow-[0_0_10px_rgba(234,255,40,0.5)]'
                              : idx === 1
                              ? 'bg-slate-200 text-[#050842]'
                              : idx === 2
                              ? 'bg-amber-600 text-white'
                              : 'text-[#8e9bd4] bg-[#050842] border border-[#3ce7ff]/20'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 w-[460px]">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.avatarUrl}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border-2 border-[#3ce7ff] shrink-0 shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span
                              className="font-efootball-stencil font-club-name block font-sports font-bold text-white text-sm tracking-wide whitespace-nowrap overflow-hidden text-ellipsis"
                              style={{ lineHeight: '1.25' }}
                              data-club-name="true"
                            >
                              {p.team || p.user}
                            </span>
                            <span
                              className="block text-[11px] text-[#3ce7ff] font-mono tracking-normal whitespace-nowrap overflow-hidden text-ellipsis mt-0.5"
                              style={{ lineHeight: '1.2' }}
                            >
                              @{p.user}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-white text-sm">{p.played}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-emerald-400 font-bold text-sm">{p.w}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-amber-300 text-sm">{p.d}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-rose-400 text-sm">{p.l}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-white text-sm">{p.gf}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-[#8e9bd4] text-sm">{p.ga}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-[#3ce7ff] font-bold text-sm">
                        {p.gd > 0 ? `+${p.gd}` : p.gd}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block font-sports text-base font-black text-[#eaff28] bg-[#050842] px-3.5 py-1 rounded-lg border border-[#eaff28]/50 shadow-sm leading-tight">
                          {p.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Poster Footer Stamp */}
            <div className="mt-8 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
              <span className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-[#eaff28]" />
                <span>Official Standings &middot; Certified League Table</span>
              </span>
              <span>Telegram Announcement Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PLAYER STATUS & TOURNAMENT STATISTICS BULLETIN EXPORT TARGET          */}
      {/* ========================================================================= */}
      {activeTab === 'stats' && (
        <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
          <div className="w-[1360px] mx-auto">
            <PlayerStatsExportCard
              cardRef={statsExportRef}
              isFixedExportWidth={true}
              allScorers={allScorers}
              allCleanSheets={allCleanSheets}
              allLosses={allLosses}
              top5Scorers={top5Scorers}
              top5CleanSheets={top5CleanSheets}
              top5Losses={top5Losses}
              showAllPlayers={true}
              totalGoalsScored={totalGoalsScored}
              totalHomeGoals={totalHomeGoals}
              totalAwayGoals={totalAwayGoals}
              averageGoalsPerMatch={averageGoalsPerMatch}
              totalCleanSheets={totalCleanSheets}
              totalCompletedMatches={results.filter((r) => !r.isPostponed).length}
              totalFixturesCount={fixtures.length}
              completionPct={completionPct}
              highestMatch={highestMatch}
              biggestBlowout={biggestBlowout}
              outcomeStats={outcomeStats}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. NEW PLAYER REGISTRATION REVEAL POSTER EXPORT TARGET                    */}
      {/* ========================================================================= */}
      {activeTab === 'player_reveal' && (
        <div className="space-y-4">
          {/* Mode Switcher & Controls Bar */}
          <div className="bg-[#05093e] p-3.5 rounded-xl border border-[#eaff28]/40 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#b9c4f0] uppercase font-mono">
                  Reveal Poster Format:
                </span>
                <div className="flex items-center gap-1.5 bg-[#030628] p-1 rounded-xl border border-[#3ce7ff]/30">
                  <button
                    type="button"
                    onClick={() => setRevealMode('single')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      revealMode === 'single'
                        ? 'bg-[#eaff28] text-[#050842] font-black shadow-md'
                        : 'text-[#b9c4f0] hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Single Player Spotlight</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRevealMode('batch');
                      if (selectedBatchPlayerIds.length === 0 && players.length > 0) {
                        setSelectedBatchPlayerIds(players.slice(0, 4).map((p) => p.id));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      revealMode === 'batch'
                        ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-md'
                        : 'text-[#b9c4f0] hover:text-white'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>List Multiple Together (Batch Reveal)</span>
                    <span className="rounded-full bg-[#eaff28] px-1.5 py-0.2 text-[8.5px] font-black text-[#050842] uppercase">
                      New
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {revealMode === 'single' && selectedRevealPlayer && (
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() =>
                      handleExport(
                        playerRevealExportRef,
                        `ethiopian-efootball-player-reveal-${selectedRevealPlayer.user}`
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-[#eaff28] bg-[#eaff28] hover:bg-[#d8ec1f] text-[#050842] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Download Single Reveal PNG</span>
                  </button>
                )}

                {revealMode === 'batch' && batchPlayers.length > 0 && (
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() =>
                      handleExport(
                        batchRevealExportRef,
                        `ethiopian-efootball-new-players-reveal-batch-${batchPlayers.length}-players`
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-[#3ce7ff] bg-[#3ce7ff] hover:bg-[#2bc4db] text-[#050842] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Download Batch Reveal PNG ({batchPlayers.length} Players)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mode Specific Options Bar */}
            {revealMode === 'single' ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                    <span>Select Competitor to Reveal:</span>
                  </span>

                  {players.length > 0 ? (
                    <select
                      value={selectedRevealPlayer?.id || ''}
                      onChange={(e) => setSelectedRevealPlayerId(e.target.value)}
                      className="rounded-lg border border-[#3ce7ff]/50 bg-[#071360] px-3 py-1.5 text-xs font-bold text-white focus:border-[#eaff28] focus:outline-none cursor-pointer"
                    >
                      {players.map((p, idx) => (
                        <option key={p.id} value={p.id} className="bg-[#071056] text-white">
                          #{idx + 1} &middot; {p.team} (@{p.user})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-[#8e9bd4] italic">No players registered yet</span>
                  )}
                </div>

                {selectedRevealPlayer && (
                  <span className="text-[11px] font-mono text-[#3ce7ff]">
                    Contender #{selectedRevealPlayerNumber} of {players.length}
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">
                      Reveal Multiple Registered Players Together:
                    </span>
                    <span className="text-[11px] text-[#3ce7ff] font-mono">
                      ({batchPlayers.length} of {players.length} selected)
                    </span>
                  </div>

                  {/* Batch Selection Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBatchPlayerIds(players.map((p) => p.id))}
                      className="rounded-md bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] text-white px-2 py-1 text-[10.5px] font-mono font-bold transition-colors"
                    >
                      All ({players.length})
                    </button>
                    {players.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBatchPlayerIds(players.slice(0, 2).map((p) => p.id))}
                        className="rounded-md bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] text-white px-2 py-1 text-[10.5px] font-mono font-bold transition-colors"
                      >
                        Latest 2
                      </button>
                    )}
                    {players.length >= 3 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBatchPlayerIds(players.slice(0, 3).map((p) => p.id))}
                        className="rounded-md bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] text-white px-2 py-1 text-[10.5px] font-mono font-bold transition-colors"
                      >
                        Latest 3
                      </button>
                    )}
                    {players.length >= 4 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBatchPlayerIds(players.slice(0, 4).map((p) => p.id))}
                        className="rounded-md bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] text-white px-2 py-1 text-[10.5px] font-mono font-bold transition-colors"
                      >
                        Latest 4
                      </button>
                    )}
                    {players.length >= 6 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBatchPlayerIds(players.slice(0, 6).map((p) => p.id))}
                        className="rounded-md bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] text-white px-2 py-1 text-[10.5px] font-mono font-bold transition-colors"
                      >
                        Latest 6
                      </button>
                    )}
                  </div>
                </div>

                {/* Player Chips / Checkboxes for Batch Selection */}
                <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto p-1 rounded-lg bg-[#020524] border border-[#3ce7ff]/20">
                  {players.map((p) => {
                    const isSelected = batchPlayers.some((bp) => bp.id === p.id);
                    return (
                      <button
                        key={`batch-chip-${p.id}`}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (batchPlayers.length > 1) {
                              setSelectedBatchPlayerIds(batchPlayers.filter((bp) => bp.id !== p.id).map((bp) => bp.id));
                            }
                          } else {
                            setSelectedBatchPlayerIds([...batchPlayers.map((bp) => bp.id), p.id]);
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all border ${
                          isSelected
                            ? 'border-[#3ce7ff] bg-[#071360] text-white font-bold shadow-sm'
                            : 'border-white/10 bg-[#03072b] text-[#8e9bd4] hover:border-white/30'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-[#eaff28]' : 'bg-gray-600'}`} />
                        <span>{p.team}</span>
                        <span className="text-[#3ce7ff]">(@{p.user})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export Canvas Preview */}
          <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
            {players.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[#3ce7ff]/30 bg-[#050842]/40 p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3ce7ff]/40 bg-[#071360] text-[#3ce7ff]">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h4 className="font-sports text-xl font-black text-white mt-3">
                  NO PLAYERS TO REVEAL
                </h4>
                <p className="text-xs text-[#b9c4f0] mt-1 font-mono">
                  Once competitors register, select them here to download reveal announcement cards for Telegram and socials.
                </p>
              </div>
            ) : revealMode === 'single' ? (
              selectedRevealPlayer ? (
                <div className="w-[1240px] mx-auto">
                  <PlayerRevealExportCard
                    player={selectedRevealPlayer}
                    totalPlayers={players.length}
                    playerNumber={selectedRevealPlayerNumber}
                    tournamentFormat={tournamentFormat}
                    cardRef={playerRevealExportRef}
                  />
                </div>
              ) : null
            ) : (
              <div className="w-[1240px] mx-auto">
                <BatchPlayerRevealExportCard
                  players={batchPlayers}
                  totalTournamentPlayers={players.length}
                  tournamentFormat={tournamentFormat}
                  cardRef={batchRevealExportRef}
                  batchTitle={
                    batchPlayers.length === players.length
                      ? 'ALL REGISTERED NEW PLAYERS REVEAL'
                      : `NEW PLAYERS CLASS REVEAL (${batchPlayers.length} CONTENDERS)`
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. TOTAL REGISTERED PLAYERS ROSTER POSTER EXPORT TARGET                  */}
      {/* ========================================================================= */}
      {activeTab === 'total_roster' && (
        <div className="space-y-4">
          {/* Quick Info & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#05093e] p-3.5 rounded-xl border border-[#3ce7ff]/40 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-[#b9c4f0]">
              <Users className="h-4 w-4 text-[#3ce7ff]" />
              <span>
                Total Roster Poster &middot; <strong className="text-white">{players.length} Competitors</strong> registered across{' '}
                <strong className="text-[#eaff28]">
                  {new Set(players.map((p) => p.team.trim().toLowerCase())).size} Clubs
                </strong>
              </span>
            </div>

            <button
              type="button"
              disabled={isExporting}
              onClick={() =>
                handleExport(totalRosterExportRef, 'ethiopian-efootball-total-registered-players')
              }
              className="flex items-center gap-1.5 rounded-lg border border-[#eaff28] bg-[#eaff28] hover:bg-[#d8ec1f] text-[#050842] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Download Total Roster PNG</span>
            </button>
          </div>

          {/* Export Canvas Preview */}
          <div className="overflow-x-auto pb-4 rounded-2xl border border-[#3ce7ff]/30 bg-[#020520] p-4">
            <div className="w-[1240px] mx-auto">
              <TotalRosterExportCard
                players={players}
                tournamentFormat={tournamentFormat}
                cardRef={totalRosterExportRef}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// Helper card renderer for bracket export
function renderTieCardExport(tie: BracketTieModel, playerMap: Map<string, Player>) {
  const homeP = tie.home ? playerMap.get(tie.home.user) : undefined;
  const awayP = tie.away ? playerMap.get(tie.away.user) : undefined;

  return (
    <div
      key={tie.id}
      className="relative w-[220px] rounded-xl border border-[#3ce7ff]/35 bg-[#050a48]/95 p-2.5 shadow-lg select-none"
    >
      <div className="flex items-center justify-between border-b border-[#3ce7ff]/15 pb-1 mb-1.5 text-[10px]">
        <span className="font-sports font-bold tracking-normal text-[#3ce7ff] uppercase">
          {tie.stageBadge}
        </span>
        {tie.isCompleted ? (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>FT</span>
          </span>
        ) : (
          <span className="text-[9px] text-[#8e9bd4] font-mono">Scheduled</span>
        )}
      </div>

      <div className="space-y-1">
        {/* Home */}
        <div
          className={`flex items-center justify-between py-1 px-1.5 rounded-lg ${
            tie.home?.isWinner ? 'bg-[#eaff28]/15 border border-[#eaff28]/50 text-white font-bold' : 'text-white/90'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            {homeP?.avatarUrl ? (
              <img
                src={homeP.avatarUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff]/50 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-sports truncate block leading-tight font-bold tracking-normal">
                {homeP?.team || tie.home?.user || 'TBD'}
              </span>
              {tie.home?.user && (
                <span className="text-[8.5px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5">
                  @{tie.home.user}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {tie.penaltyHomeScore !== null && tie.penaltyHomeScore !== undefined && (
              <span className="text-[8px] text-[#eaff28] font-mono">({tie.penaltyHomeScore}p)</span>
            )}
            <span className="font-sports text-xs font-black text-[#eaff28]">
              {tie.home?.score !== null && tie.home?.score !== undefined ? tie.home.score : '—'}
            </span>
          </div>
        </div>

        {/* Away */}
        <div
          className={`flex items-center justify-between py-1 px-1.5 rounded-lg ${
            tie.away?.isWinner ? 'bg-[#eaff28]/15 border border-[#eaff28]/50 text-white font-bold' : 'text-white/90'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            {awayP?.avatarUrl ? (
              <img
                src={awayP.avatarUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover border border-[#3ce7ff]/50 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-sports truncate block leading-tight font-bold tracking-normal">
                {awayP?.team || tie.away?.user || 'TBD'}
              </span>
              {tie.away?.user && (
                <span className="text-[8.5px] text-[#3ce7ff] font-mono block truncate leading-none mt-0.5">
                  @{tie.away.user}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {tie.penaltyAwayScore !== null && tie.penaltyAwayScore !== undefined && (
              <span className="text-[8px] text-[#eaff28] font-mono">({tie.penaltyAwayScore}p)</span>
            )}
            <span className="font-sports text-xs font-black text-[#eaff28]">
              {tie.away?.score !== null && tie.away?.score !== undefined ? tie.away.score : '—'}
            </span>
          </div>
        </div>
      </div>

      {tie.penaltyWinner && (
        <div className="mt-1 pt-1 border-t border-[#3ce7ff]/10 text-center text-[8px] text-[#eaff28] font-mono">
          Full-Time Draw · ({tie.penaltyHomeScore ?? 4}–{tie.penaltyAwayScore ?? 3} pen)
        </div>
      )}
    </div>
  );
}
