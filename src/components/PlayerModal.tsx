import React, { useEffect } from 'react';
import { Flame, ShieldCheck, Phone, Send, X } from 'lucide-react';
import { Player, MatchResult, Fixture } from '../types/tournament';
import { getPlayerAdvancedAverages } from '../utils/standings';

interface PlayerModalProps {
  player: Player | null;
  players?: Player[];
  results: MatchResult[];
  fixtures: Fixture[];
  isAdmin?: boolean;
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
  onClose,
  onOpenEditPlayer,
  onSelectPlayer,
}) => {
  // Prevent background layer web scrolling when modal is open
  useEffect(() => {
    if (player) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [player]);

  if (!player) return null;

  const advancedStats = getPlayerAdvancedAverages(player.user, results);
  const winRate =
    player.played > 0 ? Math.round((player.w / player.played) * 100) : 0;
  const cleanTg = player.telegramUsername?.trim().replace(/^@/, '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050842]/90 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-4 sm:p-5 shadow-[0_0_35px_rgba(60,231,255,0.3)] flex flex-col gap-3 text-left">
        {/* Dedicated Top Safe Header Bar */}
        <div className="flex items-center justify-between border-b border-[#3ce7ff]/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#b9c4f0]">
              Player Dossier
            </span>
            <span className="rounded bg-[#eaff28] px-1.5 py-0.2 text-[10px] font-black text-[#050842]">
              #{player.rank}
            </span>
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
            <span className="absolute -bottom-1 -right-1 rounded-full bg-[#eaff28] px-1.5 py-0.2 text-[9px] font-black text-[#050842] border border-[#050842]">
              #{player.rank}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-efootball-stencil font-club-name font-sports text-lg sm:text-xl text-white leading-tight truncate font-bold" data-club-name="true">
                {player.team}
              </h3>
              {(player.winStreak ?? 0) >= 3 && (
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
              <span>Win Rate: <strong className="text-emerald-400 font-bold">{winRate}%</strong></span>
              <span>·</span>
              <span>{player.w}W / {player.d}D / {player.l}L</span>
            </div>
          </div>
        </div>

        {/* Compact Key Stats HUD (PTS, PLAYED, GD, RANK, GOALS, CLEAN) */}
        <div className="grid grid-cols-6 gap-1.5 text-center mt-1">
          <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1 py-1.5">
            <span className="block text-[8px] font-bold text-[#b9c4f0] uppercase">PTS</span>
            <span className="font-sports text-sm sm:text-base text-[#eaff28] font-bold leading-none mt-0.5 block">{player.points}</span>
          </div>
          <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1 py-1.5">
            <span className="block text-[8px] font-bold text-[#b9c4f0] uppercase">PLAYED</span>
            <span className="font-sports text-sm sm:text-base text-white leading-none mt-0.5 block">{player.played}</span>
          </div>
          <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1 py-1.5">
            <span className="block text-[8px] font-bold text-[#b9c4f0] uppercase">GD</span>
            <span className={`font-sports text-sm sm:text-base font-bold leading-none mt-0.5 block ${player.gd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {player.gd > 0 ? `+${player.gd}` : player.gd}
            </span>
          </div>
          <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1 py-1.5">
            <span className="block text-[8px] font-bold text-[#b9c4f0] uppercase">RANK</span>
            <span className="font-sports text-sm sm:text-base text-[#3ce7ff] font-bold leading-none mt-0.5 block">#{player.rank}</span>
          </div>
          <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1 py-1.5" title={`${advancedStats.goalsScored} goals total (${advancedStats.goalsPerMatch} / match)`}>
            <span className="text-[8px] font-bold text-[#3ce7ff] uppercase truncate flex items-center justify-center gap-0.5">
              <Flame className="h-2 w-2 text-[#eaff28]" />
              <span>GOALS</span>
            </span>
            <span className="font-sports text-xs sm:text-sm text-[#eaff28] font-bold leading-none mt-0.5 block">
              {advancedStats.goalsScored} <span className="text-[8px] text-[#b9c4f0] font-sans font-normal">({advancedStats.goalsPerMatch})</span>
            </span>
          </div>
          <div className="rounded-lg border border-[#3ce7ff]/20 bg-[#060a48] px-1 py-1.5" title={`${advancedStats.cleanSheets} clean sheets (${advancedStats.cleanSheetPct})`}>
            <span className="text-[8px] font-bold text-emerald-300 uppercase truncate flex items-center justify-center gap-0.5">
              <ShieldCheck className="h-2 w-2 text-emerald-400" />
              <span>CLEAN</span>
            </span>
            <span className="font-sports text-xs sm:text-sm text-emerald-400 font-bold leading-none mt-0.5 block">
              {advancedStats.cleanSheets} <span className="text-[8px] text-[#b9c4f0] font-sans font-normal">({advancedStats.cleanSheetPct})</span>
            </span>
          </div>
        </div>

        {/* Card Footer: Clean verified card stamp without match lists */}
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
