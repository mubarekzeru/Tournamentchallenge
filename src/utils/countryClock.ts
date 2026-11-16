import { MatchClockConfig } from '../types/tournament';

export const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa';

export interface ClockDigits {
  days: number;
  hours: number;
  totalHours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isPast: boolean;
}

export type ClockPhase = 'before_start' | 'in_progress' | 'concluded';

export interface MatchClockStatus {
  phase: ClockPhase;
  phaseLabel: string;
  matchday: number;
  matchdayLabel: string;
  startRemaining: ClockDigits;
  endRemaining: ClockDigits;
  activeRemaining: ClockDigits;
  phoneTimerString: string; // e.g. "08:15:30" (phone countdown timer style)
  endTimerString: string; // Remaining time to ending deadline (e.g. 23:00)
  progressPct: number;
  startTimePhone: string; // e.g. "14:25" or "21:00"
  endTimePhone: string; // e.g. "23:00"
  startDateFormatted: string;
  endDateFormatted: string;
  isSameDay: boolean;
  effectiveStartIso: string;
  effectiveEndIso: string;
  ethiopiaNow: {
    timeStr: string;
    dateStr: string;
    fullStr: string;
    tzLabel: string;
  };
  localNow: {
    timeStr: string;
    dateStr: string;
    fullStr: string;
    tzLabel: string;
  };
}

/**
 * Returns YYYY-MM-DD in the phone's local calendar (or Ethiopia calendar when explicitly requested)
 */
export function getTodayLocalDateStr(
  date: Date = new Date(),
  useEthiopiaTz: boolean = false
): string {
  try {
    if (useEthiopiaTz) {
      const formatted = date.toLocaleDateString('en-CA', {
        timeZone: ETHIOPIA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
        return formatted;
      }
    }
  } catch {}
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Extracts HH:mm string from a Date using local phone time (or Ethiopia EAT if specified)
 */
export function getTimeHHmm(
  date: Date = new Date(),
  useEthiopiaTz: boolean = false
): string {
  try {
    if (useEthiopiaTz) {
      const formatted = date.toLocaleTimeString('en-GB', {
        timeZone: ETHIOPIA_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const clean = formatted.slice(0, 5);
      if (/^\d{2}:\d{2}$/.test(clean)) return clean;
    }
  } catch {}
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolveHour12Option(format: '24h' | '12h' | 'auto'): boolean | undefined {
  if (format === '12h') return true;
  if (format === '24h') return false;
  return undefined;
}

/**
 * Formats time in phone style (defaults to 24-hour e.g. "23:00", or 12-hour "11:00 PM", or device auto)
 */
export function formatPhoneTime(
  date: Date,
  format: '24h' | '12h' | 'auto' = '24h',
  timezone?: string
): string {
  try {
    const hour12Opt = resolveHour12Option(format);
    const locale = format === '24h' ? 'en-GB' : [];
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    };
    if (hour12Opt !== undefined) {
      options.hour12 = hour12Opt;
    }
    return date.toLocaleTimeString(locale, options);
  } catch {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Formats clock digits into phone countdown timer style (e.g. "08:15:30" or "1d 02:15:00")
 */
export function formatPhoneTimerDigits(
  digits: ClockDigits,
  compactDays: boolean = true
): string {
  const pad = (n: number) => Math.max(0, n).toString().padStart(2, '0');
  if (!compactDays) {
    return `${pad(digits.totalHours)}:${pad(digits.minutes)}:${pad(digits.seconds)}`;
  }
  const timePart = `${pad(digits.hours)}:${pad(digits.minutes)}:${pad(digits.seconds)}`;
  if (digits.days > 0) {
    return `${digits.days}d ${timePart}`;
  }
  return timePart;
}

/**
 * Returns formatted Ethiopian time string in EAT (UTC+3)
 */
export function formatEthiopiaTime(
  date: Date = new Date(),
  format: '24h' | '12h' | 'auto' = '24h'
): {
  timeStr: string;
  dateStr: string;
  fullStr: string;
  tzLabel: string;
} {
  try {
    const hour12Opt = resolveHour12Option(format);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: ETHIOPIA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    if (hour12Opt !== undefined) {
      options.hour12 = hour12Opt;
    }
    const timeStr = date.toLocaleTimeString(
      format === '24h' ? 'en-GB' : [],
      options
    );

    const dateStr = date.toLocaleDateString('en-US', {
      timeZone: ETHIOPIA_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      timeStr,
      dateStr,
      fullStr: `${dateStr} · ${timeStr}`,
      tzLabel: 'EAT',
    };
  } catch {
    return formatLocalTime(date, format);
  }
}

/**
 * Returns formatted Local phone device time string
 */
export function formatLocalTime(
  date: Date = new Date(),
  format: '24h' | '12h' | 'auto' = '24h'
): {
  timeStr: string;
  dateStr: string;
  fullStr: string;
  tzLabel: string;
} {
  const hour12Opt = resolveHour12Option(format);
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  if (hour12Opt !== undefined) {
    options.hour12 = hour12Opt;
  }

  const timeStr = date.toLocaleTimeString(
    format === '24h' ? 'en-GB' : [],
    options
  );

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    timeStr,
    dateStr,
    fullStr: `${dateStr} · ${timeStr}`,
    tzLabel: 'Phone Clock',
  };
}

/**
 * Calculates remaining days, hours, minutes, seconds between now and target
 */
export function calculateRemaining(now: Date, targetDate: Date): ClockDigits {
  const diffMs = targetDate.getTime() - now.getTime();
  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      totalHours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isPast: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const totalHours = Math.floor(totalSeconds / 3600);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    totalHours,
    minutes,
    seconds,
    totalSeconds,
    isPast: false,
  };
}

/**
 * Evaluates current matchday clock status and countdown phases strictly using phone local time (unless countryZone is explicitly Ethiopia-only)
 */
export function getMatchClockStatus(
  config: MatchClockConfig,
  now: Date = new Date()
): MatchClockStatus {
  const useEthTz = config.countryZone === 'Africa/Addis_Ababa';

  let effectiveStart = new Date(config.startDate);
  let effectiveEnd = new Date(config.endDate);

  if (isNaN(effectiveStart.getTime())) {
    const baseDate = config.matchDate || getTodayLocalDateStr(now, useEthTz);
    const rebuilt = buildMatchdaySchedule(
      baseDate,
      config.startTime || '21:00',
      config.endTime || '23:00',
      useEthTz
    );
    effectiveStart = new Date(rebuilt.startDate);
  }

  // CRITICAL: If endDate is missing, invalid, OR older than effectiveStart (e.g. stale previous date),
  // rebuild the ending deadline using config.endTime || '23:00' on effectiveStart's calendar day — NEVER cap to +2h!
  if (isNaN(effectiveEnd.getTime()) || effectiveEnd <= effectiveStart) {
    const targetEndTime = config.endTime || '23:00';
    const startDay = getTodayLocalDateStr(effectiveStart, useEthTz);
    const startHM = config.startTime || getTimeHHmm(effectiveStart, useEthTz);
    const rebuilt = buildMatchdaySchedule(startDay, startHM, targetEndTime, useEthTz);
    effectiveEnd = new Date(rebuilt.endDate);
  }

  const startRemaining = calculateRemaining(now, effectiveStart);
  const endRemaining = calculateRemaining(now, effectiveEnd);

  const matchday = config.matchday || 1;
  const matchdayLabel = config.matchdayLabel || `Matchday ${matchday}`;

  let phase: ClockPhase = 'before_start';
  let phaseLabel = `${matchdayLabel} Kickoff Countdown`;

  if (startRemaining.isPast) {
    if (!endRemaining.isPast) {
      phase = 'in_progress';
      phaseLabel = `${matchdayLabel} Live in Progress`;
    } else {
      phase = 'concluded';
      phaseLabel = `${matchdayLabel} Matchday Concluded`;
    }
  }

  const activeRemaining = phase === 'before_start' ? startRemaining : endRemaining;
  const phoneTimerString = formatPhoneTimerDigits(activeRemaining, true);
  const endTimerString = formatPhoneTimerDigits(endRemaining, true);

  // Progress percentage between matchday start and end
  let progressPct = 0;
  if (phase === 'before_start') {
    progressPct = 0;
  } else if (phase === 'concluded') {
    progressPct = 100;
  } else {
    const totalDuration = effectiveEnd.getTime() - effectiveStart.getTime();
    const elapsed = now.getTime() - effectiveStart.getTime();
    if (totalDuration > 0) {
      progressPct = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    }
  }

  const phoneFormat = config.timeFormat || '24h';
  const displayTz = useEthTz ? ETHIOPIA_TIMEZONE : undefined;
  const startTimePhone = formatPhoneTime(effectiveStart, phoneFormat, displayTz);
  const endTimePhone = formatPhoneTime(effectiveEnd, phoneFormat, displayTz);

  const isSameDay =
    getTodayLocalDateStr(effectiveStart, useEthTz) ===
    getTodayLocalDateStr(effectiveEnd, useEthTz);

  const startDateFormatted = useEthTz
    ? formatEthiopiaTime(effectiveStart, phoneFormat).fullStr
    : formatLocalTime(effectiveStart, phoneFormat).fullStr;
  const endDateFormatted = useEthTz
    ? formatEthiopiaTime(effectiveEnd, phoneFormat).fullStr
    : formatLocalTime(effectiveEnd, phoneFormat).fullStr;

  return {
    phase,
    phaseLabel,
    matchday,
    matchdayLabel,
    startRemaining,
    endRemaining,
    activeRemaining,
    phoneTimerString,
    endTimerString,
    progressPct,
    startTimePhone,
    endTimePhone,
    startDateFormatted,
    endDateFormatted,
    isSameDay,
    effectiveStartIso: effectiveStart.toISOString(),
    effectiveEndIso: effectiveEnd.toISOString(),
    ethiopiaNow: formatEthiopiaTime(now, phoneFormat),
    localNow: formatLocalTime(now, phoneFormat),
  };
}

/**
 * Helper to convert Date to standard input datetime-local value (YYYY-MM-DDTHH:mm)
 */
export function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Builds start and end Date ISO strings using local phone calendar & clock by default
 */
export function buildMatchdaySchedule(
  dateStr: string, // YYYY-MM-DD
  startTime: string = '21:00',
  endTime: string = '23:00',
  useEthiopiaTz: boolean = false
): { startDate: string; endDate: string } {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : getTodayLocalDateStr(new Date(), useEthiopiaTz);

  const [y, m, d] = cleanDate.split('-').map((v) => parseInt(v, 10));

  const parseHM = (t: string, fallbackH: number) => {
    const parts = (t || '').split(':');
    const h = Number(parts[0]);
    const min = Number(parts[1]);
    return {
      h: Number.isFinite(h) && h >= 0 && h <= 23 ? h : fallbackH,
      min: Number.isFinite(min) && min >= 0 && min <= 59 ? min : 0,
    };
  };

  const s = parseHM(startTime, 21);
  const e = parseHM(endTime, 23);
  const pad = (n: number) => n.toString().padStart(2, '0');

  let start: Date;
  let end: Date;

  if (useEthiopiaTz) {
    start = new Date(`${cleanDate}T${pad(s.h)}:${pad(s.min)}:00+03:00`);
    end = new Date(`${cleanDate}T${pad(e.h)}:${pad(e.min)}:00+03:00`);
  } else {
    // Strictly construct in the phone's local timezone & clock
    start = new Date(y, m - 1, d, s.h, s.min, 0, 0);
    end = new Date(y, m - 1, d, e.h, e.min, 0, 0);
  }

  // If ending time is smaller or equal (e.g. 21:00 -> 01:00 next morning), advance end by 1 calendar day
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 3600 * 1000);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

/**
 * Default clock configuration using phone clock style (24-hour e.g. 21:00 — 23:00)
 */
export function getDefaultClockConfig(matchday: number = 1): MatchClockConfig {
  const todayStr = getTodayLocalDateStr(new Date(), false);
  const { startDate, endDate } = buildMatchdaySchedule(todayStr, '21:00', '23:00', false);

  return {
    enabled: true,
    matchday,
    matchdayLabel: `Matchday ${matchday}`,
    matchDate: todayStr,
    startTime: '21:00',
    endTime: '23:00',
    startDate,
    endDate,
    countryZone: 'local',
    timeFormat: '24h',
    title: `MATCHDAY ${matchday} KICKOFF & DUE DATE CLOCK`,
    subtitle: `Matchday ${matchday} runs until 23:00 on your phone clock.`,
  };
}

/**
 * Repairs legacy or stale clockConfig objects (e.g. old endDate <= startDate without endTime)
 * so the countdown always runs cleanly to endTime (default 23:00) in the user's phone clock style.
 */
export function normalizeClockConfig(raw: MatchClockConfig): MatchClockConfig {
  if (!raw || typeof raw !== 'object') {
    return getDefaultClockConfig();
  }
  const useEth = raw.countryZone === 'Africa/Addis_Ababa';
  const start = new Date(raw.startDate);
  const end = new Date(raw.endDate);
  const hasBrokenLegacyWindow =
    !raw.endTime &&
    (isNaN(end.getTime()) || (!isNaN(start.getTime()) && end.getTime() <= start.getTime()));

  const validStart = !isNaN(start.getTime()) ? start : new Date();
  const matchDate = raw.matchDate || getTodayLocalDateStr(validStart, useEth);
  const startTime = raw.startTime || getTimeHHmm(validStart, useEth) || '21:00';
  const endTime = raw.endTime || '23:00';
  const rebuilt = buildMatchdaySchedule(matchDate, startTime, endTime, useEth);

  const effectiveEnd =
    !isNaN(end.getTime()) && end.getTime() > validStart.getTime()
      ? end.toISOString()
      : rebuilt.endDate;

  const countryZone = raw.countryZone || 'local';
  const timeFormat = hasBrokenLegacyWindow && raw.timeFormat === '12h'
    ? '24h'
    : (raw.timeFormat || '24h');

  const subtitle =
    countryZone === 'local' && raw.subtitle?.includes('Addis Ababa')
      ? `Matchday ${raw.matchday || 1} window runs ${startTime} — ${endTime} on your phone clock.`
      : raw.subtitle;

  return {
    ...raw,
    matchday: raw.matchday || 1,
    matchdayLabel: raw.matchdayLabel || `Matchday ${raw.matchday || 1}`,
    matchDate,
    startTime,
    endTime,
    startDate: !isNaN(start.getTime()) ? start.toISOString() : rebuilt.startDate,
    endDate: effectiveEnd,
    countryZone,
    timeFormat,
    subtitle,
  };
}
