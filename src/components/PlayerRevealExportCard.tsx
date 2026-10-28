import React from 'react';
import { ShieldCheck, Send, Phone, Trophy, Sparkles, CheckCircle2, UserCheck, Users, Calendar, Clock } from 'lucide-react';
import { Player, TournamentFormat } from '../types/tournament';
import { EFootballLogo } from './EFootballLogo';
import { getPlayerRegistrationTimestamp } from '../utils/playerDate';

export interface PlayerRevealExportCardProps {
  player: Player;
  totalPlayers: number;
  playerNumber?: number;
  tournamentFormat?: TournamentFormat;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const PlayerRevealExportCard: React.FC<PlayerRevealExportCardProps> = ({
  player,
  totalPlayers,
  playerNumber = 1,
  tournamentFormat = 'league_double',
  cardRef,
}) => {
  const currentYear = new Date().getFullYear(); // e.g. 2026 only
  const reg = getPlayerRegistrationTimestamp(player);

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
      <div className="absolute top-0 right-1/4 h-72 w-72 rounded-full bg-[#3ce7ff]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-[#eaff28]/10 blur-3xl pointer-events-none" />

      {/* Header Banner - Strict single line horizontal header */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#3ce7ff]/25 pb-5 mb-8">
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
                OFFICIAL PLAYER REGISTRATION REVEAL &middot; ETHIOPIAN eFOOTBALL
              </p>
            </div>
            <h2
              className="font-sports text-3xl font-black text-white tracking-wide m-0 my-0.5 uppercase"
              style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
            >
              NEW PLAYER UNVEILING &amp; REVEAL
            </h2>
            <p
              className="text-xs text-[#3ce7ff] font-mono m-0 mt-1"
              style={{ lineHeight: '1.2', whiteSpace: 'nowrap' }}
            >
              Verified Competitor Enlistment &middot; Official Ethiopian Esports League Registry &middot; {currentYear}
            </p>
          </div>
        </div>

        {/* Right Status Badges - Clean distinct lines, no overlapping */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#050842] border border-[#eaff28]/60 px-4 py-1 text-xs font-mono font-black uppercase text-[#eaff28] tracking-wider shadow-sm whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5 text-[#eaff28] shrink-0" />
            <span>Contender #{playerNumber} of {totalPlayers}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-[#8e9bd4] whitespace-nowrap">
            <span>Total Registration:</span>
            <span className="font-bold text-white bg-[#071360] px-2 py-0.5 rounded border border-[#3ce7ff]/30 text-[#eaff28]">
              {totalPlayers} Players
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#3ce7ff] whitespace-nowrap">
            <Calendar className="h-3.5 w-3.5 text-[#eaff28]" />
            <span>Registered: <strong className="text-white">{reg.dateStr}</strong> · <strong className="text-[#eaff28]">{reg.timeStr}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Showcase Grid */}
      <div className="relative z-10 grid grid-cols-12 gap-8 items-center my-4">
        {/* Left Column: Player Avatar Portrait Card */}
        <div className="col-span-5 flex flex-col items-center justify-center">
          <div className="relative p-2.5 rounded-3xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#091568] via-[#050b40] to-[#020524] shadow-[0_0_40px_rgba(60,231,255,0.35)]">
            {/* Top Badge Stamp */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#eaff28] text-[#050842] px-4 py-1 rounded-full border-2 border-[#050842] text-[10.5px] font-mono font-black uppercase tracking-wider shadow-md whitespace-nowrap flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Official Contender #{playerNumber}</span>
            </div>

            {/* Avatar Frame */}
            <div className="w-[300px] h-[300px] rounded-2xl overflow-hidden border-2 border-[#3ce7ff]/60 bg-[#020520] relative">
              <img
                src={player.avatarUrl}
                alt={player.team}
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#020520]/80 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Bottom Avatar Pill */}
            <div className="mt-3 text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#eaff28] uppercase">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Roster Identity Confirmed</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Player Profile & Tournament Dossier */}
        <div className="col-span-7 flex flex-col justify-between space-y-4">
          {/* Team Name & Wordmark Box */}
          <div className="rounded-2xl border border-[#3ce7ff]/30 bg-[#040a44]/80 p-6 shadow-lg min-h-[140px] flex flex-col justify-center">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#3ce7ff] block mb-1">
              REGISTERED CLUB IDENTITY
            </span>
            <h1
              className="font-sports text-4xl sm:text-5xl font-black text-white tracking-wide m-0 leading-tight truncate"
              style={{ lineHeight: '1.15' }}
            >
              {player.team}
            </h1>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#3ce7ff]/20 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8e9bd4] font-mono">Player Handle:</span>
                <span className="font-sports text-xl font-black text-[#eaff28] tracking-wide">
                  @{player.user}
                </span>
              </div>
              <span className="h-4 w-px bg-[#3ce7ff]/30" />
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#8e9bd4]">
                <Calendar className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span>Registered: <strong className="text-white">{reg.dateStr}</strong> <span className="text-[#eaff28]">({reg.timeStr})</span></span>
              </div>
              <span className="h-4 w-px bg-[#3ce7ff]/30" />
              <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
                Season {currentYear} Active
              </span>
            </div>
          </div>

          {/* Contact & Registration Coordinates Box */}
          <div className="grid grid-cols-2 gap-4">
            {/* Telegram Coordinate */}
            <div className="rounded-2xl border border-[#3ce7ff]/25 bg-[#030733]/90 p-4">
              <div className="flex items-center gap-2 text-xs text-[#8e9bd4] font-mono mb-1.5">
                <Send className="h-3.5 w-3.5 text-[#3ce7ff]" />
                <span className="uppercase text-[10px] font-bold text-[#3ce7ff]">Telegram Channel</span>
              </div>
              <p className="font-mono text-sm font-bold text-white m-0 truncate">
                {player.telegramUsername ? `@${player.telegramUsername.replace(/^@/, '')}` : `@${player.user}`}
              </p>
              <span className="text-[9.5px] text-emerald-400 font-mono mt-1.5 block">
                Official Matchday Dispatch
              </span>
            </div>

            {/* Phone Number */}
            <div className="rounded-2xl border border-[#3ce7ff]/25 bg-[#030733]/90 p-4">
              <div className="flex items-center gap-2 text-xs text-[#8e9bd4] font-mono mb-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-400" />
                <span className="uppercase text-[10px] font-bold text-emerald-400">Phone Contact</span>
              </div>
              <p className="font-mono text-sm font-bold text-white m-0 truncate">
                {player.phoneNumber || 'Contact Registered'}
              </p>
              <span className="text-[9.5px] text-[#3ce7ff] font-mono mt-1.5 block">
                Direct Liaison Line
              </span>
            </div>
          </div>

          {/* Tournament Entry Details Banner - Fixed Layout: Separate Columns & Zero Overlap */}
          <div className="rounded-2xl border border-[#eaff28]/40 bg-[#06105c]/80 p-4 flex items-center justify-between min-h-[76px]">
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#eaff28]/60 bg-[#eaff28]/15 text-[#eaff28] shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase text-[#eaff28] block font-bold tracking-wider">
                  Competition Format
                </span>
                <span className="font-sports text-sm font-black text-white block uppercase tracking-wide truncate mt-0.5">
                  {formatName}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0 pl-5 border-l border-[#3ce7ff]/25">
              <span className="text-[10px] font-mono uppercase text-[#8e9bd4] block font-bold tracking-wider whitespace-nowrap">
                Total Competitors Pool
              </span>
              <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                <span className="font-sports text-2xl font-black text-[#eaff28] leading-none">
                  {totalPlayers}
                </span>
                <span className="text-xs font-mono font-bold text-white uppercase whitespace-nowrap">
                  Registered Teams
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Poster Footer Stamp */}
      <div className="mt-8 pt-4 border-t border-[#3ce7ff]/20 flex items-center justify-between text-[10.5px] text-[#8e9bd4] font-mono relative z-10">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#3ce7ff]" />
          <span>Certified Ethiopian eFootball Player Registry &middot; Official Player Reveal Poster</span>
        </span>
        <span className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-[#eaff28]" />
          <span>Roster Count: <strong className="text-white">{totalPlayers} Players Active</strong></span>
        </span>
        <span>Telegram Announcement Broadcast Ready</span>
      </div>
    </div>
  );
};
