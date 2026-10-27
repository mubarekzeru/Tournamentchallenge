import React from 'react';
import { Trophy, Flame, Target, Award, Sparkles, ChevronRight } from 'lucide-react';
import { Player, MatchResult } from '../types/tournament';

interface GoldenBootProps {
  players: Player[];
  results: MatchResult[];
  onSelectPlayer: (player: Player) => void;
}

export const GoldenBoot: React.FC<GoldenBootProps> = ({
  players,
  results,
  onSelectPlayer,
}) => {
  // Sort players by goals scored (gf) descending
  // Tiebreakers: fewer matches played, then higher points, then alphabetical
  const scorers = [...players].sort((a, b) => {
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (a.played !== b.played) return a.played - b.played;
    if (b.points !== a.points) return b.points - a.points;
    return a.user.localeCompare(b.user);
  });

  const topScorer = scorers[0];
  const hasGoals = topScorer && topScorer.gf > 0;
  const maxGoals = hasGoals ? topScorer.gf : 1;

  // Calculate total tournament goals
  const totalGoals = results.reduce(
    (sum, r) => sum + (r.home_score || 0) + (r.away_score || 0),
    0
  );
  const avgGoalsPerMatch =
    results.length > 0 ? (totalGoals / results.length).toFixed(1) : '0.0';

  return (
    <section className="mt-6 sm:mt-8 rounded-none sm:rounded-3xl border-x-0 sm:border-x-2 border-y-2 border-[#eaff28]/40 bg-gradient-to-b from-[#0b1464] via-[#070d47] to-[#04062a] p-3.5 sm:p-7 shadow-[0_0_40px_rgba(234,255,40,0.18)] w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3ce7ff]/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#eaff28] bg-gradient-to-br from-[#ffd700] via-[#eaff28] to-[#b39800] text-[#050842] shadow-[0_0_20px_rgba(234,255,40,0.5)]">
            <Trophy className="h-6 w-6 stroke-[2.5]" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#050842] text-[9px] font-black text-[#eaff28] border border-[#eaff28]">
              ⚽
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#eaff28]">
                Official Award
              </span>
              <span className="rounded-full border border-[#3ce7ff]/40 bg-[#060a48] px-2 py-0.5 text-[9px] font-bold uppercase text-[#3ce7ff]">
                Season One
              </span>
            </div>
            <h2 className="font-sports text-2xl sm:text-3xl text-white tracking-wide">
              Golden Boot Top Scorer
            </h2>
            <p className="text-xs text-[#b9c4f0]">
              Recognizing the deadliest finisher with the highest goals scored in the tournament.
            </p>
          </div>
        </div>

        {/* Global Goal Stats */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] px-3.5 py-2 text-center">
            <span className="block text-[9px] uppercase font-bold tracking-wider text-[#3ce7ff]">
              Total Goals
            </span>
            <span className="font-sports text-xl text-[#eaff28]">{totalGoals}</span>
          </div>
          <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] px-3.5 py-2 text-center">
            <span className="block text-[9px] uppercase font-bold tracking-wider text-[#3ce7ff]">
              Avg Goals/Game
            </span>
            <span className="font-sports text-xl text-white">{avgGoalsPerMatch}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {hasGoals ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-12 items-center">
          {/* Spotlight Hero Card: Top Scorer */}
          <div
            onClick={() => onSelectPlayer(topScorer)}
            className="lg:col-span-5 group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-[#eaff28] bg-gradient-to-b from-[#101c7d] via-[#091054] to-[#040733] p-5 shadow-[0_0_30px_rgba(234,255,40,0.25)] transition-all hover:scale-[1.02]"
          >
            {/* Crown Ribbon */}
            <div className="absolute top-0 right-0 rounded-bl-2xl bg-gradient-to-l from-[#eaff28] to-[#ffd700] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#050842] shadow-md flex items-center gap-1">
              <Sparkles className="h-3 w-3 fill-[#050842]" />
              <span>Current #1 Leader</span>
            </div>

            <div className="flex items-center gap-4 pt-3">
              <div className="relative">
                <img
                  src={topScorer.avatarUrl}
                  alt={topScorer.team}
                  className="h-20 w-20 rounded-2xl border-2 border-[#eaff28] object-cover shadow-[0_0_20px_rgba(234,255,40,0.4)]"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-xl bg-[#eaff28] text-sm font-black text-[#050842] shadow-lg border-2 border-[#050842]">
                  🥇
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#3ce7ff]">
                  Golden Boot Leader
                </p>
                <h3 className="font-efootball-stencil font-club-name font-sports text-2xl text-white group-hover:text-[#eaff28] transition-colors leading-tight truncate font-bold" data-club-name="true">
                  {topScorer.team}
                </h3>
                <span className="block text-xs font-mono text-[#3ce7ff]">
                  @{topScorer.user}
                </span>

                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#eaff28]/40 bg-[#eaff28]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#eaff28]">
                    <Flame className="h-3 w-3 fill-[#eaff28]" />
                    <span>In the Lead</span>
                  </span>
                  {topScorer.winStreak && topScorer.winStreak >= 3 ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/60 bg-orange-950/80 px-2 py-0.5 text-[10px] font-black text-amber-300 shadow-[0_0_10px_rgba(255,100,0,0.4)] animate-pulse">
                      <span>🔥</span>
                      <span>{topScorer.winStreak}W Streak</span>
                    </span>
                  ) : topScorer.winStreak && topScorer.winStreak > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#3ce7ff]/30 bg-[#071056] px-2 py-0.5 text-[10px] font-bold text-[#3ce7ff]">
                      <span>{topScorer.winStreak}W Streak</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Big Stat Showcase */}
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-[#eaff28]/30 bg-[#050842]/90 p-3 text-center">
              <div>
                <span className="block text-[9px] uppercase font-bold text-[#b9c4f0]">
                  Goals Scored
                </span>
                <span className="font-sports text-3xl font-black text-[#eaff28] leading-tight">
                  {topScorer.gf}
                </span>
              </div>
              <div className="border-x border-[#3ce7ff]/20">
                <span className="block text-[9px] uppercase font-bold text-[#b9c4f0]">
                  Matches
                </span>
                <span className="font-sports text-3xl font-black text-white leading-tight">
                  {topScorer.played}
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-[#b9c4f0]">
                  Goals / Match
                </span>
                <span className="font-sports text-3xl font-black text-[#3ce7ff] leading-tight">
                  {topScorer.played > 0
                    ? (topScorer.gf / topScorer.played).toFixed(1)
                    : '0.0'}
                </span>
              </div>
            </div>
          </div>

          {/* Golden Boot Race Leaderboard */}
          <div className="lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b9c4f0] flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[#eaff28]" />
                <span>Top Scorers Standings</span>
              </span>
              <span className="text-[11px] text-[#8e9bd4]">
                Sorted by Goals Scored (GF)
              </span>
            </div>

            <div className="space-y-2">
              {scorers.slice(0, 5).map((player, idx) => {
                const isLeader = idx === 0;
                const ratio = Math.round((player.gf / maxGoals) * 100);
                const goalsPerGame =
                  player.played > 0 ? (player.gf / player.played).toFixed(1) : '0.0';

                return (
                  <div
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className={`group flex items-center gap-3 rounded-xl border p-2.5 transition-all cursor-pointer ${
                      isLeader
                        ? 'border-[#eaff28]/60 bg-[#eaff28]/10 shadow-[0_0_15px_rgba(234,255,40,0.1)]'
                        : 'border-[#3ce7ff]/20 bg-[#060a48]/70 hover:border-[#3ce7ff]/50 hover:bg-[#080d58]'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center font-sports text-sm font-bold">
                      {idx === 0 ? (
                        <span className="text-base">🥇</span>
                      ) : idx === 1 ? (
                        <span className="text-base">🥈</span>
                      ) : idx === 2 ? (
                        <span className="text-base">🥉</span>
                      ) : (
                        <span className="font-mono text-xs text-[#8e9bd4]">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <img
                      src={player.avatarUrl}
                      alt={player.team}
                      className="h-8 w-8 rounded-full border border-[#3ce7ff] object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />

                    {/* Name & Progress Bar */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-efootball-stencil font-club-name font-sports font-bold text-white group-hover:text-[#eaff28] transition-colors truncate" data-club-name="true">
                          {player.team}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#8e9bd4]">
                            {goalsPerGame} G/M
                          </span>
                          <span className="font-sports text-sm font-black text-[#eaff28]">
                            {player.gf} <span className="text-[10px] font-normal text-[#8e9bd4]">goals</span>
                          </span>
                        </div>
                      </div>

                      {/* Goal visual bar */}
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#050842]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isLeader
                              ? 'bg-gradient-to-r from-[#ffd700] to-[#eaff28]'
                              : 'bg-gradient-to-r from-[#3ce7ff] to-[#a5b4fc]'
                          }`}
                          style={{ width: `${Math.max(ratio, 4)}%` }}
                        />
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-[#8e9bd4] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state before matches begin */
        <div className="mt-6 rounded-2xl border border-[#3ce7ff]/20 bg-[#060a48]/60 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#eaff28]/40 bg-[#eaff28]/10 text-[#eaff28] shadow-[0_0_20px_rgba(234,255,40,0.2)]">
            <Award className="h-7 w-7" />
          </div>
          <h3 className="font-sports mt-3 text-xl text-white">The Golden Boot Race Awaits</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[#b9c4f0]">
            No goals scored yet. As match results are recorded, the leading goalscorer will be crowned and showcased here as the league top scorer!
          </p>
        </div>
      )}
    </section>
  );
};
