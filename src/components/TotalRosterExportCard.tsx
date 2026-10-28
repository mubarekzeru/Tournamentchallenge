import React from 'react';
import { Users, ShieldCheck, Trophy, Sparkles, Send, Phone, CheckCircle2, Calendar, Clock } from 'lucide-react';
import { Player, TournamentFormat } from '../types/tournament';
import { EFootballLogo } from './EFootballLogo';
import { getPlayerRegistrationTimestamp } from '../utils/playerDate';

export interface TotalRosterExportCardProps {
  players: Player[];
  tournamentFormat?: TournamentFormat;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const TotalRosterExportCard: React.FC<TotalRosterExportCardProps> = ({
  players,
  tournamentFormat = 'league_double',
  cardRef,
}) => {
  const currentYear = new Date().getFullYear(); // e.g. 2026 only
  const formatName =
    tournamentFormat === 'knockout' ||
    tournamentFormat === 'group_knockout' ||
    tournamentFormat === 'knockout_cup'
      ? 'Direct Knockout Cup'
      : tournamentFormat === 'group_stage'
      ? 'Group Stage & Knockout Finals'
      : tournamentFormat === 'league_single'
      ? 'Single Leg League'
      : 'Double Leg Premier Championship';

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const uniqueClubsCount = new Set(players.map((p) => p.team.trim().toLowerCase())).size;

  return (
    <div
      ref={cardRef}
      className="w-[1240px] min-w-[1240px] mx-auto rounded-3xl border-2 border-[#3ce7ff]/40 bg-gradient-to-br from-[#060c44] via-[#030628] to-[#010214] p-8 shadow-2xl relative select-none overflow-hidden"
      style={{
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Background Graphic Watermark */}
      <div className="absolute -right-20 -bottom-20 pointer-events-none opacity-10 flex items-center justify-center">
        <EFootballLogo className="h-[520px] w-[520px] text-[#3ce7ff]" />
      </div>

      {/* Background Glow Orbs */}
      <div className="absolute top-0 right-1/4 h-80 w-80 rounded-full bg-[#3ce7ff]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[#eaff28]/10 blur-3xl pointer-events-none" />

      {/* Header Banner - Strict single line horizontal header */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#3ce7ff]/25 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-[#eaff28] bg-gradient-to-br from-[#071360] to-[#01062b] text-[#eaff28] p-2.5 shadow-[0_0_20px_rgba(234,255,40,0.35)] shrink-0">
            <EFootballLogo className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1" style={{ whiteSpace: 'nowrap' }}>
              <span className="h-2 w-2 rounded-full bg-[#eaff28] shadow-[0_0_8px_#eaff28] shrink-0 inline-block" />
              <p
                className="font-sports text-[11px] font-black uppercase tracking-wider text-[#eaff28] m-0"
                style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
              >
                OFFICIAL TOURNAMENT ROSTER &middot; ETHIOPIAN eFOOTBALL
              </p>
            </div>
            <h1
              className="font-sports text-3xl font-black uppercase tracking-wide text-white m-0 my-0.5"
              style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
            >
              ALL REGISTERED COMPETITORS
            </h1>
            <p
              className="text-xs font-mono text-[#3ce7ff] tracking-wide mt-1 m-0"
              style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
            >
              Official Competitor Lineup &middot; Verified eFootball Contenders &middot; Active Clubs
            </p>
          </div>
        </div>

        {/* Right Status Badges - Roomy boxes, clean spacing, no clipping */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-2xl border border-[#3ce7ff]/35 bg-[#071158]/90 px-4 py-2.5 text-right shadow-lg min-w-[170px]">
            <span className="block text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4] whitespace-nowrap">
              TOURNAMENT FORMAT
            </span>
            <span className="font-sports text-xs font-black text-[#eaff28] block whitespace-nowrap uppercase tracking-wide mt-0.5">
              {formatName}
            </span>
          </div>

          <div className="rounded-2xl border border-[#eaff28]/50 bg-[#eaff28]/10 px-4 py-2.5 text-right shadow-lg min-w-[150px]">
            <span className="block text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#3ce7ff] whitespace-nowrap">
              TOTAL REGISTERED
            </span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <span className="font-sports text-2xl font-black text-white leading-none">
                {players.length}
              </span>
              <span className="text-xs font-mono font-black text-[#eaff28] uppercase">
                PLAYERS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip - Separate big numbers and clean labels */}
      <div className="relative z-10 grid grid-cols-4 gap-4 mb-6">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#071158]/80 p-4 flex items-center gap-3.5 shadow-md">
          <div className="h-11 w-11 rounded-xl bg-[#3ce7ff]/20 text-[#3ce7ff] flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4] whitespace-nowrap">
              TOTAL COMPETITORS
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-sports text-2xl font-black text-white leading-none">
                {players.length}
              </span>
              <span className="text-xs font-mono font-bold text-[#3ce7ff] uppercase">
                Registered
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#071158]/80 p-4 flex items-center gap-3.5 shadow-md">
          <div className="h-11 w-11 rounded-xl bg-[#eaff28]/20 text-[#eaff28] flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4] whitespace-nowrap">
              REPRESENTED CLUBS
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-sports text-2xl font-black text-[#eaff28] leading-none">
                {uniqueClubsCount}
              </span>
              <span className="text-xs font-mono font-bold text-[#b9c4f0] uppercase">
                Active Teams
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#071158]/80 p-4 flex items-center gap-3.5 shadow-md">
          <div className="h-11 w-11 rounded-xl bg-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4] whitespace-nowrap">
              VERIFICATION STATUS
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-sports text-2xl font-black text-emerald-400 leading-none">
                100%
              </span>
              <span className="text-xs font-mono font-bold text-white uppercase">
                Certified
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#071158]/80 p-4 flex items-center gap-3.5 shadow-md">
          <div className="h-11 w-11 rounded-xl bg-cyan-400/20 text-cyan-400 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4] whitespace-nowrap">
              CURRENT YEAR
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-sports text-2xl font-black text-[#3ce7ff] leading-none">
                {currentYear}
              </span>
              <span className="text-xs font-mono font-bold text-white uppercase">
                Season
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Players Multi-Column Grid */}
      <div className="relative z-10">
        {players.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#3ce7ff]/30 bg-[#050842]/40 p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#3ce7ff]/40 bg-[#071360] text-[#3ce7ff]">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="font-sports text-2xl font-black text-white mt-4">
              NO PLAYERS REGISTERED YET
            </h3>
            <p className="text-sm text-[#b9c4f0] mt-1 font-mono">
              Match starts soon once contestants register for the tournament.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-4 ${
              players.length === 1
                ? 'grid-cols-1 max-w-xl mx-auto'
                : players.length === 2
                ? 'grid-cols-2'
                : players.length === 3
                ? 'grid-cols-3'
                : players.length <= 8
                ? 'grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-3 lg:grid-cols-4'
            }`}
          >
            {players.map((p, idx) => {
              const reg = getPlayerRegistrationTimestamp(p);
              return (
                <div
                  key={p.id || p.user}
                  className="rounded-2xl border border-[#3ce7ff]/30 bg-gradient-to-br from-[#071158] via-[#050b40] to-[#030628] p-4 shadow-md flex items-center gap-3.5 relative overflow-hidden"
                >
                  {/* Contender Index Pill */}
                  <div className="absolute top-2.5 right-2.5 rounded-md bg-[#020520] border border-[#3ce7ff]/30 px-2 py-0.5 text-[9.5px] font-mono font-bold text-[#3ce7ff]">
                    #{idx + 1}
                  </div>

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#3ce7ff] bg-[#03072b] shadow-[0_0_12px_rgba(60,231,255,0.25)]">
                      <img
                        src={p.avatarUrl}
                        alt={p.team}
                        className="w-full h-full object-cover object-center"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#eaff28] text-[#050842]">
                      <CheckCircle2 className="h-3 w-3 stroke-[3]" />
                    </span>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1 pr-6">
                    {/* Team / Club Name */}
                    <h4 className="font-sports text-sm sm:text-base font-black text-white truncate tracking-wide leading-tight">
                      {p.team}
                    </h4>

                    {/* Username */}
                    <p className="text-xs font-mono text-[#3ce7ff] font-bold truncate leading-tight mt-0.5">
                      @{p.user}
                    </p>

                    {/* Registration Date & Time Badge */}
                    <div className="mt-1 flex items-center gap-1 text-[9.5px] font-mono text-[#b9c4f0] whitespace-nowrap">
                      <Calendar className="h-2.5 w-2.5 text-[#3ce7ff] shrink-0" />
                      <span>Reg:</span>
                      <span className="text-white font-bold">{reg.dateStr}</span>
                      <span className="text-[#8e9bd4]">&middot;</span>
                      <span className="text-[#eaff28] font-bold">{reg.timeStr}</span>
                    </div>

                    {/* Contact Badges */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                      <span className="inline-flex items-center gap-1 rounded bg-[#030930] px-2 py-0.5 text-[#3ce7ff] border border-[#3ce7ff]/20 truncate max-w-[130px]">
                        <Send className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">@{p.telegramUsername || p.user}</span>
                      </span>

                      {p.phoneNumber && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#030930] px-2 py-0.5 text-[#eaff28] border border-[#eaff28]/20 truncate max-w-[125px]">
                          <Phone className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{p.phoneNumber}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Official Footer Banner */}
      <div className="relative z-10 mt-8 pt-5 border-t border-[#3ce7ff]/20 flex items-center justify-between text-xs text-[#8e9bd4] font-mono">
        <div className="flex items-center gap-2">
          <EFootballLogo className="h-4 w-4 text-[#eaff28]" />
          <span className="text-white font-bold tracking-wider">
            ETHIOPIAN eFOOTBALL TOURNAMENT SERIES
          </span>
          <span>&middot;</span>
          <span>Broadcast High-Resolution Output</span>
        </div>

        <div className="flex items-center gap-4">
          <span>Official Registration Bulletin</span>
          <span>&middot;</span>
          <span className="text-[#3ce7ff] font-bold">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};
