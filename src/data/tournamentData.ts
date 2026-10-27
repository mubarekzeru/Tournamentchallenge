import { Fixture, Player, MatchResult, TournamentFormat } from '../types/tournament';

export const DEFAULT_ADMIN_PASSCODE = "-]MK3kMJPdLn]!1mX=81lbx";
export const ADMIN_PASSCODE = DEFAULT_ADMIN_PASSCODE;
export const TWO_STEP_MASTER_KEY = "QurwyG{0P]}cuYX5dB[0f4X{PV59AtXbYhq2]ryL~9Nvm2]I7R";

export const INITIAL_PLAYERS: Player[] = [
  {
    id: "a-bilal",
    rank: 1,
    team: "Bilal FC",
    user: "A-Bilal",
    phoneNumber: "+251 91 123 4567",
    telegramUsername: "a_bilal_et",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
  {
    id: "big-j",
    rank: 2,
    team: "Aman United",
    user: "BIG_j",
    phoneNumber: "+251 92 345 6789",
    telegramUsername: "big_j_aman",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
  {
    id: "chubaw1",
    rank: 3,
    team: "Madridistas",
    user: "chubaw1",
    phoneNumber: "+251 93 456 7890",
    telegramUsername: "chubaw1_efootball",
    avatarUrl: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
  {
    id: "hamud-yesuf",
    rank: 4,
    team: "Teshale Kings",
    user: "hamud_yesuf",
    phoneNumber: "+251 94 567 8901",
    telegramUsername: "hamud_teshale",
    avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
  {
    id: "izaq1010",
    rank: 5,
    team: "Isaac Stars",
    user: "izaq1010",
    phoneNumber: "+251 95 678 9012",
    telegramUsername: "izaq_stars",
    avatarUrl: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
  {
    id: "mubyzeru",
    rank: 6,
    team: "Muby All-Stars",
    user: "mubyzeru",
    phoneNumber: "+251 96 789 0123",
    telegramUsername: "muby_zeru",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
  {
    id: "yonas1934",
    rank: 7,
    team: "Yonas Warriors",
    user: "yonas1934",
    phoneNumber: "+251 97 890 1234",
    telegramUsername: "yonas_warrior",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop",
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  },
];

export const AVATAR_PRESETS = [
  { id: 'av-1', label: 'Striker Blue', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop' },
  { id: 'av-2', label: 'Tactician Neon', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop' },
  { id: 'av-3', label: 'Midfield Maestro', url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop' },
  { id: 'av-4', label: 'Cyber Defender', url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop' },
  { id: 'av-5', label: 'Rapid Winger', url: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop' },
  { id: 'av-6', label: 'League Champion', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
  { id: 'av-7', label: 'Speed Demon', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
  { id: 'av-8', label: 'Playmaker Red', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
  { id: 'av-9', label: 'Finisher Gold', url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop' },
  { id: 'av-10', label: 'Wall Goalie', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop' },
  { id: 'av-11', label: 'Golden Boot', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
  { id: 'av-12', label: 'Captain Ultra', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop' },
];

export function generateSingleRoundRobin(playerNames: string[]): Fixture[] {
  if (!playerNames || playerNames.length < 2) return [];

  const isOdd = playerNames.length % 2 !== 0;
  const rotation: (string | null)[] = isOdd
    ? [...playerNames, null]
    : [...playerNames];

  const totalSlots = rotation.length;
  const numRounds = totalSlots - 1;
  const matchesPerRound = totalSlots / 2;

  const fixtures: Fixture[] = [];

  for (let round = 0; round < numRounds; round += 1) {
    let restingPlayer: string | null = null;
    let matchIdx = 0;

    for (let i = 0; i < matchesPerRound; i += 1) {
      const team1 = rotation[i];
      const team2 = rotation[totalSlots - 1 - i];

      if (team1 === null) {
        restingPlayer = team2;
      } else if (team2 === null) {
        restingPlayer = team1;
      } else {
        const home = round % 2 === 0 ? team1 : team2;
        const away = round % 2 === 0 ? team2 : team1;
        fixtures.push({
          id: `leg1-m${round + 1}-${matchIdx}`,
          matchday: round + 1,
          home,
          away,
          rest: null,
          stage: 'League (Single Leg)',
        });
        matchIdx++;
      }
    }

    if (restingPlayer) {
      fixtures
        .filter((f) => f.matchday === round + 1)
        .forEach((f) => {
          f.rest = restingPlayer;
        });
    }

    const lastItem = rotation.pop();
    if (lastItem !== undefined) {
      rotation.splice(1, 0, lastItem);
    }
  }

  return fixtures;
}

export function generateDoubleRoundRobin(playerNames: string[]): Fixture[] {
  if (!playerNames || playerNames.length < 2) return [];

  const firstLeg = generateSingleRoundRobin(playerNames);
  const numRounds = Math.max(...firstLeg.map((f) => f.matchday));

  const returnLeg: Fixture[] = firstLeg.map((f, idx) => ({
    id: `leg2-m${f.matchday + numRounds}-${idx}`,
    matchday: f.matchday + numRounds,
    home: f.away,
    away: f.home,
    rest: f.rest,
    stage: 'League (Return Leg)',
  }));

  return [...firstLeg, ...returnLeg];
}

export function generateGroupStageFixtures(playerNames: string[]): Fixture[] {
  if (!playerNames || playerNames.length < 2) return [];

  // Group stage auto-partitioning: 2 groups for <= 8 players, expanding to C, D etc.
  const numGroups = playerNames.length <= 8 ? 2 : Math.max(2, Math.round(playerNames.length / 4));
  const groups: string[][] = Array.from({ length: numGroups }, () => []);

  playerNames.forEach((name, idx) => {
    groups[idx % numGroups].push(name);
  });

  const allFixtures: Fixture[] = [];
  groups.forEach((groupMembers, gIdx) => {
    const letter = String.fromCharCode(65 + gIdx);
    const grpFixtures = generateSingleRoundRobin(groupMembers).map((f) => ({
      ...f,
      id: `grp${letter}-${f.id}`,
      stage: `Group ${letter}`,
      group: letter,
      round: f.matchday,
      isKnockout: false,
    }));
    allFixtures.push(...grpFixtures);
  });

  // NEVER return placeholder matches with 'Winner SF 1', 'Runner-up', or unknown players!
  // Knockout matches are generated dynamically only when group stage matches are finished with known players.
  return allFixtures;
}

export function generateTournamentFixturesByFormat(
  playerNames: string[],
  format: TournamentFormat = 'knockout'
): Fixture[] {
  if (format === 'league_single') {
    return generateSingleRoundRobin(playerNames);
  }
  if (format === 'knockout' || format === 'group_knockout' || format === 'knockout_cup') {
    // Standard direct knockout uses generateDirectKnockoutFixtures with full Player models
    return [];
  }
  if (format === 'group_stage') {
    return generateGroupStageFixtures(playerNames);
  }
  return generateDoubleRoundRobin(playerNames);
}

export function generateTournamentFixtures(playerNames: string[]): Fixture[] {
  return generateTournamentFixturesByFormat(playerNames, 'league_double');
}

export const TOURNAMENT_FIXTURES: Fixture[] = generateTournamentFixtures(
  INITIAL_PLAYERS.map((p) => p.user)
);

// Pre-seeded results from Matchday 1 to showcase dynamic standings
export const DEFAULT_RESULTS: MatchResult[] = [
  {
    id: "res-1-1",
    matchday: 1,
    home_user: "A-Bilal",
    away_user: "yonas1934",
    home_score: 3,
    away_score: 1,
    venue: "PS5 • Online lobby",
    submitted_at: "2026-03-24T18:30:00.000Z",
    notes: "Matchday 1 opener",
  },
  {
    id: "res-1-2",
    matchday: 1,
    home_user: "mubyzeru",
    away_user: "BIG_j",
    home_score: 2,
    away_score: 2,
    venue: "PS5 • Online lobby",
    submitted_at: "2026-03-24T19:15:00.000Z",
    notes: "Thrilling 4-goal draw",
  },
  {
    id: "res-1-3",
    matchday: 1,
    home_user: "chubaw1",
    away_user: "izaq1010",
    home_score: 1,
    away_score: 2,
    venue: "PS5 • Online lobby",
    submitted_at: "2026-03-24T20:00:00.000Z",
    notes: "Late 88th-minute winner by izaq1010",
  },
];
