import React, { useEffect, useState, useMemo } from 'react';
import {
  Flame,
  ShieldCheck,
  Phone,
  Send,
  X,
  Calendar,
  Trophy,
  Activity,
  Target,
  ShieldAlert,
  Lock,
  Clock,
} from 'lucide-react';
import { Player, MatchResult, Fixture, TournamentFormat } from '../types/tournament';
import {
  getPlayerAdvancedAverages,
  getPlayerMatchHistory,
  getPlayerUpcomingFixtures,
  getPlayerStatusAndCondition,
} from '../utils/standings';
import { getPlayerRegistrationTimestamp } from '../utils/playerDate';

interface PlayerModalProps {
  player: Player | null;
  players?: Player[];
  results: MatchResult[];
  fixtures: Fixture[];
  isAdmin?: boolean;
  isRegistrationOpen?: boolean;
  tournamentFormat?: TournamentFormat;
  onClose: () => void;
  onOpenEditPlayer?: (player: Player) => void;
  onSelectPlayer?: (player: Player) => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  player,
  players = [],
  results,
  fixtures,
  isAdmin,
  isRegistrationOpen = false,
  tournamentFormat,
  onClose,
  onOpenEditPlayer,
  onSelectPlayer,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Prevent background layer web scrolling when modal is open
  useEffect(() => {
    if (player) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [player]);

  const playerMap = useMemo(
    () => new Map<string, Player>(players.map((p) => [p.user, p])),
    [players]
  );

  // Reset default tab cleanly when switching players (if upcoming empty & results exist, show results)
  useEffect(() => {
    if (!player) return;
    const up = getPlayerUpcomingFixtures(player.user, fixtures, results);
    const hist = getPlayerMatchHistory(player.user, results);
    if (up.length === 0 && hist.length > 0) {
      setActiveTab('completed');
    } else {
      setActiveTab('upcoming');
    }
  }, [player?.id, fixtures, results]);

  if (!player) return null;

  const advancedStats = getPlayerAdvancedAverages(player.user, results);
  const winRate =
    player.played > 0 ? Math.round((player.w / player.played) * 100) : 0;
  const cleanTg = player.telegramUsername?.trim().replace(/^@/, '');
  const regStamp = getPlayerRegistrationTimestamp(player);

  const upcomingFixtures = isRegistrationOpen
    ? []
    : getPlayerUpcomingFixtures(player.user, fixtures, results);
  const matchHistory = isRegistrationOpen
    ? []
    : getPlayerMatchHistory(player.user, results);

  const statusCond = !isRegistrationOpen
    ? getPlayerStatusAndCondition(player, upcomingFixtures, matchHistory, tournamentFormat)
    : null;

  const recentForm = (player.form && player.form.length > 0
    ? player.form
    : [...matchHistory].reverse().map((m) => m.outcome)
  ).slice(-5);

  const statusBadgeClass =
    statusCond?.statusTone === 'champion'
      ? 'border-[#eaff28]/80 bg-[#eaff28]/20 text-[#eaff28]'
      : statusCond?.statusTone === 'qualified'
      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-300'
      : statusCond?.statusTone === 'qualifying'
      ? 'border-[#3ce7ff]/70 bg-[#3ce7ff]/20 text-[#3ce7ff]'
      : statusCond?.statusTone === 'eliminated'
      ? 'border-rose-500/70 bg-rose-500/20 text-rose-300'
      : statusCond?.statusTone === 'ready'
      ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
      : 'border-[#3ce7ff]/50 bg-[#071360] text-[#3ce7ff]';

  const conditionBadgeClass =
    statusCond?.conditionTone === 'peak'
      ? 'border-[#eaff28]/80 bg-[#eaff28]/15 text-[#eaff28]'
      : statusCond?.conditionTone === 'good'
      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
      : statusCond?.conditionTone === 'pressure'
      ? 'border-rose-400/60 bg-rose-500/15 text-rose-300'
      : statusCond?.conditionTone === 'steady'
      ? 'border-[#3ce7ff]/60 bg-[#3ce7ff]/15 text-[#3ce7ff]'
      : 'border-[#8e9bd4]/50 bg-[#060a48] text-[#b9c4f0]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050842]/90 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-4 sm:p-5 shadow-[0_0_35px_rgba(60,231,255,0.3)] flex flex-col gap-3 text-left"
      >
        {/* Dedicated Top Safe Header Bar */}
        <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#b9c4f0]">
              Player Dossier
            </span>
            {!isRegistrationOpen && (
              <span className="rounded bg-[#eaff28] px-1.5 py-0.2 text-[10px] font-black text-[#050842]">
                #{player.rank}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && onOpenEditPlayer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditPlayer(player);
                }}
                className="rounded-md border border-[#eaff28]/60 bg-[#eaff28]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#eaff28] transition-colors hover:bg-[#eaff28] hover:text-[#08104e] cursor-pointer"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[#8e9bd4] hover:bg-[#3ce7ff]/10 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Player Profile Header with prominent Club, eFootball Username & separate Contact Links */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <img
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-[#3ce7ff] object-cover shadow-[0_0_15px_rgba(60,231,255,0.35)]"
              src={player.avatarUrl}
              alt={player.user}
              referrerPolicy="no-referrer"
            />
            {!isRegistrationOpen && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-[#eaff28] px-1.5 py-0.2 text-[9px] font-black text-[#050842] border border-[#050842]">
                #{player.rank}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3
                className="font-efootball-stencil font-club-name font-sports text-lg sm:text-xl text-white leading-tight truncate font-bold"
                data-club-name="true"
              >
                {player.team}
              </h3>
              {!isRegistrationOpen && (player.winStreak ?? 0) >= 3 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full border border-orange-500/80 bg-orange-950/80 px-1.5 py-0.2 text-[9px] font-black text-amber-300"
                  title={`On Fire! Won ${player.winStreak} games in a row`}
                >
                  <span>🔥</span>
                  <span>{player.winStreak}W</span>
                </span>
              )}
            </div>

            {/* Clearly display eFootball in-game username */}
            <div className="mt-0.5 flex items-center gap-1">
              <span className="text-[10px] text-[#8e9bd4] font-mono">eFootball:</span>
              <span className="text-xs font-mono font-bold text-[#eaff28] truncate">
                @{player.user}
              </span>
            </div>

            {/* Direct Telegram & Phone Links - Telegram strictly separate and only shown if provided */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {cleanTg && (
                <a
                  href={`https://t.me/${cleanTg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-[#3ce7ff] font-mono bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] px-2 py-0.5 rounded-md border border-[#3ce7ff]/40 transition-colors shadow-sm cursor-pointer group"
                  title={`Open Telegram profile: @${cleanTg}`}
                >
                  <Send className="h-2.5 w-2.5 text-[#3ce7ff] group-hover:text-[#050842] transition-colors" />
                  <span className="truncate max-w-[120px]">@{cleanTg}</span>
                </a>
              )}

              {player.phoneNumber && (
                <a
                  href={`tel:${player.phoneNumber.replace(/[^\d+]/g, '')}`}
                  className="inline-flex items-center gap-1 text-[10px] text-[#eaff28] font-mono bg-[#071360] hover:bg-[#eaff28] hover:text-[#050842] px-2 py-0.5 rounded-md border border-[#eaff28]/40 transition-colors shadow-sm cursor-pointer group"
                  title={`Call / Dial phone number: ${player.phoneNumber}`}
                >
                  <Phone className="h-2.5 w-2.5 text-[#eaff28] group-hover:text-[#050842] transition-colors" />
                  <span>{player.phoneNumber}</span>
                </a>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#8e9bd4]">
              {isRegistrationOpen ? (
                <span className="flex items-center gap-1 font-mono text-[#b9c4f0]">
                  <Calendar className="h-2.5 w-2.5 text-[#3ce7ff]" />
                  <span>
                    Registered: {regStamp.dateStr} · {regStamp.timeStr}
                  </span>
                </span>
              ) : (
                <>
                  <span>
                    Win Rate: <strong className="text-emerald-400 font-bold">{winRate}%</strong>
                  </span>
                  <span>·</span>
                  <span>
                    {player.w}W / {player.d}D / {player.l}L
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* POST-REGISTRATION ONLY: Status, Condition, Goals Scored/Conceded, Upcoming Fixtures & Last Results */}
        {isRegistrationOpen ? (
          <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#060a48]/90 p-3.5 text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 mb-2">
              <Lock className="h-4 w-4" />
            </div>
            <p className="font-sports text-xs font-bold uppercase tracking-wide text-white">
              Registration In Progress
            </p>
            <p className="mt-1 text-[11px] font-mono text-[#8e9bd4] leading-relaxed">
              Player status, form condition, total goals scored/conceded, upcoming fixtures, and match results will appear automatically once player registration ends.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Player Status & Condition Panel */}
            {statusCond && (
              <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060b4f] p-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Status */}
                  <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#040736] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#8e9bd4]">
                      <Trophy className="h-2.5 w-2.5 text-[#eaff28]" />
                      <span>Status</span>
                    </span>
                    <span
                      className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusBadgeClass}`}
                    >
                      {statusCond.statusLabel}
                    </span>
                  </div>

                  {/* Condition */}
                  <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#040736] px-2.5 py-1.5">
                    <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#8e9bd4]">
                      <Activity className="h-2.5 w-2.5 text-[#3ce7ff]" />
                      <span>Condition</span>
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${conditionBadgeClass}`}
                      >
                        <span>{statusCond.conditionArrow}</span>
                        <span>{statusCond.conditionLabel}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Form Strip & Condition Note */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#3ce7ff]/15 text-[10px] font-mono">
                  <span className="text-[#b9c4f0]">
                    Condition: <strong className="text-white">{statusCond.conditionNote}</strong>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#8e9bd4] mr-0.5">Form:</span>
                    {recentForm.length > 0 ? (
                      recentForm.map((res, i) => (
                        <span
                          key={i}
                          className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-black ${
                            res === 'W'
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
                              : res === 'D'
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                              : 'bg-rose-500/25 text-rose-300 border border-rose-400/50'
                          }`}
                        >
                          {res}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#8e9bd4] italic">No matches</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Key Stats + Total Goals Scored & Conceded HUD */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1.5 py-1.5">
                <span className="block text-[8.5px] font-bold text-[#b9c4f0] uppercase">PTS</span>
                <span className="font-sports text-base text-[#eaff28] font-bold leading-none mt-0.5 block">
                  {player.points}
                </span>
              </div>
              <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1.5 py-1.5">
                <span className="block text-[8.5px] font-bold text-[#b9c4f0] uppercase">PLAYED</span>
                <span className="font-sports text-base text-white leading-none mt-0.5 block">
                  {player.played}
                </span>
              </div>
              <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1.5 py-1.5">
                <span className="block text-[8.5px] font-bold text-[#b9c4f0] uppercase">GD</span>
                <span
                  className={`font-sports text-base font-bold leading-none mt-0.5 block ${
                    player.gd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {player.gd > 0 ? `+${player.gd}` : player.gd}
                </span>
              </div>

              {/* Total Goals Scored */}
              <div
                className="rounded-lg border border-emerald-400/30 bg-[#060a48] px-1.5 py-1.5"
                title={`Total goals scored: ${advancedStats.goalsScored} (${advancedStats.goalsPerMatch} / match)`}
              >
                <span className="text-[8.5px] font-bold text-emerald-300 uppercase flex items-center justify-center gap-0.5">
                  <Target className="h-2.5 w-2.5 text-emerald-400" />
                  <span>SCORED (GF)</span>
                </span>
                <span className="font-sports text-sm text-[#eaff28] font-bold leading-none mt-0.5 block">
                  {advancedStats.goalsScored}{' '}
                  <span className="text-[9px] text-[#b9c4f0] font-mono font-normal">
                    ({advancedStats.goalsPerMatch}/m)
                  </span>
                </span>
              </div>

              {/* Total Goals Conceded */}
              <div
                className="rounded-lg border border-rose-400/30 bg-[#060a48] px-1.5 py-1.5"
                title={`Total goals conceded: ${advancedStats.goalsConceded} (${advancedStats.concededPerMatch} / match)`}
              >
                <span className="text-[8.5px] font-bold text-rose-300 uppercase flex items-center justify-center gap-0.5">
                  <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
                  <span>CONCEDED (GA)</span>
                </span>
                <span className="font-sports text-sm text-rose-300 font-bold leading-none mt-0.5 block">
                  {advancedStats.goalsConceded}{' '}
                  <span className="text-[9px] text-[#b9c4f0] font-mono font-normal">
                    ({advancedStats.concededPerMatch}/m)
                  </span>
                </span>
              </div>

              {/* Clean Sheets */}
              <div
                className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1.5 py-1.5"
                title={`${advancedStats.cleanSheets} clean sheets (${advancedStats.cleanSheetPct})`}
              >
                <span className="text-[8.5px] font-bold text-[#3ce7ff] uppercase flex items-center justify-center gap-0.5">
                  <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                  <span>CLEAN</span>
                </span>
                <span className="font-sports text-sm text-emerald-400 font-bold leading-none mt-0.5 block">
                  {advancedStats.cleanSheets}{' '}
                  <span className="text-[9px] text-[#b9c4f0] font-mono font-normal">
                    ({advancedStats.cleanSheetPct})
                  </span>
                </span>
              </div>
            </div>

            {/* 3. Upcoming Fixtures & Last Match Results Tabs */}
            <div className="rounded-xl border border-[#3ce7ff]/25 bg-[#05083f] p-2.5">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#03052b] p-1 border border-[#3ce7ff]/20">
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className={`rounded-md py-1.5 text-[11px] font-sports font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    activeTab === 'upcoming'
                      ? 'bg-[#3ce7ff] text-[#050842] font-black shadow-sm'
                      : 'text-[#b9c4f0] hover:text-white'
                  }`}
                >
                  Upcoming ({upcomingFixtures.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('completed')}
                  className={`rounded-md py-1.5 text-[11px] font-sports font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    activeTab === 'completed'
                      ? 'bg-[#eaff28] text-[#050842] font-black shadow-sm'
                      : 'text-[#b9c4f0] hover:text-white'
                  }`}
                >
                  Last Results ({matchHistory.length})
                </button>
              </div>

              <div className="mt-2.5 max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                {activeTab === 'upcoming' ? (
                  upcomingFixtures.length > 0 ? (
                    upcomingFixtures.map((f) => {
                      const isHome = f.home === player.user;
                      const oppUser = isHome ? f.away : f.home;
                      const oppPlayer = playerMap.get(oppUser);
                      const oppName = oppPlayer?.team || oppUser;
                      const stageLabel = f.stage ? f.stage : `MD ${f.matchday}`;

                      return (
                        <div
                          key={f.id}
                          onClick={() => oppPlayer && onSelectPlayer?.(oppPlayer)}
                          className={`flex items-center justify-between gap-2 rounded-lg border border-[#3ce7ff]/20 bg-[#071056]/80 px-2.5 py-2 text-xs transition-colors ${
                            oppPlayer && onSelectPlayer
                              ? 'hover:border-[#3ce7ff] cursor-pointer'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="rounded bg-[#040632] border border-[#3ce7ff]/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#3ce7ff] shrink-0">
                              {stageLabel}
                            </span>
                            {oppPlayer?.avatarUrl && (
                              <img
                                src={oppPlayer.avatarUrl}
                                alt={oppName}
                                className="h-5 w-5 rounded-full object-cover border border-[#3ce7ff]/50 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="block text-[11px] font-bold text-white truncate">
                                {isHome ? 'vs' : '@'} {oppName}
                              </span>
                              <span className="block text-[9px] font-mono text-[#8e9bd4] truncate">
                                @{oppUser}
                              </span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded bg-[#050842] border border-[#3ce7ff]/25 px-1.5 py-0.5 text-[9px] font-mono text-[#eaff28] shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            <span>Scheduled</span>
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-5 text-center text-[11px] font-mono text-[#8e9bd4]">
                      No upcoming fixtures remaining for this contender.
                    </div>
                  )
                ) : matchHistory.length > 0 ? (
                  matchHistory.map((m) => {
                    const oppPlayer = playerMap.get(m.opponent);
                    const oppName = oppPlayer?.team || m.opponent;
                    const stageLabel = m.stage ? m.stage : `MD ${m.matchday}`;
                    const outcomeColor =
                      m.outcome === 'W'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                        : m.outcome === 'D'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/50';

                    return (
                      <div
                        key={m.id}
                        onClick={() => oppPlayer && onSelectPlayer?.(oppPlayer)}
                        className={`flex items-center justify-between gap-2 rounded-lg border border-[#3ce7ff]/20 bg-[#071056]/80 px-2.5 py-2 text-xs transition-colors ${
                          oppPlayer && onSelectPlayer
                            ? 'hover:border-[#eaff28] cursor-pointer'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-black shrink-0 ${outcomeColor}`}
                          >
                            {m.outcome}
                          </span>
                          <span className="rounded bg-[#040632] border border-[#3ce7ff]/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#3ce7ff] shrink-0">
                            {stageLabel}
                          </span>
                          {oppPlayer?.avatarUrl && (
                            <img
                              src={oppPlayer.avatarUrl}
                              alt={oppName}
                              className="h-5 w-5 rounded-full object-cover border border-[#3ce7ff]/50 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold text-white truncate">
                              {m.isHome ? 'vs' : '@'} {oppName}
                            </span>
                            <span className="block text-[9px] font-mono text-[#8e9bd4] truncate">
                              @{m.opponent}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-sports text-sm font-black text-[#eaff28] bg-[#040632] border border-[#3ce7ff]/30 rounded px-2 py-0.5">
                            {m.myScore} - {m.opponentScore}
                          </span>
                          {m.penaltyWinner && (
                            <span className="block text-[8.5px] font-mono text-[#3ce7ff] mt-0.5">
                              ({m.isHome ? m.penaltyHomeScore : m.penaltyAwayScore}-
                              {m.isHome ? m.penaltyAwayScore : m.penaltyHomeScore} pen)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-5 text-center text-[11px] font-mono text-[#8e9bd4]">
                    No completed matches played yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Card Footer */}
        <div className="border-t border-[#3ce7ff]/15 pt-2.5 mt-1 flex items-center justify-between text-[10px] text-[#8e9bd4] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-300">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>Verified Contender Roster</span>
          </span>
          <span className="text-[#3ce7ff]">Ethiopian eFootball Series</span>
        </div>
      </div>
    </div>
  );
};

