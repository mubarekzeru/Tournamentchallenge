import { MatchClockConfig } from '../types/tournament';

export const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa';

export interface ClockDigits {
  days: number;
  hours: number;
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
  phoneTimerString: string; // e.g. "01:45:22" (standard local phone countdown style)
  progressPct: number;
  startTimePhone: string; // e.g. "21:00" or "9:00 PM"
  endTimePhone: string; // e.g. "23:00" or "11:00 PM"
  startDateFormatted: string;
  endDateFormatted: string;
  isSameDay: boolean;
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
 * Formats time in local phone style (24-hour phone style e.g. "21:00", 12-hour e.g. "9:00 PM", or device auto)
 */
export function formatPhoneTime(
  date: Date,
  format: '24h' | '12h' | 'auto' = '24h',
  timezone?: string
): string {
  try {
    const is12 = format === '12h';
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: is12,
      timeZone: timezone,
    });
  } catch {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Formats clock digits into local phone countdown timer style (e.g. "01:45:22" or "2d 01:45:22")
 */
export function formatPhoneTimerDigits(digits: ClockDigits): string {
  const pad = (n: number) => Math.max(0, n).toString().padStart(2, '0');
  const timePart = `${pad(digits.hours)}:${pad(digits.minutes)}:${pad(digits.seconds)}`;
  if (digits.days > 0) {
    return `${digits.days}d ${timePart}`;
  }
  return timePart;
}

/**
 * Returns formatted Ethiopian time string in EAT (UTC+3)
 */
export function formatEthiopiaTime(date: Date = new Date()): {
  timeStr: string;
  dateStr: string;
  fullStr: string;
  tzLabel: string;
} {
  try {
    const timeStr = date.toLocaleTimeString('en-GB', {
      timeZone: ETHIOPIA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

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
      fullStr: `${dateStr} · ${timeStr} EAT`,
      tzLabel: 'EAT (UTC+3)',
    };
  } catch {
    const timeStr = date.toLocaleTimeString();
    const dateStr = date.toLocaleDateString();
    return {
      timeStr,
      dateStr,
      fullStr: `${dateStr} · ${timeStr}`,
      tzLabel: 'Local',
    };
  }
}

/**
 * Returns formatted Local device time string
 */
export function formatLocalTime(date: Date = new Date()): {
  timeStr: string;
  dateStr: string;
  fullStr: string;
  tzLabel: string;
} {
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let tzLabel = 'Local Phone';
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) {
      tzLabel = timeZone.split('/').pop()?.replace(/_/g, ' ') || 'Local Phone';
    }
  } catch {}

  return {
    timeStr,
    dateStr,
    fullStr: `${dateStr} · ${timeStr}`,
    tzLabel,
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
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isPast: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isPast: false,
  };
}

/**
 * Evaluates current matchday clock status and countdown phases
 */
export function getMatchClockStatus(
  config: MatchClockConfig,
  now: Date = new Date()
): MatchClockStatus {
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);

  const startValid = !isNaN(startDate.getTime());
  const endValid = !isNaN(endDate.getTime());

  // Default: start tonight at 21:00, end tonight at 23:00
  let effectiveStart: Date;
  let effectiveEnd: Date;

  if (startValid) {
    effectiveStart = startDate;
  } else {
    effectiveStart = new Date(now);
    effectiveStart.setHours(21, 0, 0, 0);
  }

  if (endValid && endDate > effectiveStart) {
    effectiveEnd = endDate;
  } else {
    // 2 hours after start (e.g. 21:00 to 23:00)
    effectiveEnd = new Date(effectiveStart.getTime() + 2 * 3600 * 1000);
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
  const phoneTimerString = formatPhoneTimerDigits(activeRemaining);

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
  const startTimePhone = formatPhoneTime(effectiveStart, phoneFormat);
  const endTimePhone = formatPhoneTime(effectiveEnd, phoneFormat);

  const isSameDay =
    effectiveStart.getFullYear() === effectiveEnd.getFullYear() &&
    effectiveStart.getMonth() === effectiveEnd.getMonth() &&
    effectiveStart.getDate() === effectiveEnd.getDate();

  const startDateFormatted = formatEthiopiaTime(effectiveStart).fullStr;
  const endDateFormatted = formatEthiopiaTime(effectiveEnd).fullStr;

  return {
    phase,
    phaseLabel,
    matchday,
    matchdayLabel,
    startRemaining,
    endRemaining,
    activeRemaining,
    phoneTimerString,
    progressPct,
    startTimePhone,
    endTimePhone,
    startDateFormatted,
    endDateFormatted,
    isSameDay,
    ethiopiaNow: formatEthiopiaTime(now),
    localNow: formatLocalTime(now),
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
 * Builds start and end Date ISO strings from matchday date, start time (HH:mm) and end time (HH:mm)
 */
export function buildMatchdaySchedule(
  dateStr: string, // YYYY-MM-DD
  startTime: string = '21:00',
  endTime: string = '23:00'
): { startDate: string; endDate: string } {
  const [startH, startM] = (startTime || '21:00').split(':').map((v) => parseInt(v, 10) || 0);
  const [endH, endM] = (endTime || '23:00').split(':').map((v) => parseInt(v, 10) || 0);

  const baseDate = new Date(`${dateStr}T00:00:00`);
  const start = new Date(baseDate);
  start.setHours(startH, startM, 0, 0);

  const end = new Date(baseDate);
  end.setHours(endH, endM, 0, 0);

  // If ending time is smaller or equal (e.g. 23:00 to 01:00 midnight), add 1 day to end
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

/**
 * Default clock configuration for a Matchday (e.g. 21:00 - 23:00)
 */
export function getDefaultClockConfig(matchday: number = 1): MatchClockConfig {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Default: Matchday starts at 21:00 and ends at 23:00 (user's exact specification)
  const { startDate, endDate } = buildMatchdaySchedule(todayStr, '21:00', '23:00');

  return {
    enabled: true,
    matchday,
    matchdayLabel: `Matchday ${matchday}`,
    matchDate: todayStr,
    startTime: '21:00',
    endTime: '23:00',
    startDate,
    endDate,
    countryZone: 'both',
    timeFormat: '24h',
    title: `MATCHDAY ${matchday} KICKOFF & DUE DATE CLOCK`,
    subtitle: `Matchday ${matchday} window runs 21:00 — 23:00. Finish scheduled ties before deadline.`,
  };
}
