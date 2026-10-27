import React, { useState } from 'react';
import { Search, Edit3, UserPlus, Lock, Unlock, Flame, ShieldCheck } from 'lucide-react';
import { Player, MatchResult, TournamentFormat, GroupStageConfig } from '../types/tournament';
import { getPlayerAdvancedAverages } from '../utils/standings';
import { GroupCards } from './GroupCards';

interface PlayerRosterProps {
  players: Player[];
  results?: MatchResult[];
  isAdmin: boolean;
  isRegistrationOpen: boolean;
  tournamentFormat?: TournamentFormat;
  config?: GroupStageConfig;
  onSelectPlayer: (player: Player) => void;
  onOpenRegisterPlayer: () => void;
  onOpenEditPlayer: (player: Player) => void;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({
  players,
  results = [],
  isAdmin,
  isRegistrationOpen,
  tournamentFormat = 'league_double',
  config,
  onSelectPlayer,
  onOpenRegisterPlayer,
  onOpenEditPlayer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const isGroupStage = tournamentFormat === 'group_knockout' || tournamentFormat === 'group_stage';

  const filtered = players.filter((player) => {
    const term = searchTerm.trim().toLowerCase();
    return (
      player.team.toLowerCase().includes(term) ||
      player.user.toLowerCase().includes(term)
    );
  });

  return (
    <section id="players" className="py-10 border-b border-[#3ce7ff]/20 scroll-mt-[104px]">
      {/* If Group Stage mode: Display Group Cards at the top of the Players section */}
      {isGroupStage && (
        <GroupCards
          players={players}
          results={results}
          config={config}
          onSelectPlayer={onSelectPlayer}
          title="Group Stage Competitors"
          subtitle="All players organized into their official tournament groups"
        />
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#eaff28]">
              {isGroupStage ? 'All Contestants' : 'Tournament Roster'}
            </p>
            {isRegistrationOpen ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-950/60 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300">
                <Unlock className="h-2.5 w-2.5" />
                <span>Registration Open</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-[#3ce7ff]/30 bg-[#071056] px-2 py-0.5 text-[9px] font-bold text-[#b9c4f0]">
                <Lock className="h-2.5 w-2.5" />
                <span>Roster Locked</span>
              </span>
            )}
          </div>
          <h2 className="font-efootball-stencil mt-1 text-2xl sm:text-3xl text-white font-bold">
            {isGroupStage ? 'Player Profiles & Stats' : 'Teams & Players'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="w-full sm:w-64">
            <label className="sr-only" htmlFor="players-search">
              Search teams or usernames
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e9bd4]" />
              <input
                id="players-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search team or username..."
                className="w-full rounded-full border border-[#3ce7ff]/60 bg-[#060a48] py-2 pl-9 pr-4 text-xs text-white placeholder-[#8e9bd4] transition-all focus:border-[#eaff28] focus:outline-none focus:ring-1 focus:ring-[#eaff28]"
              />
            </div>
          </div>

          {/* Admin Register Player button */}
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenRegisterPlayer}
              disabled={!isRegistrationOpen}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider transition-all ${
                isRegistrationOpen
                  ? 'bg-[#eaff28] text-[#08104e] shadow-lg hover:scale-105 active:scale-95'
                  : 'border border-gray-600 bg-gray-800 text-gray-400 cursor-not-allowed opacity-60'
              }`}
              title={
                isRegistrationOpen
                  ? 'Register a new player (automatically updates fixtures)'
                  : 'Registration locked because tournament matches have already started'
              }
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Register Player</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((player) => {
            const adv = getPlayerAdvancedAverages(player.user, results);

            return (
              <article
                key={player.id}
                onClick={() => onSelectPlayer(player)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#3ce7ff]/30 bg-gradient-to-br from-[#11166d]/90 to-[#050842]/95 p-4 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-[#3ce7ff] hover:shadow-[0_8px_24px_rgba(60,231,255,0.15)]"
              >
                {/* Subtle top accent strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3ce7ff] to-[#eaff28]" />

                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      className="h-14 w-14 rounded-full border-2 border-[#3ce7ff] object-cover shadow-[0_0_12px_rgba(60,231,255,0.4)] transition-transform group-hover:scale-105"
                      src={player.avatarUrl}
                      alt={`${player.team} profile`}
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[#000e8a] border border-[#3ce7ff] text-[10px] font-sports font-black text-[#eaff28]">
                      {isGroupStage ? (player.group || 'A') : (player.rank || 1)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-efootball-stencil font-club-name truncate text-xl text-white group-hover:text-[#eaff28] transition-colors leading-tight font-bold" data-club-name="true">
                            {player.team}
                          </h3>
                        </div>
                        <p className="truncate text-xs font-medium text-[#3ce7ff] font-mono">
                          @{player.user}
                        </p>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditPlayer(player);
                          }}
                          className="rounded-lg p-1 text-[#8e9bd4] transition-colors hover:bg-[#3ce7ff]/15 hover:text-[#eaff28]"
                          title="Edit Club or Gamertag"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Group Badge if in group stage */}
                {isGroupStage && player.group && (
                  <div className="mt-3 flex items-center justify-between border-t border-[#3ce7ff]/15 pt-2 text-[10px]">
                    <span className="rounded bg-[#071360] px-2 py-0.5 font-sports font-bold text-[#eaff28]">
                      GROUP {player.group}
                    </span>
                    <span className="text-[#3ce7ff] font-mono">
                      Rank #{player.groupRank || 1}
                    </span>
                  </div>
                )}

                {/* Form row & Win streak indicator */}
                <div className={`flex items-center justify-between border-t border-[#3ce7ff]/20 pt-2.5 text-xs text-[#b9c4f0] ${isGroupStage && player.group ? 'mt-2' : 'mt-3.5'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#8e9bd4] uppercase tracking-wider">
                      Form:
                    </span>
                    {player.form && player.form.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {player.form.slice(-5).map((outcome, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] text-[8px] font-extrabold ${
                              outcome === 'W'
                                ? 'bg-emerald-500 text-[#050842]'
                                : outcome === 'D'
                                ? 'bg-amber-400 text-[#050842]'
                                : 'bg-rose-500 text-white'
                            }`}
                          >
                            {outcome}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#8e9bd4] italic">-</span>
                    )}
                  </div>

                  {(player.winStreak ?? 0) >= 3 ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-500/80 bg-orange-500/20 px-2 py-0.5 text-[10px] font-black text-[#eaff28] animate-pulse">
                      <Flame className="h-2.5 w-2.5 text-orange-400" />
                      <span>{player.winStreak}W</span>
                    </span>
                  ) : (player.winStreak ?? 0) > 0 ? (
                    <span className="text-[10px] font-mono font-bold text-[#3ce7ff]">
                      {player.winStreak}W Streak
                    </span>
                  ) : null}
                </div>

                {/* Key stats row */}
                <div className="mt-2.5 grid grid-cols-4 rounded-xl border border-[#3ce7ff]/20 bg-[#050842]/90 p-2 text-center">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#8e9bd4] block">
                      MP
                    </span>
                    <strong className="font-mono text-xs font-bold text-white">
                      {player.played}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#8e9bd4] block">
                      W
                    </span>
                    <strong className="font-mono text-xs font-bold text-emerald-400">
                      {player.w}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#8e9bd4] block">
                      GD
                    </span>
                    <strong
                      className={`font-mono text-xs font-bold ${
                        player.gd > 0
                          ? 'text-emerald-400'
                          : player.gd < 0
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}
                    >
                      {player.gd > 0 ? `+${player.gd}` : player.gd}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-[#8e9bd4] block">
                      PTS
                    </span>
                    <strong className="font-sports text-sm font-black text-[#eaff28]">
                      {player.points}
                    </strong>
                  </div>
                </div>

                {/* Advanced statistics metrics */}
                <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#071056]/60 px-2.5 py-1.5 text-[10px] text-[#b9c4f0]">
                  <span title="Goals scored per game average">
                    Avg GF:{' '}
                    <strong className="font-mono text-white">{adv.avgGoalsFor}</strong>
                  </span>
                  <span title="Goals conceded per game average">
                    Avg GA:{' '}
                    <strong className="font-mono text-white">{adv.avgGoalsAgainst}</strong>
                  </span>
                  <span title="Clean sheets kept (shutouts)">
                    CS:{' '}
                    <strong className="font-mono text-emerald-400">{adv.cleanSheets}</strong>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#3ce7ff]/25 bg-[#0a0f52]/70 p-8 text-center text-[#b9c4f0]">
          <p className="text-sm">No teams found matching "{searchTerm}".</p>
        </div>
      )}
    </section>
  );
};
