import { Player } from '../types/tournament';

export interface PlayerRegistrationTimestamp {
  dateStr: string; // e.g. "Oct 28, 2026"
  timeStr: string; // e.g. "02:45 AM"
  fullStr: string; // e.g. "Oct 28, 2026 · 02:45 AM"
  dateObj: Date;
}

/**
 * Returns the exact registration date and time of a player.
 * Resolves from player.registeredAt or extracts the timestamp from their unique ID (p-1793...).
 */
export function getPlayerRegistrationTimestamp(player?: Partial<Player> | null): PlayerRegistrationTimestamp {
  let dateObj: Date | null = null;

  if (player?.registeredAt) {
    const parsed = new Date(player.registeredAt);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }

  // If not found in registeredAt, attempt to parse from player id (e.g. "p-1793178559689")
  if (!dateObj && player?.id) {
    const match = player.id.match(/^p-(\d{10,14})$/);
    if (match) {
      const parsed = new Date(Number(match[1]));
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
  }

  if (!dateObj) {
    dateObj = new Date();
  }

  const dateStr = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return {
    dateStr,
    timeStr,
    fullStr: `${dateStr} · ${timeStr}`,
    dateObj,
  };
}
