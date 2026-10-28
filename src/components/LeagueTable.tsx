import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Trophy, Flame, Shield, CheckCircle2, Users, Clock } from 'lucide-react';
import { Player, TableSortField, MatchResult, TournamentFormat, GroupStageConfig } from '../types/tournament';
import {
  partitionPlayersIntoGroups,
  calculateGroupStandings,
  DEFAULT_GROUP_CONFIG,
} from '../utils/groupStage';

interface LeagueTableProps {
  players: Player[];
  results?: MatchResult[];
  tournamentFormat?: TournamentFormat;
  config?: GroupStageConfig;
  onSelectPlayer: (player: Player) => void;
}

export const LeagueTable: React.FC<LeagueTableProps> = ({
  players,
  results = [],
  tournamentFormat = 'league_double',
  config = DEFAULT_GROUP_CONFIG,
  onSelectPlayer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [sortField, setSortField] = useState<TableSortField>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeGroupTab, setActiveGroupTab] = useState<string>('A');

  const isGroupStageMode = tournamentFormat === 'group_knockout' || tournamentFormat === 'group_stage';

  // Group stage partition
  const { groups, groupLetters, summaryText } = useMemo(() => {
    return partitionPlayersIntoGroups(players, config, results);
  }, [players, config, results]);

  // Keep activeGroupTab valid
  const currentTab = groupLetters.includes(activeGroupTab) ? activeGroupTab : (groupLetters[0] || 'A');

  const handleSort = (field: TableSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      if (['points', 'gd', 'w', 'played', 'winStreak'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  // Group stage current group calculation
  const currentGroupCalc = useMemo(() => {
    if (!isGroupStageMode) return null;
    const members = groups[currentTab] || [];
    return calculateGroupStandings(
      members,
      results,
      config.qualifiersPerGroup,
      config.manualTieBreakers?.[currentTab]
    );
  }, [isGroupStageMode, groups, currentTab, results, config]);

  // Players to display
  const displayedPlayers = useMemo(() => {
    const list = isGroupStageMode ? (currentGroupCalc?.standings || []) : players;
    return list
      .filter((p) => {
        const term = searchTerm.trim().toLowerCase();
        return p.user.toLowerCase().includes(term) || p.team.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const modifier = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'user') {
          return a.user.localeCompare(b.user) * modifier;
        }
        const valA = ((a[sortField] as number) ?? 0);
        const valB = ((b[sortField] as number) ?? 0);
        return (valA - valB) * modifier;
      });
  }, [isGroupStageMode, currentGroupCalc, players, searchTerm, sortField, sortDirection]);

  return (
    <section id="table" className="py-4 sm:py-6 border-b border-[#3ce7ff]/20 scroll-mt-[105px] w-full px-0 sm:px-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28]">
            {isGroupStageMode ? 'Group Stage Standings' : 'Live Rankings'}
          </p>
          <h2 className="font-efootball-stencil mt-1 text-2xl sm:text-3xl text-white font-bold">League Table</h2>
          {isGroupStageMode && (
            <p className="text-xs text-[#b9c4f0] mt-0.5">
              Individual group standings · Top {config.qualifiersPerGroup} from each group qualify for knockout playoffs
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto md:justify-end">
          <div className="relative w-full sm:w-56 md:w-72 lg:w-80">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e9bd4]" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search player or team..."
              className="w-full rounded-full border border-[#3ce7ff]/60 bg-[#060a48] py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsCompact((prev) => !prev)}
            className={`rounded-full border border-[#3ce7ff] px-3.5 py-1.5 text-[11px] font-bold uppercase transition-colors ${
              isCompact
                ? 'bg-[#3ce7ff] text-[#050842]'
                : 'bg-[#080d51] text-white hover:bg-[#3ce7ff]/20'
            }`}
          >
            {isCompact ? 'Comfortable' : 'Compact'}
          </button>
        </div>
      </div>

      {/* In Group Stage Mode: Show Group Tabs */}
      {isGroupStageMode && (
        <div className="mt-5">
          {groupLetters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#3ce7ff]/20 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b9c4f0] mr-1">
                Select Group:
              </span>
              {groupLetters.map((letter) => {
                const isSelected = currentTab === letter;
                const grpMembers = groups[letter] || [];
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setActiveGroupTab(letter)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-sports font-bold tracking-wider transition-all border ${
                      isSelected
                        ? 'border-[#eaff28] bg-gradient-to-r from-[#eaff28] to-[#99ff33] text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.4)] scale-105'
                        : 'border-[#3ce7ff]/30 bg-[#071056] text-white hover:border-[#3ce7ff] hover:bg-[#0d1670]'
                    }`}
                  >
                    <span>GROUP {letter}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                        isSelected ? 'bg-[#050842] text-[#eaff28]' : 'bg-[#040632] text-[#3ce7ff]'
                      }`}
                    >
                      {grpMembers.length}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#070e52] p-6 text-center my-4">
              <Users className="mx-auto h-8 w-8 text-[#3ce7ff]/60 mb-2" />
              <p className="text-sm text-white font-sports">Groups not drawn yet</p>
            </div>
          )}
        </div>
      )}

      {/* Table Container: Full Fit Edge to Edge */}
      <div className="mt-4 overflow-hidden rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y border-[#3ce7ff]/30 bg-gradient-to-b from-[#0a0f52]/90 to-[#050842]/95 shadow-xl w-full">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs text-white">
            <thead className="bg-[#eaff28] text-[#090d4c] font-sports text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('rank')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline"
                  >
                    <span>#</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('user')}
                    className="flex items-center gap-1 font-extrabold hover:underline"
                  >
                    <span>Player</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('played')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline"
                  >
                    <span>P</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('w')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline"
                  >
                    <span>W</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('d')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline"
                  >
                    <span>D</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('l')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline"
                  >
                    <span>L</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('gd')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline"
                  >
                    <span>GD</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                <th className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('points')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline text-[#050842]"
                  >
                    <span>PTS</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                {/* Form Column */}
                <th className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('winStreak')}
                    className="mx-auto flex items-center justify-center gap-1 font-extrabold hover:underline text-[#050842]"
                    title="Sort by current win streak"
                  >
                    <span>Form</span>
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </button>
                </th>
                {isGroupStageMode && (
                  <th className="py-3 px-4 text-right">Status</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#3ce7ff]/10">
              {displayedPlayers.map((player, idx) => {
                const rankNum = isGroupStageMode ? (player.groupRank || idx + 1) : player.rank;
                const isLeader = rankNum === 1 && player.points > 0;
                const isPodium = rankNum <= 3 && player.points > 0;
                const isQualifyingRow = isGroupStageMode && idx < config.qualifiersPerGroup;
                const isClinched = isGroupStageMode && currentGroupCalc?.isGroupComplete && isQualifyingRow;

                return (
                  <tr
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className={`group cursor-pointer transition-colors hover:bg-[#3ce7ff]/10 ${
                      isQualifyingRow ? 'bg-[#3ce7ff]/5' : isLeader ? 'bg-[#eaff28]/5' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className={`px-4 font-bold text-center ${isCompact ? 'py-2' : 'py-3'}`}>
                      <div className="flex items-center justify-center">
                        {isLeader ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eaff28] text-xs font-black text-[#050842] shadow-[0_0_10px_rgba(234,255,40,0.5)]">
                            1
                          </span>
                        ) : isPodium ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#3ce7ff] text-[10px] font-bold text-[#3ce7ff]">
                            {rankNum}
                          </span>
                        ) : (
                          <span className="text-xs text-[#b9c4f0] font-mono tabular-nums">
                            {rankNum}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Player / Team */}
                    <td className={`px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                      <div className="flex items-center gap-2.5">
                        <img
                          className="h-8 w-8 rounded-full border border-[#3ce7ff] object-cover"
                          src={player.avatarUrl}
                          alt={player.team}
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-efootball-stencil font-club-name font-sports text-sm font-bold text-white group-hover:text-[#eaff28] transition-colors leading-tight" data-club-name="true">
                              {player.team}
                            </span>
                            {isLeader && (
                              <Trophy className="h-3.5 w-3.5 text-[#eaff28]" />
                            )}
                          </div>
                          <span className="block text-[10px] text-[#3ce7ff] font-mono">
                            @{player.user}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Stats */}
                    <td className={`px-3 text-center font-mono tabular-nums font-semibold text-white ${isCompact ? 'py-2' : 'py-3'}`}>
                      {player.played}
                    </td>

                    <td className={`px-3 text-center font-mono tabular-nums font-semibold text-emerald-400 ${isCompact ? 'py-2' : 'py-3'}`}>
                      {player.w}
                    </td>

                    <td className={`px-3 text-center font-mono tabular-nums font-semibold text-[#b9c4f0] ${isCompact ? 'py-2' : 'py-3'}`}>
                      {player.d}
                    </td>

                    <td className={`px-3 text-center font-mono tabular-nums font-semibold text-rose-400 ${isCompact ? 'py-2' : 'py-3'}`}>
                      {player.l}
                    </td>

                    <td className={`px-3 text-center font-mono tabular-nums font-semibold ${isCompact ? 'py-2' : 'py-3'} ${
                      player.gd > 0 ? 'text-emerald-400' : player.gd < 0 ? 'text-rose-400' : 'text-[#b9c4f0]'
                    }`}>
                      {player.gd > 0 ? `+${player.gd}` : player.gd}
                    </td>

                    <td className={`px-4 text-center font-mono tabular-nums font-black text-sm text-[#eaff28] ${isCompact ? 'py-2' : 'py-3'}`}>
                      {player.points}
                    </td>

                    {/* Form Column */}
                    <td className={`px-4 text-center ${isCompact ? 'py-2' : 'py-3'}`}>
                      <div className="flex items-center justify-center gap-2">
                        {player.form && player.form.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {player.form.slice(-5).map((outcome, fIdx) => (
                              <span
                                key={fIdx}
                                className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-[9px] font-extrabold ${
                                  outcome === 'W'
                                    ? 'bg-emerald-500 text-[#050842]'
                                    : outcome === 'D'
                                    ? 'bg-amber-400 text-[#050842]'
                                    : 'bg-rose-500 text-white'
                                }`}
                                title={`Match: ${outcome === 'W' ? 'Win' : outcome === 'D' ? 'Draw' : 'Loss'}`}
                              >
                                {outcome}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#8e9bd4] italic">-</span>
                        )}

                        {(player.winStreak ?? 0) >= 3 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-orange-500/80 bg-gradient-to-r from-orange-500/30 to-amber-500/30 px-2 py-0.5 text-[10px] font-black text-[#eaff28] shadow-[0_0_12px_rgba(255,100,0,0.5)] animate-pulse"
                            title={`Hot Streak! ${player.winStreak} consecutive wins in a row`}
                          >
                            <span>🔥</span>
                            <span>{player.winStreak}W</span>
                          </span>
                        ) : (player.winStreak ?? 0) > 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-[#3ce7ff]/30 bg-[#060a48] px-1.5 py-0.5 text-[9px] font-bold text-[#b9c4f0]"
                            title={`Current Win Streak: ${player.winStreak} win${player.winStreak === 1 ? '' : 's'} in a row`}
                          >
                            <span>{player.winStreak}W</span>
                          </span>
                        ) : player.played > 0 ? (
                          <span className="text-[10px] font-mono text-[#8e9bd4]">
                            0W
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* In Group Stage Mode: Status Badge */}
                    {isGroupStageMode && (
                      <td className="px-4 text-right whitespace-nowrap">
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
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayedPlayers.length === 0 && (
          <div className="p-10 text-center font-efootball-stencil">
            {players.length === 0 ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#eaff28] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#eaff28] shadow-[0_0_25px_rgba(234,255,40,0.3)]">
                  <Clock className="h-8 w-8" />
                </div>
                <h3 className="font-efootball-stencil font-sports mt-4 text-2xl sm:text-3xl font-black text-white tracking-wide">
                  MATCH STARTS SOON
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-[#3ce7ff] font-mono leading-relaxed">
                  Standings, goal difference, and championship points will go live as soon as tournament competitors are registered and the season kicks off.
                </p>
              </>
            ) : (
              <p className="text-xs text-[#b9c4f0]">No player matches "{searchTerm}".</p>
            )}
          </div>
        )}
      </div>

      {/* Tiebreak Explainer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8e9bd4]">
        <p className="flex flex-wrap items-center gap-1.5">
          <span>Tiebreaker order:</span>
          <span className="font-semibold text-[#b9c4f0]">Points (PTS)</span>
          <span>→</span>
          <span className="font-semibold text-[#b9c4f0]">Goal Difference (GD)</span>
          <span>→</span>
          <span className="font-semibold text-[#b9c4f0]">Goals Scored</span>
          <span>→</span>
          <span className="font-semibold text-[#b9c4f0]">Head-to-Head</span>
          {isGroupStageMode && (
            <>
              <span>→</span>
              <span className="font-semibold text-amber-300">Admin Manual Decision</span>
            </>
          )}
        </p>
      </div>
    </section>
  );
};
