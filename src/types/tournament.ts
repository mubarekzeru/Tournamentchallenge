export interface Player {
  id: string;
  user: string; // Username (displayed small/tiny)
  team: string; // Team Name (displayed bigger)
  subtitle?: string;
  avatarUrl: string;
  phoneNumber?: string; // Player contact phone number (e.g. +251 9... / 09...)
  telegramUsername?: string; // Player Telegram handle (e.g. @username)
  registeredAt?: string; // Player registration timestamp (ISO string)
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number;
  winStreak?: number;
  form?: ('W' | 'D' | 'L')[];
  group?: string; // e.g. "A", "B", "C", "D"
  groupRank?: number;
  qualificationStatus?: 'qualified' | 'qualifying' | 'eliminated' | 'pending';
}

export type TournamentFormat =
  | 'knockout'
  | 'group_knockout'
  | 'group_stage'
  | 'league_single'
  | 'league_double'
  | 'knockout_cup';
export type MatchType = 'Knockout' | 'League Format';

export type KnockoutStageType =
  | 'playoff'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final';

export interface Fixture {
  id: string;
  matchday: number;
  home: string;
  away: string;
  rest: string | null;
  stage?: string;
  group?: string; // "A", "B", "C", "D" etc.
  round?: number; // intra-group round: 1, 2, 3...
  isKnockout?: boolean;
  knockoutStage?: KnockoutStageType;
}

export interface MatchResult {
  id: string;
  matchday: number;
  home_user: string;
  away_user: string;
  home_score: number;
  away_score: number;
  venue: string;
  submitted_at: string;
  notes?: string;
  isPostponed?: boolean;
  postponedReason?: string;
  rescheduledMatchday?: number;
  stage?: string;
  group?: string;
  isKnockout?: boolean;
  penaltyWinner?: string; // home_user or away_user when level score in knockout
  penaltyHomeScore?: number;
  penaltyAwayScore?: number;
}

export interface GroupStageConfig {
  targetGroupSize: number; // default 4 (range 3-5)
  qualifiersPerGroup: number; // default 2
  autoExpandGroups: boolean; // default true
  wildcardMethod: 'best_thirds' | 'byes'; // when qualifiers not power of 2
  groupAssignments?: Record<string, string>; // username -> group letter ("A", "B", ...)
  manualTieBreakers?: Record<string, string[]>; // group -> ordered array of usernames if manual decision made
}

export type TableSortField = 'rank' | 'user' | 'played' | 'w' | 'd' | 'l' | 'gd' | 'points' | 'winStreak';

export interface MatchClockConfig {
  enabled: boolean;
  matchday?: number; // Active matchday being counted (e.g. 1)
  matchdayLabel?: string; // Optional label (e.g. "Matchday 1")
  matchDate?: string; // Date of matchday (YYYY-MM-DD)
  startTime?: string; // Starting kickoff time (e.g. "21:00")
  endTime?: string; // Ending due time (e.g. "23:00")
  startDate: string; // ISO string for matchday start date & time
  endDate: string; // ISO string for matchday ending due date
  countryZone: 'Africa/Addis_Ababa' | 'local' | 'both'; // Country clock mode (defaults to 'both')
  timeFormat?: '24h' | '12h' | 'auto'; // Local phone counting style (24-hour e.g. 21:00 or 12-hour e.g. 9:00 PM)
  title?: string; // Optional custom banner title (e.g. "Matchday 1 Kickoff & Due Date")
  subtitle?: string; // Optional announcement subtitle
}
