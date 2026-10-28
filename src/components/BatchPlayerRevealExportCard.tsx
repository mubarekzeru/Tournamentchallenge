import React from 'react';
import { ShieldCheck, Send, Phone, Trophy, Sparkles, CheckCircle2, UserCheck, Users, Calendar } from 'lucide-react';
import { Player, TournamentFormat } from '../types/tournament';
import { EFootballLogo } from './EFootballLogo';
import { getPlayerRegistrationTimestamp } from '../utils/playerDate';

export interface BatchPlayerRevealExportCardProps {
  players: Player[];
  totalTournamentPlayers: number;
  tournamentFormat?: TournamentFormat;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  batchTitle?: string;
}

export const BatchPlayerRevealExportCard: React.FC<BatchPlayerRevealExportCardProps> = ({
  players,
  totalTournamentPlayers,
  tournamentFormat = 'league_double',
  cardRef,
  batchTitle = 'NEW REGISTRATIONS UNVEILING',
}) => {
  const currentYear = new Date().getFullYear(); // e.g. 2026 only

  const formatName =
    tournamentFormat === 'knockout' ||
    tournamentFormat === 'group_knockout' ||
    tournamentFormat === 'knockout_cup'
      ? 'Single Elimination Knockout Cup'
      : tournamentFormat === 'group_stage'
      ? 'Group Stage & Knockout Finals'
      : tournamentFormat === 'league_single'
      ? 'Single Leg Round-Robin League'
      : 'Double Leg Premier Championship';

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
      <div className="absolute -right-16 -bottom-16 pointer-events-none opacity-10 flex items-center justify-center">
        <EFootballLogo className="h-[480px] w-[480px] text-[#3ce7ff]" />
      </div>

      {/* Background Glow Orbs */}
      <div className="absolute top-0 right-1/4 h-80 w-80 rounded-full bg-[#3ce7ff]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[#eaff28]/10 blur-3xl pointer-events-none" />

      {/* Header Banner - Strict single line horizontal header */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#3ce7ff]/25 pb-5 mb-7">
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
                OFFICIAL PLAYERS REGISTRATION REVEAL &middot; ETHIOPIAN eFOOTBALL
              </p>
            </div>
            <h1
              className="font-sports text-3xl font-black text-white tracking-wide m-0 my-1 uppercase"
              style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
            >
              {batchTitle}
            </h1>
            <p
              className="text-xs text-[#3ce7ff] font-mono m-0 mt-1"
              style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
            >
              Simultaneous Enlistment &middot; Welcoming {players.length} New Competitors to the Championship
            </p>
          </div>
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-2xl border border-[#3ce7ff]/35 bg-[#071158]/90 px-4 py-2.5 text-right shadow-lg min-w-[150px]">
            <span className="block text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4] whitespace-nowrap">
              TOURNAMENT FORMAT
            </span>
            <span className="font-sports text-xs font-black text-[#eaff28] block whitespace-nowrap uppercase tracking-wide mt-0.5">
              {formatName}
            </span>
          </div>

          <div className="rounded-2xl border border-[#eaff28]/50 bg-[#eaff28]/10 px-4 py-2.5 text-right shadow-lg min-w-[140px]">
            <span className="block text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#3ce7ff] whitespace-nowrap">
              REVEALED TOGETHER
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

      {/* Main Grid of Players Revealed Together */}
      <div className="relative z-10 mb-6">
        {players.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#3ce7ff]/30 bg-[#050842]/40 p-12 text-center">
            <Users className="h-12 w-12 text-[#3ce7ff] mx-auto mb-3" />
            <p className="text-white font-sports text-xl font-bold">No players selected for batch reveal</p>
          </div>
        ) : (
          <div
            className={`grid gap-5 ${
              players.length === 1
                ? 'grid-cols-1 max-w-xl mx-auto'
                : players.length === 2
                ? 'grid-cols-2'
                : players.length === 3
                ? 'grid-cols-3'
                : players.length === 4
                ? 'grid-cols-2'
                : 'grid-cols-3'
            }`}
          >
            {players.map((p, idx) => {
              const reg = getPlayerRegistrationTimestamp(p);
              return (
                <div
                  key={p.id || p.user}
                  className="rounded-3xl border-2 border-[#3ce7ff]/35 bg-gradient-to-b from-[#091568] via-[#050b40] to-[#020524] p-5 shadow-xl relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Header Tag inside Card */}
                  <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-3 mb-4">
                    <div className="flex items-center gap-1.5 rounded-full bg-[#eaff28] text-[#050842] px-3 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider shadow-sm">
                      <UserCheck className="h-3 w-3" />
                      <span>Contender #{idx + 1}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#3ce7ff] font-bold uppercase">
                      Roster Verified
                    </span>
                  </div>

                  {/* Avatar and Basic Credentials Row */}
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#3ce7ff] bg-[#020520] shadow-[0_0_15px_rgba(60,231,255,0.3)]">
                        <img
                          src={p.avatarUrl}
                          alt={p.team}
                          className="w-full h-full object-cover object-center"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#eaff28] text-[#050842] shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#3ce7ff] block">
                        Registered Club
                      </span>
                      <h3 className="font-sports text-xl sm:text-2xl font-black text-white truncate tracking-wide leading-tight my-0.5">
                        {p.team}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-mono text-[#8e9bd4]">Handle:</span>
                        <span className="font-sports text-base font-black text-[#eaff28] tracking-wide truncate">
                          @{p.user}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Coordinates Strip */}
                  <div className="mt-4 pt-3 border-t border-[#3ce7ff]/15 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#030733]/90 border border-[#3ce7ff]/20 p-2 text-left min-w-0">
                      <span className="text-[8.5px] font-mono uppercase text-[#3ce7ff] block font-bold flex items-center gap-1">
                        <Send className="h-2.5 w-2.5 shrink-0" />
                        <span>Telegram</span>
                      </span>
                      <p className="font-mono text-xs font-bold text-white truncate mt-0.5">
                        @{p.telegramUsername ? p.telegramUsername.replace(/^@/, '') : p.user}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#030733]/90 border border-[#3ce7ff]/20 p-2 text-left min-w-0">
                      <span className="text-[8.5px] font-mono uppercase text-emerald-400 block font-bold flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 shrink-0" />
                        <span>Phone Line</span>
                      </span>
                      <p className="font-mono text-xs font-bold text-white truncate mt-0.5">
                        {p.phoneNumber || 'Registered'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Card Footer: Registration Date & Time */}
                  <div className="mt-3 pt-2.5 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[9.5px] font-mono">
                    <span className="flex items-center gap-1.5 text-[#3ce7ff]">
                      <Calendar className="h-3 w-3 text-[#eaff28] shrink-0" />
                      <span>Reg: <strong className="text-white">{reg.dateStr}</strong> · <strong className="text-[#eaff28]">{reg.timeStr}</strong></span>
                    </span>
                    <span className="text-emerald-400 font-bold whitespace-nowrap">&check; Enlisted {currentYear}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Footer Details */}
      <div className="relative z-10 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10.5px] text-[#8e9bd4] font-mono">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#3ce7ff]" />
          <span>Certified Ethiopian eFootball Player Registry &middot; Simultaneous Reveal Card</span>
        </span>
        <span className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-[#eaff28]" />
          <span>Total Tournament Field: <strong className="text-white">{totalTournamentPlayers} Players Active</strong></span>
        </span>
        <span className="text-[#3ce7ff] font-bold">Verified {formattedDate}</span>
      </div>
    </div>
  );
};
