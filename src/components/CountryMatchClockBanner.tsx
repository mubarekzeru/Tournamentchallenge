import React, { useState, useEffect } from 'react';
import {
  Calendar,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react';
import { MatchClockConfig } from '../types/tournament';
import {
  getMatchClockStatus,
  normalizeClockConfig,
  MatchClockStatus,
  ClockDigits,
} from '../utils/countryClock';

interface CountryMatchClockBannerProps {
  config: MatchClockConfig;
  isAdmin?: boolean;
  onNavigateToAdminClock?: () => void;
  onScrollToFixtures?: () => void;
  className?: string;
}

export const CountryMatchClockBanner: React.FC<CountryMatchClockBannerProps> = ({
  config,
  className = '',
}) => {
  const [now, setNow] = useState<Date>(new Date());

  // Real-time 1-second ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const normalized = normalizeClockConfig(config);

  if (!normalized.enabled) {
    return null;
  }

  const effectiveConfig: MatchClockConfig = {
    ...normalized,
    timeFormat: normalized.timeFormat || '24h',
  };

  const status: MatchClockStatus = getMatchClockStatus(effectiveConfig, now);
  const activeDigits: ClockDigits = status.activeRemaining;

  return (
    <div
      className={`mx-auto w-full max-w-2xl rounded-2xl border ${
        status.phase === 'in_progress'
          ? 'border-[#eaff28]/80 shadow-[0_0_22px_rgba(234,255,40,0.22)]'
          : status.phase === 'concluded'
          ? 'border-gray-600 shadow-md'
          : 'border-[#3ce7ff]/50 shadow-[0_0_22px_rgba(60,231,255,0.18)]'
      } bg-gradient-to-b from-[#071360] via-[#040a44] to-[#020526] p-3 sm:p-4 text-white relative overflow-hidden select-none ${className}`}
    >
      {/* Background glow orbs */}
      <div className="absolute top-0 right-1/4 h-32 w-32 rounded-full bg-[#3ce7ff]/10 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-[#eaff28]/10 blur-2xl pointer-events-none" />

      {/* Minimized Main Content Area */}
      <div className="relative z-10 text-center">
        {/* Matchday Badge */}
        <div className="inline-flex items-center justify-center mb-1">
          <span className="rounded-full bg-[#eaff28] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#050842] shadow-sm font-sports">
            {status.matchdayLabel}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-sports text-base sm:text-xl font-black uppercase tracking-wide text-white m-0">
          {config.title || `${status.matchdayLabel.toUpperCase()} KICKOFF & DUE DATE CLOCK`}
        </h2>

        {/* Compact Status Subtitle */}
        <p className="mt-0.5 text-[11px] sm:text-xs font-mono text-[#3ce7ff] max-w-lg mx-auto">
          {status.phase === 'before_start' && (
            <>
              Kickoff at <strong className="text-[#eaff28]">{status.startTimePhone}</strong> &middot; Closes at{' '}
              <strong className="text-white">{status.endTimePhone}</strong>
            </>
          )}
          {status.phase === 'in_progress' && (
            <>
              <strong className="text-[#eaff28]">{status.matchdayLabel} Live</strong> &middot; Counting down to{' '}
              <strong className="text-white">{status.endTimePhone}</strong> deadline
            </>
          )}
          {status.phase === 'concluded' && (
            <>
              {status.matchdayLabel} closed at <strong className="text-white">{status.endTimePhone}</strong>.
            </>
          )}
        </p>

        {/* Minimized Countdown Timer Display (HH : MM : SS) */}
        {status.phase !== 'concluded' ? (
          <div className="my-3 flex items-center justify-center gap-1.5 sm:gap-3">
            {activeDigits.days > 0 && (
              <>
                <div className="flex flex-col items-center">
                  <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-xl border border-[#3ce7ff]/60 bg-[#040836] shadow-[0_0_12px_rgba(60,231,255,0.18)]">
                    <span className="font-sports text-xl sm:text-2xl font-black text-white leading-none">
                      {String(activeDigits.days).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="mt-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4]">
                    Days
                  </span>
                </div>
                <span className="font-sports text-xl sm:text-2xl font-black text-[#eaff28] pb-4">:</span>
              </>
            )}

            {/* Hours */}
            <div className="flex flex-col items-center">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-xl border border-[#3ce7ff]/60 bg-[#040836] shadow-[0_0_12px_rgba(60,231,255,0.18)]">
                <span className="font-sports text-xl sm:text-2xl font-black text-white leading-none">
                  {String(activeDigits.hours).padStart(2, '0')}
                </span>
              </div>
              <span className="mt-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4]">
                Hours
              </span>
            </div>

            <span className="font-sports text-xl sm:text-2xl font-black text-[#eaff28] pb-4">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-xl border border-[#3ce7ff]/60 bg-[#040836] shadow-[0_0_12px_rgba(60,231,255,0.18)]">
                <span className="font-sports text-xl sm:text-2xl font-black text-white leading-none">
                  {String(activeDigits.minutes).padStart(2, '0')}
                </span>
              </div>
              <span className="mt-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#8e9bd4]">
                Minutes
              </span>
            </div>

            <span className="font-sports text-xl sm:text-2xl font-black text-[#eaff28] pb-4">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-xl border border-[#eaff28] bg-[#040836] shadow-[0_0_12px_rgba(234,255,40,0.25)]">
                <span className="font-sports text-xl sm:text-2xl font-black text-[#eaff28] leading-none">
                  {String(activeDigits.seconds).padStart(2, '0')}
                </span>
              </div>
              <span className="mt-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#eaff28]">
                Seconds
              </span>
            </div>
          </div>
        ) : (
          <div className="my-3 rounded-xl border border-gray-600 bg-[#030728] p-3.5 max-w-sm mx-auto">
            <CheckCircle2 className="h-7 w-7 text-emerald-400 mx-auto mb-1" />
            <h3 className="font-sports text-base font-bold text-white uppercase">
              {status.matchdayLabel} Concluded
            </h3>
            <p className="text-[11px] text-[#b9c4f0] font-mono mt-0.5">
              Closed at {status.endTimePhone}. Matches are recorded.
            </p>
          </div>
        )}

        {/* Compact Progress Bar */}
        {status.phase === 'in_progress' && (
          <div className="my-2 max-w-md mx-auto">
            <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-[#8e9bd4]">
              <span className="text-[#3ce7ff] font-bold">Start: {status.startTimePhone}</span>
              <span className="font-bold text-[#eaff28]">{status.progressPct}% Elapsed</span>
              <span className="text-rose-400 font-bold">Deadline: {status.endTimePhone}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#030728] overflow-hidden border border-[#3ce7ff]/30">
              <div
                className="h-full bg-gradient-to-r from-[#3ce7ff] via-[#eaff28] to-rose-400 transition-all duration-1000"
                style={{ width: `${status.progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Minimized Schedule Milestones Cards */}
        <div className="mt-3 grid grid-cols-2 gap-2 max-w-md mx-auto text-left font-mono">
          {/* Kickoff Card */}
          <div
            className={`rounded-xl border p-2.5 transition-all ${
              status.phase === 'before_start'
                ? 'border-[#3ce7ff] bg-[#071360] shadow-sm'
                : 'border-white/10 bg-[#040830]/80 opacity-85'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#3ce7ff] flex items-center gap-1 truncate">
                <PlayCircle className="h-3 w-3 shrink-0" />
                <span>Kickoff</span>
              </span>
              {status.phase === 'before_start' ? (
                <span className="text-[8.5px] rounded bg-[#3ce7ff]/20 text-[#3ce7ff] px-1 py-0.5 font-bold shrink-0">
                  Counting
                </span>
              ) : (
                <span className="text-[8.5px] rounded bg-emerald-500/20 text-emerald-300 px-1 py-0.5 font-bold shrink-0">
                  ✓ Live
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-sports">
              {status.startTimePhone}
            </div>
            <div className="text-[9px] text-[#8e9bd4] truncate">
              {status.startDateFormatted}
            </div>
          </div>

          {/* Ending Due Time Card */}
          <div
            className={`rounded-xl border p-2.5 transition-all ${
              status.phase === 'in_progress'
                ? 'border-[#eaff28] bg-[#071360] shadow-sm'
                : 'border-white/10 bg-[#040830]/80 opacity-85'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#eaff28] flex items-center gap-1 truncate">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>Due Time</span>
              </span>
              {status.phase === 'in_progress' ? (
                <span className="text-[8.5px] rounded bg-[#eaff28]/20 text-[#eaff28] px-1 py-0.5 font-bold shrink-0">
                  Deadline
                </span>
              ) : status.phase === 'concluded' ? (
                <span className="text-[8.5px] rounded bg-gray-700 text-gray-300 px-1 py-0.5 font-bold shrink-0">
                  Expired
                </span>
              ) : (
                <span className="text-[8.5px] rounded bg-white/10 text-[#8e9bd4] px-1 py-0.5 font-bold shrink-0">
                  Target
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-sports">
              {status.endTimePhone}
            </div>
            <div className="text-[9px] text-[#8e9bd4] truncate">
              {status.endDateFormatted}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
