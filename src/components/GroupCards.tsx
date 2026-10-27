import React from 'react';
import { Trophy, Shield, Users, CheckCircle2 } from 'lucide-react';
import { Player, MatchResult, GroupStageConfig } from '../types/tournament';
import {
  partitionPlayersIntoGroups,
  calculateGroupStandings,
  DEFAULT_GROUP_CONFIG,
} from '../utils/groupStage';

interface GroupCardsProps {
  players: Player[];
  results: MatchResult[];
  config?: GroupStageConfig;
  onSelectPlayer?: (player: Player) => void;
  title?: string;
  subtitle?: string;
}

export const GroupCards: React.FC<GroupCardsProps> = ({
  players,
  results,
  config = DEFAULT_GROUP_CONFIG,
  onSelectPlayer,
  title = 'Tournament Groups',
  subtitle = 'Live intra-group standings and qualifying positions',
}) => {
  const { groups, groupLetters, summaryText } = partitionPlayersIntoGroups(
    players,
    config,
    results
  );

  if (players.length === 0 || groupLetters.length === 0) {
    return (
      <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#070e52] p-8 text-center my-6">
        <Users className="mx-auto h-10 w-10 text-[#3ce7ff]/60 mb-2" />
        <h3 className="font-sports text-lg text-white">Groups not drawn yet</h3>
        <p className="text-xs text-[#8e9bd4] mt-1">
          Once players are registered and tournament starts, groups will be displayed here.
        </p>
      </div>
    );
  }

  return (
    <div className="my-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#3ce7ff]/20 pb-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#eaff28]">
            Group Stage Pools
          </p>
          <h3 className="font-sports text-2xl text-white">{title}</h3>
          <p className="text-xs text-[#b9c4f0] mt-0.5">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#071360] px-3.5 py-1.5 text-xs font-mono text-[#3ce7ff]">
          <span className="font-bold text-[#eaff28] mr-1">Structure:</span>
          <span>{summaryText}</span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {groupLetters.map((letter) => {
          const groupMembers = groups[letter] || [];
          const calc = calculateGroupStandings(
            groupMembers,
            results,
            config.qualifiersPerGroup,
            config.manualTieBreakers?.[letter]
          );

          return (
            <div
              key={letter}
              className="overflow-hidden rounded-2xl border border-[#3ce7ff]/40 bg-gradient-to-b from-[#09115d] to-[#040632] shadow-xl"
            >
              {/* Card Header: GROUP A, GROUP B, etc. */}
              <div className="flex items-center justify-between border-b border-[#3ce7ff]/25 bg-[#050842] px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl border border-[#eaff28] bg-[#071158] font-sports text-base font-black text-[#eaff28] shadow-[0_0_12px_rgba(234,255,40,0.3)]">
                    {letter}
                  </div>
                  <div>
                    <h4 className="font-sports text-lg text-white tracking-wide">
                      GROUP {letter}
                    </h4>
                    <span className="text-[10px] text-[#3ce7ff] font-semibold">
                      {groupMembers.length} Members · Top {config.qualifiersPerGroup} Advance
                    </span>
                  </div>
                </div>

                {calc.isGroupComplete ? (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 uppercase">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Group Complete</span>
                  </span>
                ) : (
                  <span className="rounded-full border border-[#3ce7ff]/40 bg-[#071158] px-2.5 py-0.5 text-[10px] font-bold text-[#b9c4f0]">
                    {calc.completedGroupMatches}/{calc.totalGroupMatches} Played
                  </span>
                )}
              </div>

              {/* Tie message warning if manual decision required */}
              {calc.hasTie && calc.tieMessage && (
                <div className="border-b border-amber-400/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 flex items-center justify-between">
                  <span>⚠️ {calc.tieMessage}</span>
                  <span className="text-[10px] font-bold uppercase underline">Admin needed</span>
                </div>
              )}

              {/* Mini Table inside each Card */}
              <div className="p-4 sm:p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#3ce7ff]/20 text-[10px] font-extrabold uppercase tracking-wider text-[#8e9bd4]">
                        <th className="pb-2 w-8 text-center">#</th>
                        <th className="pb-2">Player / Club</th>
                        <th className="pb-2 text-center w-8">P</th>
                        <th className="pb-2 text-center w-8">W</th>
                        <th className="pb-2 text-center w-8">D</th>
                        <th className="pb-2 text-center w-8">L</th>
                        <th className="pb-2 text-center w-9">GD</th>
                        <th className="pb-2 text-center w-10 font-bold text-[#eaff28]">Pts</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3ce7ff]/10">
                      {calc.standings.map((p, idx) => {
                        const isQualifyingRow = idx < config.qualifiersPerGroup;
                        const isClinched = calc.isGroupComplete && isQualifyingRow;

                        return (
                          <tr
                            key={p.id}
                            onClick={() => onSelectPlayer && onSelectPlayer(p)}
                            className={`group cursor-pointer transition-colors hover:bg-[#3ce7ff]/10 ${
                              isQualifyingRow ? 'bg-[#3ce7ff]/5' : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-2.5 text-center font-sports text-sm">
                              <span
                                className={`inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
                                  idx === 0
                                    ? 'border border-[#eaff28] bg-[#eaff28] text-[#050842]'
                                    : idx === 1
                                    ? 'border border-[#3ce7ff] bg-[#3ce7ff]/20 text-[#3ce7ff]'
                                    : 'text-[#8e9bd4]'
                                }`}
                              >
                                {p.groupRank || idx + 1}
                              </span>
                            </td>

                            {/* Player info: Avatar, Name, Gamertag, Club */}
                            <td className="py-2.5 pr-2">
                              <div className="flex items-center gap-2.5 min-w-[130px]">
                                <img
                                  src={p.avatarUrl}
                                  alt={p.team}
                                  className="h-7 w-7 rounded-full border border-[#3ce7ff] object-cover shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="truncate min-w-0">
                                  <strong className="block font-efootball-stencil font-club-name font-sports text-xs sm:text-sm text-white group-hover:text-[#eaff28] transition-colors truncate font-bold" data-club-name="true">
                                    {p.team}
                                  </strong>
                                  <span className="block text-[9px] text-[#3ce7ff] font-mono truncate">
                                    @{p.user}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Stats */}
                            <td className="py-2.5 text-center font-mono text-white/90">
                              {p.played}
                            </td>
                            <td className="py-2.5 text-center font-mono text-emerald-400 font-bold">
                              {p.w}
                            </td>
                            <td className="py-2.5 text-center font-mono text-white/70">
                              {p.d}
                            </td>
                            <td className="py-2.5 text-center font-mono text-rose-400/90">
                              {p.l}
                            </td>
                            <td className="py-2.5 text-center font-mono text-xs">
                              <span
                                className={
                                  p.gd > 0
                                    ? 'text-emerald-400 font-bold'
                                    : p.gd < 0
                                    ? 'text-rose-400'
                                    : 'text-[#8e9bd4]'
                                }
                              >
                                {p.gd > 0 ? `+${p.gd}` : p.gd}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-sports text-sm font-black text-[#eaff28]">
                              {p.points}
                            </td>

                            {/* Badge */}
                            <td className="py-2.5 text-right whitespace-nowrap">
                              {isClinched ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                                  <Trophy className="h-2.5 w-2.5" />
                                  <span>Qualified</span>
                                </span>
                              ) : isQualifyingRow ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-[#3ce7ff]/50 bg-[#3ce7ff]/15 px-2 py-0.5 text-[9px] font-bold uppercase text-[#3ce7ff]">
                                  <Shield className="h-2.5 w-2.5" />
                                  <span>Qualifying</span>
                                </span>
                              ) : (
                                <span className="text-[9px] text-[#8e9bd4]/60 uppercase">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
