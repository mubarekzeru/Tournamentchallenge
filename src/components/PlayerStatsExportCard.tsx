import React from 'react';
import {
  Trophy,
  Target,
  Shield,
  Flame,
  Zap,
  Activity,
  Percent,
  Award,
  AlertCircle,
} from 'lucide-react';
import { MatchResult } from '../types/tournament';
import { EFootballLogo } from './EFootballLogo';

export interface PlayerStatEntry {
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
  winRatePct: string;
  points: number;
}

export interface PlayerStatsExportCardProps {
  // Support both allScorers / allCleanSheets / allLosses (All players status) and top5
  allScorers?: PlayerStatEntry[];
  allCleanSheets?: PlayerStatEntry[];
  allLosses?: PlayerStatEntry[];
  top5Scorers?: PlayerStatEntry[];
  top5CleanSheets?: PlayerStatEntry[];
  top5Losses?: PlayerStatEntry[];
  totalGoalsScored: number;
  totalHomeGoals: number;
  totalAwayGoals: number;
  averageGoalsPerMatch: string;
  totalCleanSheets: number;
  totalCompletedMatches: number;
  totalFixturesCount: number;
  completionPct: number;
  highestMatch: {
    result: MatchResult;
    totalGoals: number;
    homeTeam: string;
    awayTeam: string;
  } | null;
  biggestBlowout: {
    result: MatchResult;
    diff: number;
    winner: string;
    winnerTeam: string;
    loser: string;
    loserTeam: string;
  } | null;
  outcomeStats: {
    homeWins: number;
    awayWins: number;
    draws: number;
    homeWinPct: string;
    awayWinPct: string;
    drawPct: string;
  };
  cardRef?: React.RefObject<HTMLDivElement | null>;
  isFixedExportWidth?: boolean;
  showAllPlayers?: boolean;
}

export const PlayerStatsExportCard: React.FC<PlayerStatsExportCardProps> = ({
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
  totalCompletedMatches,
  totalFixturesCount,
  completionPct,
  highestMatch,
  biggestBlowout: _biggestBlowout,
  outcomeStats,
  cardRef,
  isFixedExportWidth = false,
  showAllPlayers = true,
}) => {
  // Determine lists to render: prefer allScorers/allCleanSheets/allLosses if provided
  const rawScorers = allScorers && allScorers.length > 0 ? allScorers : (top5Scorers || []);
  const rawCleanSheets = allCleanSheets && allCleanSheets.length > 0 ? allCleanSheets : (top5CleanSheets || []);
  const rawLosses = allLosses && allLosses.length > 0 ? allLosses : (top5Losses || []);

  const scorersList = showAllPlayers ? rawScorers : rawScorers.slice(0, 5);
  const cleanSheetsList = showAllPlayers ? rawCleanSheets : rawCleanSheets.slice(0, 5);
  const lossesList = showAllPlayers ? rawLosses : rawLosses.slice(0, 5);
  const totalCompetitors = Math.max(rawScorers.length, rawCleanSheets.length, rawLosses.length);

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-b from-[#060c44] via-[#03062c] to-[#01041b] text-white shadow-2xl p-5 sm:p-7 md:p-8 select-none ${
        isFixedExportWidth ? 'w-[1360px] min-w-[1360px]' : 'w-full max-w-[1360px] mx-auto'
      }`}
      style={{
        boxSizing: 'border-box',
        fontFamily: '"eFootballStencil-Regular", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#3ce7ff]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#eaff28]/10 blur-3xl pointer-events-none" />

      {/* Official Header Banner: Clean Spacing & Strict Line Heights (Zero Overlap) */}
      <div className="relative z-10 border-b border-[#3ce7ff]/25 pb-5 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl border-2 border-[#eaff28] bg-gradient-to-br from-[#071360] to-[#01062b] p-2 shadow-[0_0_20px_rgba(234,255,40,0.35)] shrink-0">
              <EFootballLogo className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0 flex-1" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
              <div className="flex items-center gap-2 mb-1" style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}>
                <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
                <p
                  className="font-efootball-stencil m-0 text-[11px] font-black tracking-wider text-[#eaff28] uppercase whitespace-nowrap inline-block"
                  style={{ lineHeight: '1.2', whiteSpace: 'nowrap', minWidth: 'max-content' }}
                >
                  ETHIOPIAN ESPORTS LEAGUE &middot; OFFICIAL COMPETITION BULLETIN
                </p>
              </div>
              <h3
                className="font-efootball-stencil font-sports text-2xl sm:text-3xl text-white font-black tracking-wide m-0 mt-1 mb-1"
                style={{ lineHeight: '1.25' }}
              >
                {showAllPlayers ? 'ALL PLAYERS STATUS & STATS' : 'TOP PLAYERS STATUS & STATS'}
              </h3>
              <p
                className="m-0 text-xs text-[#3ce7ff] font-medium"
                style={{ lineHeight: '1.3' }}
              >
                Golden Boot Race &middot; Golden Glove Defensive Wall &middot; Most Losses Status &middot; All {totalCompetitors} Players
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5 pl-2">
            <span className="rounded-full border border-[#eaff28]/60 bg-[#eaff28]/15 px-3.5 py-1 text-[10.5px] font-black uppercase text-[#eaff28] tracking-wider shadow-sm">
              Official Bulletin
            </span>
            <span className="text-[10px] text-[#8e9bd4] font-mono">
              {showAllPlayers ? `All ${totalCompetitors} Players Ranked` : 'Top 5 Focus'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: 3 Distinct Separated Columns (Scorers, Clean Sheets, Losses) */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Column 1: MOST GOALS SCORED (GOLDEN BOOT) */}
        <div className="rounded-2xl border border-[#eaff28]/40 bg-gradient-to-b from-[#0a1458] to-[#04083a] p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#eaff28]/25 pb-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaff28] text-[#050842] shadow-[0_0_12px_rgba(234,255,40,0.4)] shrink-0">
                  <Target className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h4
                    className="font-sports text-base font-black text-white uppercase tracking-wide m-0"
                    style={{ lineHeight: '1.25' }}
                  >
                    Most Goals Scored
                  </h4>
                  <p
                    className="m-0 mt-0.5 text-[10px] text-[#eaff28] font-bold"
                    style={{ lineHeight: '1.3' }}
                  >
                    Golden Boot &middot; Ranks 1 to {scorersList.length}
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-[#071360] border border-[#eaff28]/50 px-2.5 py-1 text-[9.5px] font-mono text-[#eaff28] font-black uppercase tracking-wider shrink-0">
                {showAllPlayers ? `All ${scorersList.length}` : 'Top 5'}
              </span>
            </div>

            {/* List of Scorers */}
            <div className="space-y-2">
              {scorersList.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 italic">
                  No goal records logged yet.
                </div>
              ) : (
                scorersList.map((player, idx) => {
                  const rank = idx + 1;
                  const isFirst = rank === 1;
                  const isSecond = rank === 2;
                  const isThird = rank === 3;

                  return (
                    <div
                      key={`scorer-${player.user}`}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                        isFirst
                          ? 'bg-gradient-to-r from-[#ffd700]/25 via-[#eaff28]/15 to-[#040938] border-[#eaff28]/70 shadow-[0_0_15px_rgba(234,255,40,0.18)]'
                          : isSecond
                          ? 'bg-gradient-to-r from-slate-400/20 via-slate-600/10 to-[#040938] border-slate-300/40'
                          : isThird
                          ? 'bg-gradient-to-r from-amber-600/20 via-amber-800/10 to-[#040938] border-amber-500/40'
                          : 'bg-[#040a40]/75 border-[#3ce7ff]/15 hover:border-[#3ce7ff]/40'
                      }`}
                    >
                      {/* Left: Rank & Player info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <div
                          className={`grid h-6 w-6 place-items-center rounded-lg font-sports text-[11px] font-black shrink-0 ${
                            isFirst
                              ? 'bg-gradient-to-br from-[#ffd700] to-[#eaff28] text-[#050842] shadow-[0_0_10px_rgba(234,255,40,0.6)] ring-1 ring-white/50'
                              : isSecond
                              ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-[#050842]'
                              : isThird
                              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                              : 'bg-[#071360] text-[#3ce7ff] border border-[#3ce7ff]/30'
                          }`}
                        >
                          #{rank}
                        </div>

                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.team}
                            className={`h-7 w-7 rounded-full object-cover shrink-0 border ${
                              isFirst
                                ? 'border-[#eaff28]'
                                : isSecond
                                ? 'border-slate-300'
                                : isThird
                                ? 'border-amber-400'
                                : 'border-[#3ce7ff]/40'
                            }`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#071360] border border-[#3ce7ff]/40 font-sports text-[10px] font-bold text-white shrink-0">
                            {player.user.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p
                            className="m-0 font-efootball-stencil font-club-name font-sports text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ lineHeight: '1.25' }}
                            data-club-name="true"
                          >
                            {player.team || player.user}
                          </p>
                          <p
                            className="m-0 mt-0.5 text-[9px] text-[#3ce7ff] font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ lineHeight: '1.2' }}
                          >
                            @{player.user}
                          </p>
                        </div>
                      </div>

                      {/* Right: Goals Scored & Matches info */}
                      <div className="text-right shrink-0 pl-1.5 whitespace-nowrap">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span
                            className={`font-sports text-base sm:text-lg font-black ${
                              isFirst ? 'text-[#eaff28]' : 'text-white'
                            }`}
                            style={{ lineHeight: '1.1' }}
                          >
                            {player.gf}
                          </span>
                          <span className="text-[9px] font-black text-[#b9c4f0]">GF</span>
                        </div>
                        <p
                          className="m-0 mt-0.5 text-[9px] text-[#b9c4f0] font-mono"
                          style={{ lineHeight: '1.2' }}
                        >
                          {player.played}m &middot; {player.played > 0 ? (player.gf / player.played).toFixed(1) : '0.0'} G/M
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#eaff28]/20 flex items-center justify-between text-[10px] text-[#b9c4f0]">
            <span>Sorted by goals scored &middot; fewest games</span>
            <span className="text-[#eaff28] font-bold flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              <span>Golden Boot</span>
            </span>
          </div>
        </div>

        {/* Column 2: MOST CLEAN SHEETS (GOLDEN GLOVE) */}
        <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-b from-[#08184f] to-[#04083a] p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-emerald-400/25 pb-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-[#050842] shadow-[0_0_12px_rgba(52,211,153,0.4)] shrink-0">
                  <Shield className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h4
                    className="font-sports text-base font-black text-white uppercase tracking-wide m-0"
                    style={{ lineHeight: '1.25' }}
                  >
                    Most Clean Sheets
                  </h4>
                  <p
                    className="m-0 mt-0.5 text-[10px] text-emerald-300 font-bold"
                    style={{ lineHeight: '1.3' }}
                  >
                    Golden Glove &middot; Ranks 1 to {cleanSheetsList.length}
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-[#071360] border border-emerald-400/50 px-2.5 py-1 text-[9.5px] font-mono text-emerald-300 font-black uppercase tracking-wider shrink-0">
                {showAllPlayers ? `All ${cleanSheetsList.length}` : 'Top 5'}
              </span>
            </div>

            {/* List of Clean Sheets */}
            <div className="space-y-2">
              {cleanSheetsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 italic">
                  No clean sheet records logged yet.
                </div>
              ) : (
                cleanSheetsList.map((player, idx) => {
                  const rank = idx + 1;
                  const isFirst = rank === 1;
                  const isSecond = rank === 2;
                  const isThird = rank === 3;
                  const cleanSheetPct =
                    player.played > 0
                      ? Math.round((player.cleanSheets / player.played) * 100)
                      : 0;

                  return (
                    <div
                      key={`clean-sheet-${player.user}`}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                        isFirst
                          ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-[#040938] border-emerald-400/70 shadow-[0_0_15px_rgba(52,211,153,0.18)]'
                          : isSecond
                          ? 'bg-gradient-to-r from-slate-400/20 via-slate-600/10 to-[#040938] border-slate-300/40'
                          : isThird
                          ? 'bg-gradient-to-r from-amber-600/20 via-amber-800/10 to-[#040938] border-amber-500/40'
                          : 'bg-[#040a40]/75 border-[#3ce7ff]/15 hover:border-[#3ce7ff]/40'
                      }`}
                    >
                      {/* Left: Rank & Player info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <div
                          className={`grid h-6 w-6 place-items-center rounded-lg font-sports text-[11px] font-black shrink-0 ${
                            isFirst
                              ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-[#050842] shadow-[0_0_10px_rgba(52,211,153,0.6)] ring-1 ring-white/50'
                              : isSecond
                              ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-[#050842]'
                              : isThird
                              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                              : 'bg-[#071360] text-emerald-300 border border-emerald-400/30'
                          }`}
                        >
                          #{rank}
                        </div>

                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.team}
                            className={`h-7 w-7 rounded-full object-cover shrink-0 border ${
                              isFirst
                                ? 'border-emerald-400'
                                : isSecond
                                ? 'border-slate-300'
                                : isThird
                                ? 'border-amber-400'
                                : 'border-[#3ce7ff]/40'
                            }`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#071360] border border-[#3ce7ff]/40 font-sports text-[10px] font-bold text-white shrink-0">
                            {player.user.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p
                            className="m-0 font-efootball-stencil font-club-name font-sports text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ lineHeight: '1.25' }}
                            data-club-name="true"
                          >
                            {player.team || player.user}
                          </p>
                          <p
                            className="m-0 mt-0.5 text-[9px] text-[#3ce7ff] font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ lineHeight: '1.2' }}
                          >
                            @{player.user}
                          </p>
                        </div>
                      </div>

                      {/* Right: Clean Sheets & GA */}
                      <div className="text-right shrink-0 pl-1.5 whitespace-nowrap">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span
                            className={`font-sports text-base sm:text-lg font-black ${
                              isFirst ? 'text-emerald-300' : 'text-white'
                            }`}
                            style={{ lineHeight: '1.1' }}
                          >
                            {player.cleanSheets}
                          </span>
                          <span className="text-[9px] font-black text-emerald-400">CS</span>
                        </div>
                        <p
                          className="m-0 mt-0.5 text-[9.5px] text-[#b9c4f0] font-mono"
                          style={{ lineHeight: '1.2' }}
                        >
                          {player.ga} GA &middot; {cleanSheetPct}% rate
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-400/20 flex items-center justify-between text-[10px] text-[#b9c4f0]">
            <span>Sorted by clean sheets &middot; fewest conceded</span>
            <span className="text-emerald-300 font-bold flex items-center gap-1">
              <Award className="h-3 w-3" />
              <span>Golden Glove</span>
            </span>
          </div>
        </div>

        {/* Column 3: MOST LOSSES STATUS (DEFEATS LEADERBOARD) */}
        <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-b from-[#160a35] to-[#04083a] p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rose-500/25 pb-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)] shrink-0">
                  <AlertCircle className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h4
                    className="font-sports text-base font-black text-white uppercase tracking-wide m-0"
                    style={{ lineHeight: '1.25' }}
                  >
                    Most Losses Status
                  </h4>
                  <p
                    className="m-0 mt-0.5 text-[10px] text-rose-300 font-bold"
                    style={{ lineHeight: '1.3' }}
                  >
                    Defeats Record &middot; Ranks 1 to {lossesList.length}
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-[#071360] border border-rose-500/50 px-2.5 py-1 text-[9.5px] font-mono text-rose-300 font-black uppercase tracking-wider shrink-0">
                {showAllPlayers ? `All ${lossesList.length}` : 'Top 5'}
              </span>
            </div>

            {/* List of Losses */}
            <div className="space-y-2">
              {lossesList.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 italic">
                  No loss records logged yet.
                </div>
              ) : (
                lossesList.map((player, idx) => {
                  const rank = idx + 1;
                  const isTop = rank === 1;
                  const lossRatePct =
                    player.played > 0
                      ? Math.round((player.l / player.played) * 100)
                      : 0;

                  return (
                    <div
                      key={`loss-${player.user}`}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                        isTop
                          ? 'bg-gradient-to-r from-rose-900/35 via-rose-700/20 to-[#040938] border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                          : rank <= 3
                          ? 'bg-gradient-to-r from-rose-950/25 via-[#0c0836] to-[#040938] border-rose-400/30'
                          : 'bg-[#040a40]/75 border-[#3ce7ff]/15 hover:border-[#3ce7ff]/40'
                      }`}
                    >
                      {/* Left: Rank & Player info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <div
                          className={`grid h-6 w-6 place-items-center rounded-lg font-sports text-[11px] font-black shrink-0 ${
                            isTop
                              ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm ring-1 ring-rose-400/50'
                              : rank <= 3
                              ? 'bg-[#071360] text-rose-300 border border-rose-400/40'
                              : 'bg-[#071360] text-[#8e9bd4] border border-[#3ce7ff]/30'
                          }`}
                        >
                          #{rank}
                        </div>

                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.team}
                            className={`h-7 w-7 rounded-full object-cover shrink-0 border ${
                              isTop
                                ? 'border-rose-400'
                                : 'border-[#3ce7ff]/40'
                            }`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#071360] border border-[#3ce7ff]/40 font-sports text-[10px] font-bold text-white shrink-0">
                            {player.user.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p
                            className="m-0 font-efootball-stencil font-club-name font-sports text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ lineHeight: '1.25' }}
                            data-club-name="true"
                          >
                            {player.team || player.user}
                          </p>
                          <p
                            className="m-0 mt-0.5 text-[9px] text-[#3ce7ff] font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ lineHeight: '1.2' }}
                          >
                            @{player.user}
                          </p>
                        </div>
                      </div>

                      {/* Right: Losses & Conceded */}
                      <div className="text-right shrink-0 pl-1.5 whitespace-nowrap">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span
                            className={`font-sports text-base sm:text-lg font-black ${
                              isTop ? 'text-rose-400' : 'text-white'
                            }`}
                            style={{ lineHeight: '1.1' }}
                          >
                            {player.l}
                          </span>
                          <span className="text-[9px] font-black text-rose-300">L</span>
                        </div>
                        <p
                          className="m-0 mt-0.5 text-[9.5px] text-[#b9c4f0] font-mono"
                          style={{ lineHeight: '1.2' }}
                        >
                          {player.ga} GA &middot; {lossRatePct}% defeats
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-500/20 flex items-center justify-between text-[10px] text-[#b9c4f0]">
            <span>Sorted by matches lost &middot; highest conceded</span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Defeats Leader</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: KEY TOURNAMENT STATISTICS - PERFECT FIT, ZERO OVERLAP */}
      <div className="relative z-10 border-t border-[#3ce7ff]/25 pt-5 mt-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#3ce7ff]" />
            <h4
              className="font-sports text-sm sm:text-base font-black text-white uppercase tracking-wider m-0"
              style={{ lineHeight: '1.25' }}
            >
              Key Tournament Statistics
            </h4>
          </div>
          <span className="rounded-full bg-[#050842] border border-[#3ce7ff]/40 px-3 py-0.5 text-[10px] text-[#3ce7ff] font-mono font-bold">
            {totalCompletedMatches} of {totalFixturesCount} Matches Played ({completionPct}%)
          </span>
        </div>

        {/* 4 Professional Broadcaster Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Stat 1: Total Goals */}
          <div className="rounded-xl border border-[#eaff28]/40 bg-gradient-to-b from-[#0a1458] to-[#04083a] p-3.5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-[#eaff28] font-bold uppercase tracking-wider mb-2">
                <span>Total Goals</span>
                <Flame className="h-3.5 w-3.5 text-[#eaff28]" />
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-sports text-3xl font-black text-white leading-none">
                  {totalGoalsScored}
                </span>
                <span className="rounded bg-[#071360] border border-[#eaff28]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#eaff28]">
                  {averageGoalsPerMatch} / match
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 text-[10px] text-[#b9c4f0] font-mono flex items-center justify-between">
              <span>Home: <strong className="text-white">{totalHomeGoals}</strong></span>
              <span>Away: <strong className="text-white">{totalAwayGoals}</strong></span>
            </div>
          </div>

          {/* Stat 2: Total Clean Sheets */}
          <div className="rounded-xl border border-emerald-400/40 bg-gradient-to-b from-[#08184f] to-[#04083a] p-3.5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-2">
                <span>Clean Sheets</span>
                <Shield className="h-3.5 w-3.5 text-emerald-300" />
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-sports text-3xl font-black text-white leading-none">
                  {totalCleanSheets}
                </span>
                <span className="rounded bg-[#071360] border border-emerald-400/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                  shutouts
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 text-[10px] text-[#b9c4f0] font-mono">
              {totalCompletedMatches > 0
                ? `${Math.round((totalCleanSheets / totalCompletedMatches) * 100)}% match shutout rate`
                : 'Defensive shutouts'}
            </div>
          </div>

          {/* Stat 3: Highest Scoring Match */}
          <div className="rounded-xl border border-[#3ce7ff]/40 bg-gradient-to-b from-[#081552] to-[#04083a] p-3.5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-[#3ce7ff] font-bold uppercase tracking-wider mb-2">
                <span>Highest Scoring</span>
                <Zap className="h-3.5 w-3.5 text-[#3ce7ff]" />
              </div>
              {highestMatch ? (
                <div>
                  <p className="font-sports text-xs font-black text-white truncate leading-snug mb-1">
                    {highestMatch.homeTeam} {highestMatch.result.home_score}-{highestMatch.result.away_score} {highestMatch.awayTeam}
                  </p>
                  <span className="inline-block rounded bg-[#071360] border border-[#eaff28]/40 px-2 py-0.5 text-[10px] font-mono font-bold text-[#eaff28]">
                    {highestMatch.totalGoals} goals &middot; MD {highestMatch.result.matchday}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No matches played yet</p>
              )}
            </div>
            <div className="pt-2 border-t border-white/10 text-[10px] text-[#8e9bd4] font-mono truncate">
              Competition Record Match
            </div>
          </div>

          {/* Stat 4: Match Outcomes (Win Distribution) - ZERO OVERLAPS WITH CLEAN 3-SEGMENT BOXES */}
          <div className="rounded-xl border border-indigo-400/40 bg-gradient-to-b from-[#0b1258] to-[#04083a] p-3.5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-2">
                <span>Win Distribution</span>
                <Percent className="h-3.5 w-3.5 text-indigo-300" />
              </div>
              {/* 3 Dedicated Mini Badges */}
              <div className="grid grid-cols-3 gap-1 mb-2">
                <div className="rounded bg-[#040938] border border-cyan-400/30 p-1 text-center">
                  <span className="block text-[9px] text-[#3ce7ff] font-bold uppercase">Home</span>
                  <span className="block font-sports text-xs font-black text-white leading-tight">
                    {outcomeStats.homeWins}
                  </span>
                  <span className="block text-[8px] text-[#8e9bd4] font-mono leading-none">
                    {outcomeStats.homeWinPct}%
                  </span>
                </div>
                <div className="rounded bg-[#040938] border border-amber-400/30 p-1 text-center">
                  <span className="block text-[9px] text-amber-300 font-bold uppercase">Draw</span>
                  <span className="block font-sports text-xs font-black text-white leading-tight">
                    {outcomeStats.draws}
                  </span>
                  <span className="block text-[8px] text-[#8e9bd4] font-mono leading-none">
                    {outcomeStats.drawPct}%
                  </span>
                </div>
                <div className="rounded bg-[#040938] border border-[#eaff28]/30 p-1 text-center">
                  <span className="block text-[9px] text-[#eaff28] font-bold uppercase">Away</span>
                  <span className="block font-sports text-xs font-black text-white leading-tight">
                    {outcomeStats.awayWins}
                  </span>
                  <span className="block text-[8px] text-[#8e9bd4] font-mono leading-none">
                    {outcomeStats.awayWinPct}%
                  </span>
                </div>
              </div>
            </div>
            {/* Visual Segmented Progress Bar */}
            <div className="pt-1.5 border-t border-white/10">
              <div className="h-2 w-full rounded-full bg-[#030628] overflow-hidden flex">
                <div
                  style={{ width: `${outcomeStats.homeWinPct}%` }}
                  className="h-full bg-cyan-400"
                  title={`Home Wins: ${outcomeStats.homeWinPct}%`}
                />
                <div
                  style={{ width: `${outcomeStats.drawPct}%` }}
                  className="h-full bg-amber-400"
                  title={`Draws: ${outcomeStats.drawPct}%`}
                />
                <div
                  style={{ width: `${outcomeStats.awayWinPct}%` }}
                  className="h-full bg-[#eaff28]"
                  title={`Away Wins: ${outcomeStats.awayWinPct}%`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Official Watermark & Verification Footer */}
      <div className="relative z-10 mt-6 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
        <span className="flex items-center gap-1.5">
          <EFootballLogo className="h-3.5 w-3.5" />
          <span>Official Broadcast Bulletin &middot; Ethiopian Esports League</span>
        </span>
        <span>Anti-Tamper Verified &middot; Live Firestore Aggregated</span>
      </div>
    </div>
  );
};

export default PlayerStatsExportCard;
