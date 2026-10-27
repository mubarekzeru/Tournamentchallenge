import React, { useState, useMemo, useRef } from 'react';
import { exportElementToPng, downloadDataUrl } from '../utils/exportImage';
import {
  Trophy,
  Target,
  Flame,
  Shield,
  TrendingUp,
  BarChart3,
  PieChart,
  Users,
  CheckCircle2,
  Copy,
  Check,
  Activity,
  Award,
  Sparkles,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  Zap,
  Download,
} from 'lucide-react';
import { Player, Fixture, MatchResult, TournamentFormat } from '../types/tournament';
import { PlayerStatsExportCard, PlayerStatEntry } from './PlayerStatsExportCard';

interface TournamentStatsSectionProps {
  players: Player[];
  fixtures: Fixture[];
  results: MatchResult[];
  tournamentFormat?: TournamentFormat;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

interface HighestScoringMatch {
  result: MatchResult;
  totalGoals: number;
  homeTeam: string;
  awayTeam: string;
}

interface BiggestBlowout {
  result: MatchResult;
  diff: number;
  winner: string;
  winnerTeam: string;
  loser: string;
  loserTeam: string;
}

interface TournamentHighlights {
  highestScoringMatch: HighestScoringMatch | null;
  biggestBlowout: BiggestBlowout | null;
  totalCleanSheets: number;
  completionPct: number;
}

export const TournamentStatsSection: React.FC<TournamentStatsSectionProps> = ({
  players,
  fixtures,
  results,
  tournamentFormat = 'league_double',
  onToast,
}) => {
  const [filterStage, setFilterStage] = useState<'all' | 'group' | 'knockout' | 'league'>('all');
  const [teamSearch, setTeamSearch] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [statusViewMode, setStatusViewMode] = useState<'all' | 'top5'>('all');
  const statsExportRef = useRef<HTMLDivElement>(null);

  // Player lookup map for quick resolution
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => {
      map.set(p.user.toLowerCase().trim(), p);
    });
    return map;
  }, [players]);

  // Valid completed match results (excluding postponed matches)
  const completedResults = useMemo(() => {
    return results.filter((r) => !r.isPostponed);
  }, [results]);

  // Filtered results based on selected stage filter
  const activeResults = useMemo(() => {
    if (filterStage === 'all') return completedResults;
    if (filterStage === 'group') {
      return completedResults.filter((r) => r.group || (r.stage && r.stage.toLowerCase().includes('group')));
    }
    if (filterStage === 'knockout') {
      return completedResults.filter((r) => r.isKnockout || (r.stage && !r.stage.toLowerCase().includes('group')));
    }
    if (filterStage === 'league') {
      return completedResults.filter((r) => !r.group && !r.isKnockout);
    }
    return completedResults;
  }, [completedResults, filterStage]);

  // 1. Total Goals and Averages
  const totalCompletedMatches = activeResults.length;
  const totalHomeGoals = useMemo(
    () => activeResults.reduce((acc, r) => acc + (r.home_score || 0), 0),
    [activeResults]
  );
  const totalAwayGoals = useMemo(
    () => activeResults.reduce((acc, r) => acc + (r.away_score || 0), 0),
    [activeResults]
  );
  const totalGoalsScored = totalHomeGoals + totalAwayGoals;

  const averageGoalsPerMatch = totalCompletedMatches > 0
    ? (totalGoalsScored / totalCompletedMatches).toFixed(2)
    : '0.00';

  // 2. Win / Draw / Loss outcome distribution
  const outcomeStats = useMemo(() => {
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let penaltyDecided = 0;

    activeResults.forEach((r) => {
      if (r.home_score > r.away_score) {
        homeWins += 1;
      } else if (r.away_score > r.home_score) {
        awayWins += 1;
      } else {
        draws += 1;
        if (r.penaltyWinner) {
          penaltyDecided += 1;
        }
      }
    });

    const homeWinPct = totalCompletedMatches > 0 ? ((homeWins / totalCompletedMatches) * 100).toFixed(1) : '0';
    const awayWinPct = totalCompletedMatches > 0 ? ((awayWins / totalCompletedMatches) * 100).toFixed(1) : '0';
    const drawPct = totalCompletedMatches > 0 ? ((draws / totalCompletedMatches) * 100).toFixed(1) : '0';

    return {
      homeWins,
      awayWins,
      draws,
      penaltyDecided,
      homeWinPct,
      awayWinPct,
      drawPct,
    };
  }, [activeResults, totalCompletedMatches]);

  // 3. Most Played Teams analysis
  const teamStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        teamName: string;
        appearances: number;
        wins: number;
        draws: number;
        losses: number;
        goalsScored: number;
        goalsConceded: number;
        playersUsing: Set<string>;
      }
    >();

    activeResults.forEach((r) => {
      const homeP = playerMap.get((r.home_user || '').toLowerCase().trim());
      const awayP = playerMap.get((r.away_user || '').toLowerCase().trim());

      const homeTeam = (homeP?.team || r.home_user || 'Unknown Team').trim();
      const awayTeam = (awayP?.team || r.away_user || 'Unknown Team').trim();

      // Home team record
      if (!stats.has(homeTeam)) {
        stats.set(homeTeam, {
          teamName: homeTeam,
          appearances: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsScored: 0,
          goalsConceded: 0,
          playersUsing: new Set(),
        });
      }
      const hStat = stats.get(homeTeam)!;
      hStat.appearances += 1;
      hStat.goalsScored += r.home_score;
      hStat.goalsConceded += r.away_score;
      if (r.home_user) hStat.playersUsing.add(r.home_user);

      if (r.home_score > r.away_score) {
        hStat.wins += 1;
      } else if (r.home_score < r.away_score) {
        hStat.losses += 1;
      } else {
        hStat.draws += 1;
      }

      // Away team record
      if (!stats.has(awayTeam)) {
        stats.set(awayTeam, {
          teamName: awayTeam,
          appearances: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsScored: 0,
          goalsConceded: 0,
          playersUsing: new Set(),
        });
      }
      const aStat = stats.get(awayTeam)!;
      aStat.appearances += 1;
      aStat.goalsScored += r.away_score;
      aStat.goalsConceded += r.home_score;
      if (r.away_user) aStat.playersUsing.add(r.away_user);

      if (r.away_score > r.home_score) {
        aStat.wins += 1;
      } else if (r.away_score < r.home_score) {
        aStat.losses += 1;
      } else {
        aStat.draws += 1;
      }
    });

    const list = Array.from(stats.values()).map((item) => {
      const gd = item.goalsScored - item.goalsConceded;
      const winRate = item.appearances > 0 ? ((item.wins / item.appearances) * 100).toFixed(1) : '0';
      const points = item.wins * 3 + item.draws;
      return {
        ...item,
        gd,
        winRate,
        points,
        playersList: Array.from(item.playersUsing),
      };
    });

    // Sort by appearances descending, then winRate, then goals scored
    return list.sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (parseFloat(b.winRate) !== parseFloat(a.winRate)) return parseFloat(b.winRate) - parseFloat(a.winRate);
      return b.goalsScored - a.goalsScored;
    });
  }, [activeResults, playerMap]);

  // 4. Individual Player Win/Loss Ratios across recorded matches
  const playerWinLossStats = useMemo(() => {
    const pStats = new Map<
      string,
      {
        user: string;
        team: string;
        avatarUrl: string;
        played: number;
        w: number;
        d: number;
        l: number;
        gf: number;
        ga: number;
        cleanSheets: number;
      }
    >();

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
      });
    });

    activeResults.forEach((r) => {
      const hClean = (r.home_user || '').toLowerCase().trim();
      const aClean = (r.away_user || '').toLowerCase().trim();

      let hStat = pStats.get(hClean);
      if (!hStat && r.home_user) {
        hStat = {
          user: r.home_user,
          team: 'Player Team',
          avatarUrl: '',
          played: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          cleanSheets: 0,
        };
        pStats.set(hClean, hStat);
      }

      let aStat = pStats.get(aClean);
      if (!aStat && r.away_user) {
        aStat = {
          user: r.away_user,
          team: 'Player Team',
          avatarUrl: '',
          played: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          cleanSheets: 0,
        };
        pStats.set(aClean, aStat);
      }

      if (hStat) {
        hStat.played += 1;
        hStat.gf += r.home_score;
        hStat.ga += r.away_score;
        if (r.away_score === 0) hStat.cleanSheets += 1;

        if (r.home_score > r.away_score) {
          hStat.w += 1;
        } else if (r.home_score < r.away_score) {
          hStat.l += 1;
        } else {
          hStat.d += 1;
        }
      }

      if (aStat) {
        aStat.played += 1;
        aStat.gf += r.away_score;
        aStat.ga += r.home_score;
        if (r.home_score === 0) aStat.cleanSheets += 1;

        if (r.away_score > r.home_score) {
          aStat.w += 1;
        } else if (r.away_score < r.home_score) {
          aStat.l += 1;
        } else {
          aStat.d += 1;
        }
      }
    });

    const list = Array.from(pStats.values()).map((p) => {
      const winRatePct = p.played > 0 ? ((p.w / p.played) * 100).toFixed(1) : '0';
      // Win-Loss ratio: e.g. W / L or W : L format
      const wlRatio = p.l > 0 ? (p.w / p.l).toFixed(2) : p.w > 0 ? `${p.w}.0 (Undefeated)` : '0.00';
      const gd = p.gf - p.ga;
      const points = p.w * 3 + p.d;
      const pointsPerGame = p.played > 0 ? (points / p.played).toFixed(2) : '0.00';

      return {
        ...p,
        winRatePct,
        wlRatio,
        gd,
        points,
        pointsPerGame,
      };
    });

    // Filter to players with at least 1 match played, or sort all
    return list.sort((a, b) => {
      if (parseFloat(b.winRatePct) !== parseFloat(a.winRatePct)) {
        return parseFloat(b.winRatePct) - parseFloat(a.winRatePct);
      }
      if (b.w !== a.w) return b.w - a.w;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
  }, [players, activeResults]);

  // All Goal Scorers (Ranked 1 to N for all tournament players)
  const allScorers = useMemo<PlayerStatEntry[]>(() => {
    return [...playerWinLossStats].sort((a, b) => {
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (a.played !== b.played) return a.played - b.played;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return a.user.localeCompare(b.user);
    });
  }, [playerWinLossStats]);

  // All Clean Sheets (Ranked 1 to N for all tournament players)
  const allCleanSheets = useMemo<PlayerStatEntry[]>(() => {
    return [...playerWinLossStats].sort((a, b) => {
      if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
      if (a.ga !== b.ga) return a.ga - b.ga;
      if (a.played !== b.played) return a.played - b.played;
      return a.user.localeCompare(b.user);
    });
  }, [playerWinLossStats]);

  // All Losses (Ranked 1 to N for most defeats)
  const allLosses = useMemo<PlayerStatEntry[]>(() => {
    return [...playerWinLossStats].sort((a, b) => {
      if (b.l !== a.l) return b.l - a.l;
      if (b.ga !== a.ga) return b.ga - a.ga;
      if (a.points !== b.points) return a.points - b.points;
      return a.user.localeCompare(b.user);
    });
  }, [playerWinLossStats]);

  const top5Scorers = useMemo(() => allScorers.slice(0, 5), [allScorers]);
  const top5CleanSheets = useMemo(() => allCleanSheets.slice(0, 5), [allCleanSheets]);
  const top5Losses = useMemo(() => allLosses.slice(0, 5), [allLosses]);

  // PNG Export Handler for Player Status & Tournament Statistics Bulletin
  const handleDownloadStatsPng = async () => {
    if (!statsExportRef.current) {
      if (onToast) onToast('Target element not ready for PNG export.', 'error');
      return;
    }
    setIsExportingPng(true);
    try {
      const dataUrl = await exportElementToPng(statsExportRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#020520',
      });
      downloadDataUrl(dataUrl, `ethiopian-efootball-player-status-and-stats-${Date.now()}`);
      if (onToast) {
        onToast('Official Player Status & Tournament Statistics exported as PNG!', 'success');
      }
    } catch (err) {
      console.error('Failed to export stats PNG:', err);
      if (onToast) {
        onToast('Failed to export PNG. Please try again.', 'error');
      }
    } finally {
      setIsExportingPng(false);
    }
  };

  // 5. Deeper Tournament Highlights & Records
  const tournamentHighlights = useMemo<TournamentHighlights>(() => {
    let highestScoringMatch: HighestScoringMatch | null = null;
    let biggestBlowout: BiggestBlowout | null = null;
    let totalCleanSheets = 0;

    activeResults.forEach((r) => {
      const matchGoals = r.home_score + r.away_score;
      const homeP = playerMap.get((r.home_user || '').toLowerCase().trim());
      const awayP = playerMap.get((r.away_user || '').toLowerCase().trim());
      const homeTeam = homeP?.team || r.home_user;
      const awayTeam = awayP?.team || r.away_user;

      if (!highestScoringMatch || matchGoals > highestScoringMatch.totalGoals) {
        highestScoringMatch = {
          result: r,
          totalGoals: matchGoals,
          homeTeam,
          awayTeam,
        };
      }

      const diff = Math.abs(r.home_score - r.away_score);
      if (!biggestBlowout || diff > biggestBlowout.diff) {
        if (r.home_score > r.away_score) {
          biggestBlowout = {
            result: r,
            diff,
            winner: r.home_user,
            winnerTeam: homeTeam,
            loser: r.away_user,
            loserTeam: awayTeam,
          };
        } else if (r.away_score > r.home_score) {
          biggestBlowout = {
            result: r,
            diff,
            winner: r.away_user,
            winnerTeam: awayTeam,
            loser: r.home_user,
            loserTeam: homeTeam,
          };
        }
      }

      if (r.home_score === 0 || r.away_score === 0) {
        totalCleanSheets += 1;
      }
    });

    const completionPct =
      fixtures.length > 0
        ? Math.min(100, Math.round((completedResults.length / fixtures.length) * 100))
        : 0;

    return {
      highestScoringMatch,
      biggestBlowout,
      totalCleanSheets,
      completionPct,
    };
  }, [activeResults, playerMap, fixtures, completedResults]);

  // Copy stats report to clipboard
  const handleCopySummary = () => {
    const topTeam = teamStats[0];
    const topPlayer = playerWinLossStats[0];

    const text = `📊 TOURNAMENT STATS & INSIGHTS OVERVIEW
============================================
⚽ Total Goals Scored: ${totalGoalsScored} (${averageGoalsPerMatch} goals/match)
🏟️ Completed Matches: ${totalCompletedMatches}
🏠 Home Goals: ${totalHomeGoals} | ✈️ Away Goals: ${totalAwayGoals}
📈 Match Outcomes: ${outcomeStats.homeWins} Home Wins (${outcomeStats.homeWinPct}%) | ${outcomeStats.draws} Draws (${outcomeStats.drawPct}%) | ${outcomeStats.awayWins} Away Wins (${outcomeStats.awayWinPct}%)

🏆 Most Played Club: ${topTeam ? `${topTeam.teamName} (${topTeam.appearances} matches, ${topTeam.winRate}% win rate)` : 'N/A'}
⭐ Top Win-Rate Player: ${topPlayer ? `${topPlayer.user} (${topPlayer.team}) - ${topPlayer.winRatePct}% Win Rate (${topPlayer.w}W-${topPlayer.d}D-${topPlayer.l}L)` : 'N/A'}
🛡️ Clean Sheets Kept: ${tournamentHighlights.totalCleanSheets}
🎯 Tournament Completion: ${tournamentHighlights.completionPct}% (${completedResults.length}/${fixtures.length} fixtures)
============================================
Generated from Tournament Administrator Panel`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    if (onToast) {
      onToast('Tournament stats report copied to clipboard!', 'success');
    }
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Filtered teams list based on search term
  const displayedTeams = useMemo(() => {
    if (!teamSearch.trim()) return teamStats;
    const term = teamSearch.toLowerCase().trim();
    return teamStats.filter((t) =>
      t.teamName.toLowerCase().includes(term) ||
      t.playersList.some((p) => p.toLowerCase().includes(term))
    );
  }, [teamStats, teamSearch]);

  const topTeam = teamStats[0];
  const highestMatch = tournamentHighlights.highestScoringMatch;

  return (
    <section className="rounded-2xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#081057] to-[#04083a] p-5 sm:p-7 shadow-[0_0_40px_rgba(60,231,255,0.15)]">
      {/* Header with Title, Format Badge, and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#eaff28] bg-[#071360] text-[#eaff28] shadow-[0_0_20px_rgba(234,255,40,0.3)]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#eaff28]">
                Advanced Analytics
              </span>
              <span className="rounded-full border border-[#3ce7ff]/50 bg-[#3ce7ff]/10 px-2 py-0.5 text-[9px] font-bold text-[#3ce7ff]">
                Live Aggregation
              </span>
            </div>
            <h3 className="font-sports text-2xl font-black text-white">
              Tournament Stats & Insights
            </h3>
            <p className="mt-0.5 text-xs text-[#b9c4f0]">
              Real-time aggregation of goals, match averages, club appearances, and win/loss performance ratios.
            </p>
          </div>
        </div>

        {/* Action Buttons & Quick Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-[#3ce7ff]/30 bg-[#050b42] px-3 py-1.5 shadow-sm text-xs text-[#b9c4f0]">
            <span className="h-2 w-2 rounded-full bg-[#3ce7ff] animate-pulse" />
            <span className="font-bold text-white">Championship League Fixtures</span>
          </div>

          {/* Download Stats as PNG Button */}
          <button
            type="button"
            disabled={isExportingPng}
            onClick={handleDownloadStatsPng}
            className="flex items-center gap-1.5 rounded-xl border border-[#eaff28] bg-[#eaff28] px-3.5 py-1.5 text-xs font-black uppercase text-[#050842] hover:bg-[#d4e824] transition-all shadow-[0_0_15px_rgba(234,255,40,0.35)] active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Download Player Status (Top 5 Scorers, Top 5 Clean Sheets) & Stats as high-resolution PNG"
          >
            <Download className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{isExportingPng ? 'Exporting PNG...' : 'Download PNG'}</span>
          </button>

          {/* Copy Report Button */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 rounded-xl border border-[#eaff28]/60 bg-[#eaff28]/15 px-3 py-1.5 text-xs font-bold text-[#eaff28] hover:bg-[#eaff28] hover:text-[#050842] transition-colors shadow-sm"
            title="Copy formatted stats summary report to clipboard"
          >
            {copiedSummary ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Primary High-Impact Metric Cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Goals Scored */}
        <div className="relative overflow-hidden rounded-2xl border border-[#eaff28]/40 bg-gradient-to-br from-[#0c186b] to-[#060c44] p-5 shadow-lg">
          <div className="absolute -right-4 -bottom-4 text-[#eaff28]/10 pointer-events-none">
            <Flame className="w-24 h-24" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#eaff28]">
              Total Goals Scored
            </span>
            <div className="rounded-lg bg-[#eaff28]/15 p-1.5 text-[#eaff28]">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-sports text-3xl sm:text-4xl font-black text-white">
              {totalGoalsScored}
            </span>
            <span className="text-xs font-bold text-[#b9c4f0]">goals in total</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#3ce7ff]/15 pt-2 text-[11px] text-[#b9c4f0]">
            <span>
              Home: <strong className="text-white">{totalHomeGoals}</strong>
            </span>
            <span className="text-gray-500">•</span>
            <span>
              Away: <strong className="text-white">{totalAwayGoals}</strong>
            </span>
          </div>
        </div>

        {/* Metric 2: Average Goals Per Match */}
        <div className="relative overflow-hidden rounded-2xl border border-[#3ce7ff]/40 bg-gradient-to-br from-[#091566] to-[#04083a] p-5 shadow-lg">
          <div className="absolute -right-4 -bottom-4 text-[#3ce7ff]/10 pointer-events-none">
            <Activity className="w-24 h-24" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#3ce7ff]">
              Avg. Goals Per Match
            </span>
            <div className="rounded-lg bg-[#3ce7ff]/15 p-1.5 text-[#3ce7ff]">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-sports text-3xl sm:text-4xl font-black text-white">
              {averageGoalsPerMatch}
            </span>
            <span className="text-xs font-bold text-[#3ce7ff]">per game</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#3ce7ff]/15 pt-2 text-[11px] text-[#b9c4f0]">
            <span>
              Matches Recorded: <strong className="text-white">{totalCompletedMatches}</strong>
            </span>
          </div>
        </div>

        {/* Metric 3: Most Played Team */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-[#10176b] to-[#050838] p-5 shadow-lg">
          <div className="absolute -right-4 -bottom-4 text-indigo-400/10 pointer-events-none">
            <Shield className="w-24 h-24" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
              Most Played Team
            </span>
            <div className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-300">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="font-efootball-stencil font-club-name font-sports text-xl sm:text-2xl font-black text-white truncate" title={topTeam?.teamName || 'N/A'} data-club-name="true">
              {topTeam?.teamName || 'No Matches'}
            </p>
            <p className="text-xs text-[#b9c4f0] mt-0.5">
              {topTeam ? `${topTeam.appearances} match appearances` : '0 appearances'}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#3ce7ff]/15 pt-2 text-[11px] text-[#b9c4f0]">
            <span>
              Win Rate: <strong className="text-emerald-300">{topTeam ? `${topTeam.winRate}%` : '0%'}</strong>
            </span>
            <span>
              Goals: <strong className="text-white">{topTeam ? topTeam.goalsScored : 0}</strong>
            </span>
          </div>
        </div>

        {/* Metric 4: Win / Loss Match Outcomes */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-[#0c1f61] to-[#040938] p-5 shadow-lg">
          <div className="absolute -right-4 -bottom-4 text-emerald-400/10 pointer-events-none">
            <PieChart className="w-24 h-24" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
              Match Outcomes
            </span>
            <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-300">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-sports text-2xl sm:text-3xl font-black text-white">
              {outcomeStats.homeWins} - {outcomeStats.draws} - {outcomeStats.awayWins}
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">H - D - A</span>
          </div>

          {/* Outcome Visual Distribution Bar */}
          <div className="mt-3 overflow-hidden rounded-full bg-gray-800 flex h-2 w-full">
            <div
              style={{ width: `${outcomeStats.homeWinPct}%` }}
              className="bg-emerald-400"
              title={`Home Wins: ${outcomeStats.homeWinPct}%`}
            />
            <div
              style={{ width: `${outcomeStats.drawPct}%` }}
              className="bg-amber-400"
              title={`Draws: ${outcomeStats.drawPct}%`}
            />
            <div
              style={{ width: `${outcomeStats.awayWinPct}%` }}
              className="bg-[#3ce7ff]"
              title={`Away Wins: ${outcomeStats.awayWinPct}%`}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-[#b9c4f0]">
            <span className="text-emerald-300 font-bold">H: {outcomeStats.homeWinPct}%</span>
            <span className="text-amber-300 font-bold">D: {outcomeStats.drawPct}%</span>
            <span className="text-[#3ce7ff] font-bold">A: {outcomeStats.awayWinPct}%</span>
          </div>
        </div>
      </div>

      {/* Highlights & Deeper Tournament Insights Row */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Highest Scoring Match */}
        <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#050a44] p-4">
          <div className="flex items-center gap-2 text-[#eaff28]">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-wider">Highest Scoring Match</span>
          </div>
          {highestMatch ? (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-sm font-black text-white">
                <span className="truncate max-w-[130px]" title={highestMatch.homeTeam}>
                  {highestMatch.homeTeam}
                </span>
                <span className="rounded-lg bg-[#071360] border border-[#eaff28]/40 px-2.5 py-0.5 text-sm font-sports text-[#eaff28]">
                  {highestMatch.result.home_score} - {highestMatch.result.away_score}
                </span>
                <span className="truncate max-w-[130px] text-right" title={highestMatch.awayTeam}>
                  {highestMatch.awayTeam}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[#b9c4f0]">
                Matchday {highestMatch.result.matchday} • {highestMatch.totalGoals} goals recorded
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-400">No match results recorded yet</p>
          )}
        </div>

        {/* Clean Sheets & Defensive Records */}
        <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#050a44] p-4">
          <div className="flex items-center gap-2 text-emerald-300">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-wider">Defensive Clean Sheets</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-sports text-2xl font-black text-white">
              {tournamentHighlights.totalCleanSheets}
            </span>
            <span className="text-xs text-[#b9c4f0]">shutouts logged</span>
          </div>
          <p className="mt-1.5 text-[11px] text-[#b9c4f0]">
            {totalCompletedMatches > 0
              ? `${((tournamentHighlights.totalCleanSheets / totalCompletedMatches) * 100).toFixed(0)}% of matches had at least one clean sheet`
              : 'Record match scores to calculate clean sheets'}
          </p>
        </div>

        {/* Tournament Fixture Completion Rate */}
        <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#050a44] p-4">
          <div className="flex items-center gap-2 text-[#3ce7ff]">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-wider">Tournament Completion</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-sports text-2xl font-black text-white">
              {tournamentHighlights.completionPct}%
            </span>
            <span className="text-xs text-[#b9c4f0]">
              ({completedResults.length} of {fixtures.length} fixtures)
            </span>
          </div>
          <div className="mt-2 overflow-hidden rounded-full bg-gray-800 h-1.5 w-full">
            <div
              style={{ width: `${tournamentHighlights.completionPct}%` }}
              className="h-full bg-gradient-to-r from-[#3ce7ff] to-[#eaff28]"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FEATURE: PLAYER STATUS (ALL PLAYERS STATUS / TOP 5 VIEW) + STATS          */}
      {/* ========================================================================= */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaff28] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.35)] shrink-0">
              <Award className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-sports text-lg sm:text-xl text-white font-black uppercase tracking-wide m-0">
                Player Status &amp; Competition Records
              </h4>
              <p className="m-0 text-xs text-[#b9c4f0]">
                {statusViewMode === 'all'
                  ? `All ${allScorers.length} Players Ranked · Golden Boot & Golden Glove Leaderboard`
                  : 'Top 5 Golden Boot & Golden Glove Focus · Official Broadcast Bulletin'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle: All Players (Default) vs Top 5 */}
            <div className="flex items-center gap-1 rounded-xl border border-[#3ce7ff]/30 bg-[#04083a] p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setStatusViewMode('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  statusViewMode === 'all'
                    ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-sm'
                    : 'text-[#b9c4f0] hover:text-white'
                }`}
              >
                All Players Status ({allScorers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusViewMode('top5')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  statusViewMode === 'top5'
                    ? 'bg-[#eaff28] text-[#050842] font-black shadow-sm'
                    : 'text-[#b9c4f0] hover:text-white'
                }`}
              >
                Top 5 Only
              </button>
            </div>

            <button
              type="button"
              disabled={isExportingPng}
              onClick={handleDownloadStatsPng}
              className="flex items-center gap-2 rounded-xl border border-[#eaff28] bg-[#eaff28] hover:bg-[#d4e824] text-[#050842] px-4 py-2 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(234,255,40,0.35)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>{isExportingPng ? 'Generating PNG...' : 'Download Stats as PNG'}</span>
            </button>
          </div>
        </div>

        {/* Live on-page responsive Player Status Card */}
        <PlayerStatsExportCard
          allScorers={allScorers}
          allCleanSheets={allCleanSheets}
          allLosses={allLosses}
          top5Scorers={top5Scorers}
          top5CleanSheets={top5CleanSheets}
          top5Losses={top5Losses}
          showAllPlayers={statusViewMode === 'all'}
          totalGoalsScored={totalGoalsScored}
          totalHomeGoals={totalHomeGoals}
          totalAwayGoals={totalAwayGoals}
          averageGoalsPerMatch={averageGoalsPerMatch}
          totalCleanSheets={tournamentHighlights.totalCleanSheets}
          totalCompletedMatches={totalCompletedMatches}
          totalFixturesCount={fixtures.length}
          completionPct={tournamentHighlights.completionPct}
          highestMatch={highestMatch}
          biggestBlowout={tournamentHighlights.biggestBlowout}
          outcomeStats={outcomeStats}
        />
      </div>

      {/* Hidden Pristine 1360px Fixed-Width Container specifically for high-resolution PNG export (zero collisions) */}
      <div
        style={{
          position: 'fixed',
          left: '-10000px',
          top: '0',
          width: '1360px',
          pointerEvents: 'none',
          zIndex: -9999,
        }}
        aria-hidden="true"
      >
        <PlayerStatsExportCard
          cardRef={statsExportRef}
          isFixedExportWidth={true}
          allScorers={allScorers}
          allCleanSheets={allCleanSheets}
          allLosses={allLosses}
          top5Scorers={top5Scorers}
          top5CleanSheets={top5CleanSheets}
          top5Losses={top5Losses}
          showAllPlayers={statusViewMode === 'all'}
          totalGoalsScored={totalGoalsScored}
          totalHomeGoals={totalHomeGoals}
          totalAwayGoals={totalAwayGoals}
          averageGoalsPerMatch={averageGoalsPerMatch}
          totalCleanSheets={tournamentHighlights.totalCleanSheets}
          totalCompletedMatches={totalCompletedMatches}
          totalFixturesCount={fixtures.length}
          completionPct={tournamentHighlights.completionPct}
          highestMatch={highestMatch}
          biggestBlowout={tournamentHighlights.biggestBlowout}
          outcomeStats={outcomeStats}
        />
      </div>

      {/* Section Content: 2 Columns (Most Played Teams & Player Win/Loss Ratios) */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Most Played Teams Leaderboard */}
        <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060d4b] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/20 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#3ce7ff]" />
                <h4 className="font-sports text-lg text-white">Most Played Teams</h4>
              </div>
              <span className="text-xs font-bold text-[#b9c4f0]">
                {displayedTeams.length} unique clubs
              </span>
            </div>

            {/* Quick search input */}
            <div className="mt-3">
              <input
                type="text"
                placeholder="Search team or player..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full rounded-lg border border-[#3ce7ff]/30 bg-[#04083a] px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:border-[#eaff28] focus:outline-none"
              />
            </div>

            {/* Teams List */}
            <div className="mt-3 space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {displayedTeams.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No team appearance data matches this filter.
                </div>
              ) : (
                displayedTeams.map((team, idx) => {
                  const maxAppearances = displayedTeams[0]?.appearances || 1;
                  const appearancePct = Math.round((team.appearances / maxAppearances) * 100);

                  return (
                    <div
                      key={team.teamName}
                      className="rounded-lg border border-[#3ce7ff]/20 bg-[#04093c]/80 p-3 hover:border-[#3ce7ff]/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-md font-sports text-xs font-bold ${
                              idx === 0
                                ? 'bg-[#eaff28] text-[#050842]'
                                : idx === 1
                                ? 'bg-slate-300 text-[#050842]'
                                : idx === 2
                                ? 'bg-amber-600 text-white'
                                : 'bg-[#071360] text-[#b9c4f0]'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h5 className="font-sports text-sm font-bold text-white truncate">
                              {team.teamName}
                            </h5>
                            <p className="text-[10px] text-[#b9c4f0] truncate">
                              {team.playersList.join(', ') || 'Various participants'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="font-sports text-base font-black text-[#eaff28]">
                              {team.appearances}
                            </span>
                            <span className="text-[10px] font-bold text-[#b9c4f0]">matches</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-300">
                            {team.winRate}% Win Rate
                          </span>
                        </div>
                      </div>

                      {/* Visual Appearance Ratio Bar */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            style={{ width: `${appearancePct}%` }}
                            className="h-full bg-gradient-to-r from-[#3ce7ff] to-[#eaff28]"
                          />
                        </div>
                        <div className="text-[10px] font-bold text-[#b9c4f0] flex-shrink-0">
                          {team.wins}W - {team.draws}D - {team.losses}L • {team.goalsScored} GF
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Player Win / Loss Ratios Leaderboard */}
        <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060d4b] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3ce7ff]/20 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#eaff28]" />
                <h4 className="font-sports text-lg text-white">Player Win/Loss Ratios</h4>
              </div>
              <span className="text-xs font-bold text-[#b9c4f0]">
                Ranked by Win %
              </span>
            </div>

            {/* Player Ratios List */}
            <div className="mt-4 space-y-2.5 max-h-[445px] overflow-y-auto pr-1">
              {playerWinLossStats.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No player match records available yet.
                </div>
              ) : (
                playerWinLossStats.map((p, idx) => (
                  <div
                    key={p.user}
                    className="rounded-lg border border-[#3ce7ff]/20 bg-[#04093c]/80 p-3 hover:border-[#3ce7ff]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.user}
                            className="h-8 w-8 rounded-full border border-[#3ce7ff]/40 object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full border border-[#3ce7ff]/40 bg-[#071360] font-sports text-xs font-bold text-white flex-shrink-0">
                            {p.user.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-sports text-sm font-black text-white truncate">
                              {p.team || p.user}
                            </span>
                            <span className="text-[10px] text-[#3ce7ff] truncate">
                              @{p.user}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#b9c4f0]">
                            {p.played} played • {p.w}W - {p.d}D - {p.l}L • GD: {p.gd > 0 ? `+${p.gd}` : p.gd}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="font-sports text-base font-black text-emerald-300">
                            {p.winRatePct}%
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#b9c4f0]">
                          Ratio: {p.wlRatio}
                        </span>
                      </div>
                    </div>

                    {/* Win rate visual bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          style={{ width: `${p.winRatePct}%` }}
                          className="h-full bg-emerald-400"
                        />
                      </div>
                      <span className="text-[9px] font-extrabold text-[#eaff28] flex-shrink-0">
                        {p.pointsPerGame} PPG
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
