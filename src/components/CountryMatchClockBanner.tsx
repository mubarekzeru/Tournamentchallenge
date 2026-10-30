import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  AlertCircle,
  PlayCircle,
  Trophy,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Smartphone,
} from 'lucide-react';
import { MatchClockConfig } from '../types/tournament';
import { getMatchClockStatus, MatchClockStatus, ClockDigits } from '../utils/countryClock';

interface CountryMatchClockBannerProps {
  config: MatchClockConfig;
  isAdmin?: boolean;
  onNavigateToAdminClock?: () => void;
  onScrollToFixtures?: () => void;
  className?: string;
}

export const CountryMatchClockBanner: React.FC<CountryMatchClockBannerProps> = ({
  config,
  isAdmin = false,
  onNavigateToAdminClock,
  onScrollToFixtures,
  className = '',
}) => {
  const [now, setNow] = useState<Date>(new Date());
  // User toggleable local phone display format: '24h' (e.g. 21:00) vs '12h' (e.g. 9:00 PM)
  const [phoneFormatOverride, setPhoneFormatOverride] = useState<'24h' | '12h' | null>(null);

  // Real-time 1-second ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!config.enabled) {
    return null;
  }

  const effectiveConfig: MatchClockConfig = {
    ...config,
    timeFormat: phoneFormatOverride || config.timeFormat || '24h',
  };

  const status: MatchClockStatus = getMatchClockStatus(effectiveConfig, now);
  const activeDigits: ClockDigits = status.activeRemaining;

  const showEthiopia = config.countryZone === 'both' || config.countryZone === 'Africa/Addis_Ababa';
  const showLocal = config.countryZone === 'both' || config.countryZone === 'local';

  const togglePhoneTimeFormat = () => {
    const current = effectiveConfig.timeFormat || '24h';
    setPhoneFormatOverride(current === '24h' ? '12h' : '24h');
  };

  return (
    <div
      className={`mx-auto w-full max-w-4xl md:max-w-5xl rounded-3xl border-2 ${
        status.phase === 'in_progress'
          ? 'border-[#eaff28] shadow-[0_0_35px_rgba(234,255,40,0.35)]'
          : status.phase === 'concluded'
          ? 'border-gray-600 shadow-lg'
          : 'border-[#3ce7ff]/60 shadow-[0_0_35px_rgba(60,231,255,0.25)]'
      } bg-gradient-to-b from-[#071360] via-[#040a44] to-[#020526] p-4 sm:p-6 text-white relative overflow-hidden select-none ${className}`}
    >
      {/* Background glow orbs */}
      <div className="absolute top-0 right-1/4 h-56 w-56 rounded-full bg-[#3ce7ff]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-[#eaff28]/10 blur-3xl pointer-events-none" />

      {/* Top Bar: Country Clock & Phone Clock Strip */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#3ce7ff]/20 pb-3 mb-4">
        {/* Country Clocks */}
        <div className="flex flex-wrap items-center gap-2.5">
          {showEthiopia && (
            <div className="flex items-center gap-2 rounded-xl bg-[#030733]/90 border border-[#eaff28]/50 px-3 py-1.5 shadow-sm">
              <span className="text-base" role="img" aria-label="Ethiopia Flag">
                🇪🇹
              </span>
              <div>
                <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#eaff28]">
                  Ethiopia Country Clock
                </span>
                <span className="font-mono text-xs sm:text-sm font-black text-white tracking-wider">
                  {status.ethiopiaNow.timeStr}{' '}
                  <span className="text-[10px] text-[#eaff28] font-bold">EAT</span>
                </span>
              </div>
            </div>
          )}

          {showLocal && (
            <div className="flex items-center gap-2 rounded-xl bg-[#030733]/90 border border-[#3ce7ff]/40 px-3 py-1.5 shadow-sm">
              <Smartphone className="h-4 w-4 text-[#3ce7ff]" />
              <div>
                <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#3ce7ff]">
                  Your Phone Clock ({status.localNow.tzLabel})
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider">
                  {status.localNow.timeStr}
                </span>
              </div>
            </div>
          )}

          {/* Phone Counting Style Toggle */}
          <button
            type="button"
            onClick={togglePhoneTimeFormat}
            className="flex items-center gap-1 rounded-lg border border-[#3ce7ff]/30 bg-[#050b3d] hover:bg-[#071360] px-2.5 py-1 text-[10px] font-mono font-bold text-[#b9c4f0] hover:text-[#eaff28] transition-colors"
            title="Click to toggle between 24-hour (21:00) and 12-hour (9:00 PM) phone style"
          >
            <span>Phone Style:</span>
            <span className="text-[#eaff28] uppercase font-black">
              {effectiveConfig.timeFormat === '12h' ? '12-Hour' : '24-Hour'}
            </span>
          </button>
        </div>

        {/* Phase Pill & Optional Admin Adjust Shortcut */}
        <div className="flex items-center gap-2 ml-auto">
          {status.phase === 'before_start' && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#3ce7ff]/15 border border-[#3ce7ff]/60 px-3 py-1 text-[11px] font-mono font-black uppercase text-[#3ce7ff] tracking-wider animate-pulse">
              <Clock className="h-3.5 w-3.5" />
              <span>Kickoff In: {status.phoneTimerString}</span>
            </div>
          )}

          {status.phase === 'in_progress' && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#eaff28]/15 border border-[#eaff28] px-3 py-1 text-[11px] font-mono font-black uppercase text-[#eaff28] tracking-wider shadow-[0_0_12px_rgba(234,255,40,0.3)]">
              <span className="h-2 w-2 rounded-full bg-[#eaff28] animate-ping" />
              <span>Matchday Live · Due in: {status.phoneTimerString}</span>
            </div>
          )}

          {status.phase === 'concluded' && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 border border-gray-600 px-3 py-1 text-[11px] font-mono font-black uppercase text-gray-300 tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Matchday Concluded</span>
            </div>
          )}

          {isAdmin && onNavigateToAdminClock && (
            <button
              type="button"
              onClick={onNavigateToAdminClock}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3ce7ff]/30 bg-[#06105c] hover:bg-[#3ce7ff] hover:text-[#050842] px-2.5 py-1 text-[10.5px] font-mono font-bold text-[#3ce7ff] transition-colors"
              title="Adjust Matchday Schedule & Country Clock in Admin"
            >
              <Sliders className="h-3 w-3" />
              <span>Adjust</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Focused specifically on the MATCHDAY */}
      <div className="relative z-10 text-center">
        {/* Matchday Badge & Schedule Window */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-2">
          <span className="rounded-full bg-[#eaff28] px-3 py-0.5 text-xs font-black uppercase text-[#050842] shadow-sm font-sports">
            {status.matchdayLabel}
          </span>
          <span className="rounded-full border border-[#3ce7ff]/50 bg-[#061058] px-3 py-0.5 text-xs font-mono font-black text-[#3ce7ff]">
            Kickoff {status.startTimePhone} &middot; Ends {status.endTimePhone}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-sports text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wide text-white m-0">
          {config.title || `${status.matchdayLabel.toUpperCase()} KICKOFF & DUE DATE CLOCK`}
        </h2>

        {/* Matchday Explanation subtitle */}
        <p className="mt-1 text-xs sm:text-sm font-mono text-[#3ce7ff] max-w-2xl mx-auto">
          {status.phase === 'before_start' && (
            <>
              Counting down to <strong className="text-[#eaff28]">{status.matchdayLabel} kickoff at {status.startTimePhone}</strong>. Once started, the closing due date clock counts down automatically until <strong className="text-white">{status.endTimePhone}</strong>.
            </>
          )}
          {status.phase === 'in_progress' && (
            <>
              <strong className="text-[#eaff28]">{status.matchdayLabel} is currently live!</strong> Counting down to the <strong className="text-white">{status.endTimePhone} matchday deadline</strong>. Complete and submit all matches!
            </>
          )}
          {status.phase === 'concluded' && (
            <>
              {status.matchdayLabel} closed at <strong className="text-white">{status.endTimePhone}</strong>. All scores for this round are recorded.
            </>
          )}
        </p>

        {/* Local Phone Countdown Style Timer Display (HH : MM : SS) */}
        {status.phase !== 'concluded' ? (
          <div>
            <div className="my-5 flex items-center justify-center gap-2 sm:gap-4 md:gap-5">
              {/* Optional Days Box (only if days > 0) */}
              {activeDigits.days > 0 && (
                <>
                  <div className="flex flex-col items-center">
                    <div className="grid h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 place-items-center rounded-2xl border-2 border-[#3ce7ff]/60 bg-[#040836] shadow-[0_0_20px_rgba(60,231,255,0.2)]">
                      <span className="font-sports text-2xl sm:text-4xl md:text-5xl font-black text-white leading-none">
                        {String(activeDigits.days).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="mt-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#8e9bd4]">
                      Days
                    </span>
                  </div>
                  <span className="font-sports text-2xl sm:text-4xl font-black text-[#eaff28] pb-6">:</span>
                </>
              )}

              {/* Hours */}
              <div className="flex flex-col items-center">
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 place-items-center rounded-2xl border-2 border-[#3ce7ff]/60 bg-[#040836] shadow-[0_0_20px_rgba(60,231,255,0.2)]">
                  <span className="font-sports text-2xl sm:text-4xl md:text-5xl font-black text-white leading-none">
                    {String(activeDigits.hours).padStart(2, '0')}
                  </span>
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#8e9bd4]">
                  Hours
                </span>
              </div>

              <span className="font-sports text-2xl sm:text-4xl font-black text-[#eaff28] pb-6">:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center">
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 place-items-center rounded-2xl border-2 border-[#3ce7ff]/60 bg-[#040836] shadow-[0_0_20px_rgba(60,231,255,0.2)]">
                  <span className="font-sports text-2xl sm:text-4xl md:text-5xl font-black text-white leading-none">
                    {String(activeDigits.minutes).padStart(2, '0')}
                  </span>
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#8e9bd4]">
                  Minutes
                </span>
              </div>

              <span className="font-sports text-2xl sm:text-4xl font-black text-[#eaff28] pb-6">:</span>

              {/* Seconds */}
              <div className="flex flex-col items-center">
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 place-items-center rounded-2xl border-2 border-[#eaff28] bg-[#040836] shadow-[0_0_20px_rgba(234,255,40,0.3)]">
                  <span className="font-sports text-2xl sm:text-4xl md:text-5xl font-black text-[#eaff28] leading-none">
                    {String(activeDigits.seconds).padStart(2, '0')}
                  </span>
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#eaff28]">
                  Seconds
                </span>
              </div>
            </div>

            {/* Phone Lockscreen Style Time Readout Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#eaff28]/40 bg-[#061058] px-4 py-1 text-xs font-mono text-[#eaff28] shadow-sm">
              <Smartphone className="h-3.5 w-3.5" />
              <span>
                Local Phone Countdown Style:{' '}
                <strong className="text-white tracking-widest">{status.phoneTimerString}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="my-5 rounded-2xl border border-gray-600 bg-[#030728] p-6 max-w-md mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <h3 className="font-sports text-xl font-bold text-white uppercase">
              {status.matchdayLabel} Concluded
            </h3>
            <p className="text-xs text-[#b9c4f0] font-mono mt-1">
              {status.matchdayLabel} deadline ended at {status.endTimePhone}. Matches are officially recorded.
            </p>
          </div>
        )}

        {/* Progress Bar (During In Progress Phase: e.g. 21:00 to 23:00) */}
        {status.phase === 'in_progress' && (
          <div className="my-3 max-w-xl mx-auto">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-[#8e9bd4]">
              <span className="text-[#3ce7ff] font-bold">Start: {status.startTimePhone}</span>
              <span className="font-bold text-[#eaff28]">
                {status.progressPct}% Matchday Elapsed
              </span>
              <span className="text-rose-400 font-bold">Deadline: {status.endTimePhone}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#030728] overflow-hidden border border-[#3ce7ff]/30">
              <div
                className="h-full bg-gradient-to-r from-[#3ce7ff] via-[#eaff28] to-rose-400 transition-all duration-1000"
                style={{ width: `${status.progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Matchday Schedule Milestones Cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left font-mono">
          {/* Kickoff Card */}
          <div
            className={`rounded-2xl border p-3.5 transition-all ${
              status.phase === 'before_start'
                ? 'border-[#3ce7ff] bg-[#071360] shadow-md'
                : 'border-white/10 bg-[#040830]/80 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3ce7ff] flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" />
                <span>1. {status.matchdayLabel} Kickoff</span>
              </span>
              {status.phase === 'before_start' ? (
                <span className="text-[9px] rounded bg-[#3ce7ff]/20 text-[#3ce7ff] px-1.5 py-0.5 font-bold">
                  Active Counting
                </span>
              ) : (
                <span className="text-[9px] rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 font-bold">
                  ✓ Started
                </span>
              )}
            </div>
            <div className="text-sm sm:text-base font-black text-white font-sports">
              {status.startTimePhone}
            </div>
            <div className="text-[10px] text-[#8e9bd4] mt-0.5 truncate">
              {status.startDateFormatted}
            </div>
          </div>

          {/* Ending Due Time Card */}
          <div
            className={`rounded-2xl border p-3.5 transition-all ${
              status.phase === 'in_progress'
                ? 'border-[#eaff28] bg-[#071360] shadow-md'
                : 'border-white/10 bg-[#040830]/80 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#eaff28] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>2. {status.matchdayLabel} Due Time</span>
              </span>
              {status.phase === 'in_progress' ? (
                <span className="text-[9px] rounded bg-[#eaff28]/20 text-[#eaff28] px-1.5 py-0.5 font-bold animate-pulse">
                  Active Deadline
                </span>
              ) : status.phase === 'concluded' ? (
                <span className="text-[9px] rounded bg-gray-700 text-gray-300 px-1.5 py-0.5 font-bold">
                  Expired
                </span>
              ) : (
                <span className="text-[9px] rounded bg-white/10 text-[#8e9bd4] px-1.5 py-0.5 font-bold">
                  Next Step
                </span>
              )}
            </div>
            <div className="text-sm sm:text-base font-black text-white font-sports">
              {status.endTimePhone}
            </div>
            <div className="text-[10px] text-[#8e9bd4] mt-0.5 truncate">
              {status.endDateFormatted}
            </div>
          </div>
        </div>

        {/* Jump to Fixtures Shortcut */}
        {onScrollToFixtures && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onScrollToFixtures}
              className="inline-flex items-center gap-1 text-xs font-mono text-[#3ce7ff] hover:text-[#eaff28] underline transition-colors cursor-pointer"
            >
              <span>View {status.matchdayLabel} Fixtures &amp; Competitor Lineup</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
