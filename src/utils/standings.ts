import { Player, MatchResult, Fixture } from '../types/tournament';

export function calculateStandings(basePlayers: Player[], results: MatchResult[]): Player[] {
  // Deep clone players
  const playerMap = new Map<string, Player>();
  basePlayers.forEach((p) => {
    playerMap.set(p.user, {
      ...p,
      played: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      rank: 1,
      winStreak: 0,
      form: [],
    });
  });

  // Track chronologically ordered match results for each player
  const playerMatchesMap = new Map<string, Array<{ matchday: number; outcome: 'W' | 'D' | 'L' }>>();
  basePlayers.forEach((p) => playerMatchesMap.set(p.user, []));

  // Sort results chronologically by matchday and submission time
  const sortedResults = [...results].sort((a, b) => {
    if (a.matchday !== b.matchday) return a.matchday - b.matchday;
    return (a.submitted_at || '').localeCompare(b.submitted_at || '');
  });

  // Calculate stats from results
  sortedResults.forEach((r) => {
    if (r.isPostponed) return; // Postponed matches do not count toward points or goals until played

    const home = playerMap.get(r.home_user);
    const away = playerMap.get(r.away_user);
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;

    home.gf += r.home_score;
    home.ga += r.away_score;
    away.gf += r.away_score;
    away.ga += r.home_score;

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    let homeOutcome: 'W' | 'D' | 'L' = 'D';
    let awayOutcome: 'W' | 'D' | 'L' = 'D';

    if (r.home_score > r.away_score) {
      home.w += 1;
      home.points += 3;
      away.l += 1;
      homeOutcome = 'W';
      awayOutcome = 'L';
    } else if (r.home_score < r.away_score) {
      away.w += 1;
      away.points += 3;
      home.l += 1;
      homeOutcome = 'L';
      awayOutcome = 'W';
    } else {
      home.d += 1;
      home.points += 1;
      away.d += 1;
      away.points += 1;
      homeOutcome = 'D';
      awayOutcome = 'D';
    }

    playerMatchesMap.get(r.home_user)?.push({ matchday: r.matchday, outcome: homeOutcome });
    playerMatchesMap.get(r.away_user)?.push({ matchday: r.matchday, outcome: awayOutcome });
  });

  // Calculate current win streak for each player
  playerMap.forEach((player, user) => {
    const matches = playerMatchesMap.get(user) || [];
    const outcomes = matches.map((m) => m.outcome);
    player.form = outcomes;

    // Current win streak: count consecutive 'W's backwards from latest match
    let streak = 0;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      if (outcomes[i] === 'W') {
        streak += 1;
      } else {
        break;
      }
    }
    player.winStreak = streak;
  });

  const sorted = Array.from(playerMap.values()).sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points;
    // 2. Goal difference
    if (b.gd !== a.gd) return b.gd - a.gd;
    // 3. Goals For
    if (b.gf !== a.gf) return b.gf - a.gf;
    // 4. Wins
    if (b.w !== a.w) return b.w - a.w;
    // 5. Alphabetical
    return a.user.localeCompare(b.user);
  });

  return sorted.map((player, idx) => ({
    ...player,
    rank: idx + 1,
  }));
}

export function getPlayerMatchHistory(user: string, results: MatchResult[]) {
  return results
    .filter((r) => !r.isPostponed && (r.home_user === user || r.away_user === user))
    .map((r) => {
      const isHome = r.home_user === user;
      const myScore = isHome ? r.home_score : r.away_score;
      const opponentScore = isHome ? r.away_score : r.home_score;
      const opponent = isHome ? r.away_user : r.home_user;
      let outcome: 'W' | 'D' | 'L' = 'D';
      if (myScore > opponentScore) outcome = 'W';
      else if (myScore < opponentScore) outcome = 'L';

      return {
        ...r,
        isHome,
        myScore,
        opponentScore,
        opponent,
        outcome,
      };
    });
}

export function getPlayerUpcomingFixtures(user: string, fixtures: Fixture[], results: MatchResult[]) {
  const playedMatches = new Set(
    results
      .filter((r) => !r.isPostponed)
      .map((r) => `${r.matchday}-${r.home_user}-${r.away_user}`)
  );

  return fixtures.filter(
    (f) =>
      (f.home === user || f.away === user) &&
      !playedMatches.has(`${f.matchday}-${f.home}-${f.away}`)
  );
}

export interface PlayerAdvancedAverages {
  played: number;
  goalsScored: number;
  goalsPerMatch: string;
  avgGoalsFor: string;
  cleanSheets: number;
  cleanSheetPct: string;
  cleanSheetsPerMatch: string;
  goalsConceded: number;
  concededPerMatch: string;
  avgGoalsAgainst: string;
}

export function getPlayerAdvancedAverages(
  user: string,
  results: MatchResult[]
): PlayerAdvancedAverages {
  const matches = results.filter(
    (r) => !r.isPostponed && (r.home_user === user || r.away_user === user)
  );
  const played = matches.length;

  let goalsScored = 0;
  let goalsConceded = 0;
  let cleanSheets = 0;

  matches.forEach((m) => {
    const isHome = m.home_user === user;
    const scored = isHome ? m.home_score : m.away_score;
    const conceded = isHome ? m.away_score : m.home_score;

    goalsScored += scored;
    goalsConceded += conceded;
    if (conceded === 0) {
      cleanSheets += 1;
    }
  });

  const goalsPerMatch = played > 0 ? (goalsScored / played).toFixed(2) : '0.00';
  const cleanSheetsPerMatch = played > 0 ? (cleanSheets / played).toFixed(2) : '0.00';
  const cleanSheetPct = played > 0 ? `${Math.round((cleanSheets / played) * 100)}%` : '0%';
  const concededPerMatch = played > 0 ? (goalsConceded / played).toFixed(2) : '0.00';

  return {
    played,
    goalsScored,
    goalsPerMatch,
    avgGoalsFor: goalsPerMatch,
    cleanSheets,
    cleanSheetPct,
    cleanSheetsPerMatch,
    goalsConceded,
    concededPerMatch,
    avgGoalsAgainst: concededPerMatch,
  };
}

export interface NextMatchdayInfo {
  matchday: number;
  pendingCount: number;
  totalCount: number;
  restingPlayer: string | null;
}

export function getNextScheduledMatchday(
  fixtures: Fixture[],
  results: MatchResult[]
): NextMatchdayInfo | null {
  if (!fixtures || fixtures.length === 0) return null;

  const totalMatchdays = Math.max(...fixtures.map((f) => f.matchday));
  for (let md = 1; md <= totalMatchdays; md++) {
    const mdFixtures = fixtures.filter((f) => f.matchday === md);
    const mdResults = results.filter((r) => r.matchday === md);
    if (mdResults.length < mdFixtures.length) {
      const rest = mdFixtures[0]?.rest;
      const validRest =
        rest && rest !== 'None' && rest.toLowerCase() !== 'none' && rest.trim() !== ''
          ? rest
          : null;
      return {
        matchday: md,
        pendingCount: mdFixtures.length - mdResults.length,
        totalCount: mdFixtures.length,
        restingPlayer: validRest,
      };
    }
  }

  return null;
}


