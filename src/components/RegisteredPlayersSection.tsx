import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Send,
  Phone,
  Calendar,
  Sparkles,
  Check,
  Copy,
  ShieldCheck,
  Lock,
  Unlock,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Player } from '../types/tournament';
import { getPlayerRegistrationTimestamp } from '../utils/playerDate';
import { EFootballLogo } from './EFootballLogo';

interface RegisteredPlayersSectionProps {
  players: Player[];
  isRegistrationOpen: boolean;
  isAdmin: boolean;
  onOpenRegisterPlayer?: () => void;
  onSelectPlayer?: (player: Player) => void;
  onToggleRegistration?: (ended?: boolean) => void;
  onToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const RegisteredPlayersSection: React.FC<RegisteredPlayersSectionProps> = ({
  players,
  isRegistrationOpen,
  isAdmin,
  onOpenRegisterPlayer,
  onSelectPlayer,
  onToggleRegistration,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, label?: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      if (onToast) onToast(`Copied ${label || text} to clipboard!`, 'info');
    } catch {
      if (onToast) onToast('Failed to copy to clipboard', 'error');
    }
  };

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase().trim();
    return players.filter(
      (p) =>
        p.user.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        (p.telegramUsername && p.telegramUsername.toLowerCase().includes(q)) ||
        (p.phoneNumber && p.phoneNumber.includes(q))
    );
  }, [players, searchQuery]);

  return (
    <section
      id="registered-players"
      className="py-10 border-b border-[#3ce7ff]/20 scroll-mt-20 font-efootball-stencil"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        {/* Header Block */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#3ce7ff]/20 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 rounded-full border border-[#3ce7ff]/40 bg-[#071360] px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#3ce7ff]">
                <EFootballLogo className="h-3 w-3" />
                <span>Verified Contender Lineup</span>
              </span>

              {isRegistrationOpen ? (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Registration Open · Upcoming Matches Hidden</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-950/70 px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                  <Lock className="h-3 w-3" />
                  <span>Registration Ended · Upcoming Matches Revealed</span>
                </span>
              )}
            </div>

            <h2 className="font-sports text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wide text-white m-0">
              CURRENT REGISTERED PLAYERS
            </h2>

            <p className="mt-1 text-xs sm:text-sm font-mono text-[#b9c4f0] max-w-2xl">
              {isRegistrationOpen ? (
                <>
                  <strong className="text-[#eaff28]">Player registration is underway!</strong> Upcoming matches and pairing fixtures are temporarily hidden until registration has ended. All registered contenders are listed below:
                </>
              ) : (
                <>
                  Official tournament competitor roster is locked. All upcoming matches and championship fixtures are now active and revealed!
                </>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl bg-[#050842] border border-[#3ce7ff]/40 px-3.5 py-2 text-xs font-mono font-bold text-[#3ce7ff]">
              {players.length} Contenders Enlisted
            </span>

            {isRegistrationOpen && onOpenRegisterPlayer && (
              <button
                type="button"
                onClick={onOpenRegisterPlayer}
                className="flex items-center gap-1.5 rounded-xl bg-[#eaff28] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#050842] shadow-[0_0_15px_rgba(234,255,40,0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer font-sports"
              >
                <UserPlus className="h-4 w-4" />
                <span>Register as Player</span>
              </button>
            )}

            {/* Admin Quick Registration Toggle */}
            {isAdmin && onToggleRegistration && (
              <button
                type="button"
                onClick={() => onToggleRegistration(!isRegistrationOpen ? false : true)}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isRegistrationOpen
                    ? 'border-amber-400/60 bg-amber-950/70 text-amber-300 hover:bg-amber-900/80 hover:text-white'
                    : 'border-emerald-500/60 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/80 hover:text-white'
                }`}
                title={
                  isRegistrationOpen
                    ? 'End registration and reveal upcoming matches on the main page'
                    : 'Re-open registration (hides upcoming matches again)'
                }
              >
                {isRegistrationOpen ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>End Registration &amp; Reveal Matches</span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Re-Open Registration</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Filter Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#3ce7ff]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contender by club, @handle, or phone..."
              className="w-full rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] pl-9.5 pr-4 py-2 text-xs font-mono text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
            />
          </div>

          <div className="text-xs font-mono text-[#8e9bd4]">
            Showing <strong className="text-white">{filteredPlayers.length}</strong> of{' '}
            <strong className="text-[#eaff28]">{players.length}</strong> players
          </div>
        </div>

        {/* Players Roster Grid */}
        {players.length === 0 ? (
          <div className="mt-6 rounded-3xl border-2 border-dashed border-[#3ce7ff]/30 bg-[#050842]/50 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#3ce7ff]/40 bg-[#071360] text-[#3ce7ff] shadow-[0_0_25px_rgba(60,231,255,0.25)]">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-4 font-sports text-2xl font-black text-white">
              NO CONTENDERS REGISTERED YET
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm font-mono text-[#b9c4f0]">
              The competitor lineup is currently open for enlistment. Click <strong className="text-[#eaff28]">"Register as Player"</strong> above to join the season!
            </p>
            {onOpenRegisterPlayer && (
              <button
                type="button"
                onClick={onOpenRegisterPlayer}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#eaff28] px-5 py-2.5 text-xs font-black uppercase text-[#050842] shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer font-sports"
              >
                <UserPlus className="h-4 w-4" />
                <span>Register First Player</span>
              </button>
            )}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#3ce7ff]/30 bg-[#050842]/40 p-8 text-center text-xs font-mono text-[#8e9bd4]">
            No registered players match "{searchQuery}". Clear your search query to see all players.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlayers.map((p, idx) => {
              const reg = getPlayerRegistrationTimestamp(p);

              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#3ce7ff]/30 bg-gradient-to-b from-[#071056] to-[#040836] p-4 transition-all hover:border-[#eaff28] hover:shadow-[0_0_20px_rgba(234,255,40,0.15)] group relative"
                >
                  <div>
                    {/* Top Row: Avatar, Club Name, Seed/Number */}
                    <div className="flex items-start justify-between gap-3">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectPlayer?.(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') onSelectPlayer?.(p);
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer text-left focus:outline-none"
                        title={`Click to view ${p.team} (@${p.user}) official contender profile`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={p.avatarUrl}
                            alt={p.team}
                            className="h-12 w-12 rounded-full border-2 border-[#3ce7ff] object-cover shadow-sm group-hover:border-[#eaff28] group-hover:scale-105 transition-all"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-[#050842] font-black border border-[#050842]">
                            ✓
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <strong className="block text-sm font-black text-white truncate font-sports group-hover:text-[#eaff28] transition-colors">
                            {p.team}
                          </strong>
                          <span className="block text-[11px] text-[#3ce7ff] font-mono truncate leading-tight mt-0.5">
                            @{p.user}
                          </span>
                        </div>
                      </div>

                      <span className="rounded-lg bg-[#050842] border border-[#3ce7ff]/30 px-2 py-0.5 text-[10px] font-mono font-bold text-[#8e9bd4] shrink-0">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Contact Channels Row: Telegram & Phone */}
                    <div className="mt-3.5 pt-2.5 border-t border-[#3ce7ff]/15 space-y-2">
                      {/* Telegram Handle */}
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#8e9bd4] flex items-center gap-1.5 shrink-0">
                          <Send className="h-3 w-3 text-[#3ce7ff]" />
                          <span>Telegram:</span>
                        </span>
                        <div className="flex items-center gap-1 min-w-0">
                          <a
                            href={`https://t.me/${(p.telegramUsername || p.user).replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[#3ce7ff] truncate max-w-[120px] bg-[#071360] hover:bg-[#3ce7ff] hover:text-[#050842] px-2 py-0.5 rounded border border-[#3ce7ff]/30 transition-colors cursor-pointer"
                            title={`Open Telegram profile: @${(p.telegramUsername || p.user).replace(/^@/, '')}`}
                          >
                            @{p.telegramUsername || p.user}
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                `@${(p.telegramUsername || p.user).replace(/^@/, '')}`,
                                `tg-card-${p.id}`,
                                `@${(p.telegramUsername || p.user).replace(/^@/, '')}`
                              )
                            }
                            className="rounded p-1 text-[#3ce7ff] hover:bg-[#3ce7ff]/20 transition-colors shrink-0"
                            title="Copy Telegram username"
                          >
                            {copiedKey === `tg-card-${p.id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#8e9bd4] flex items-center gap-1.5 shrink-0">
                          <Phone className="h-3 w-3 text-[#eaff28]" />
                          <span>Phone:</span>
                        </span>
                        {p.phoneNumber ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <a
                              href={`tel:${p.phoneNumber.replace(/[^\d+]/g, '')}`}
                              className="font-bold text-[#eaff28] truncate max-w-[120px] bg-[#071360] hover:bg-[#eaff28] hover:text-[#050842] px-2 py-0.5 rounded border border-[#eaff28]/30 transition-colors cursor-pointer"
                              title={`Direct dial: ${p.phoneNumber}`}
                            >
                              {p.phoneNumber}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(p.phoneNumber!, `phone-card-${p.id}`, p.phoneNumber)}
                              className="rounded p-1 text-[#eaff28] hover:bg-[#eaff28]/20 transition-colors shrink-0"
                              title="Copy phone number"
                            >
                              {copiedKey === `phone-card-${p.id}` ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#8e9bd4] text-[10px] italic">Not provided</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Registration Date & Time Stamp */}
                  <div className="mt-3 pt-2.5 border-t border-[#3ce7ff]/15">
                    <div className="flex items-center justify-between text-[10.5px] font-mono text-[#8e9bd4]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-[#3ce7ff]" />
                        <span>Registered:</span>
                      </span>
                      <span className="text-white font-semibold">
                        {reg.dateStr} &middot; <strong className="text-[#eaff28]">{reg.timeStr}</strong>
                      </span>
                    </div>

                    {/* View Profile Action Link */}
                    <button
                      type="button"
                      onClick={() => onSelectPlayer?.(p)}
                      className="mt-2.5 w-full flex items-center justify-center gap-1 rounded-xl border border-[#3ce7ff]/30 bg-[#060e4a] hover:bg-[#3ce7ff] hover:text-[#050842] py-1.5 text-[11px] font-mono font-bold text-[#3ce7ff] transition-all cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      <span>View Contender Profile</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
