import {
  Player,
  Fixture,
  MatchResult,
  GroupStageConfig,
  KnockoutStageType,
} from '../types/tournament';
import { generateSingleRoundRobin } from '../data/tournamentData';

export const DEFAULT_GROUP_CONFIG: GroupStageConfig = {
  targetGroupSize: 4,
  qualifiersPerGroup: 2,
  autoExpandGroups: true,
  wildcardMethod: 'best_thirds',
};

// Generates alphabetical group labels: "A", "B", "C", "D", ...
export function getGroupLetters(numGroups: number): string[] {
  const letters: string[] = [];
  for (let i = 0; i < numGroups; i++) {
    letters.push(String.fromCharCode(65 + i));
  }
  return letters;
}

// Calculates the optimal number of groups based on player count and target group size
export function calculateGroupCount(
  totalPlayers: number,
  targetSize: number = 4
): number {
  // Always exactly 2 groups: Group A and Group B as required
  return 2;
}

// Distributes players into groups balancing group sizes
export function partitionPlayersIntoGroups(
  players: Player[],
  config: GroupStageConfig = DEFAULT_GROUP_CONFIG,
  results: MatchResult[] = []
): {
  groups: Record<string, Player[]>;
  groupLetters: string[];
  summaryText: string;
} {
  if (!players || players.length === 0) {
    return {
      groups: {},
      groupLetters: [],
      summaryText: '0 members',
    };
  }

  const numGroups = config.autoExpandGroups
    ? calculateGroupCount(players.length, config.targetGroupSize)
    : config.groupAssignments
    ? Math.max(
        2,
        new Set(Object.values(config.groupAssignments)).size
      )
    : 2;

  const groupLetters = getGroupLetters(numGroups);
  const groups: Record<string, Player[]> = {};
  groupLetters.forEach((letter) => {
    groups[letter] = [];
  });

  // Check which players already have recorded group matches
  const playersWithMatches = new Set<string>();
  results.forEach((r) => {
    playersWithMatches.add(r.home_user);
    playersWithMatches.add(r.away_user);
  });

  const assigned = config.groupAssignments || {};

  // First pass: keep players in their existing group if specified or if they already played
  const unassigned: Player[] = [];

  players.forEach((player) => {
    const existingGroup = assigned[player.user] || player.group;
    if (existingGroup && groups[existingGroup]) {
      groups[existingGroup].push({
        ...player,
        group: existingGroup,
      });
    } else {
      unassigned.push(player);
    }
  });

  // Second pass: distribute unassigned players balancing group sizes
  unassigned.forEach((player) => {
    // Find group with minimum members
    let minGroup = groupLetters[0];
    let minCount = groups[minGroup]?.length ?? Infinity;

    for (const letter of groupLetters) {
      const count = groups[letter]?.length ?? 0;
      if (count < minCount) {
        minCount = count;
        minGroup = letter;
      }
    }

    groups[minGroup].push({
      ...player,
      group: minGroup,
    });
  });

  // Build live summary text (e.g. "12 members → 3 groups of 4 → 6 qualifiers + 2 best third-placed → Quarter-finals")
  const totalQualifiers = numGroups * config.qualifiersPerGroup;
  let knockoutStageName = 'Finals';
  let wildcardText = '';

  let bracketSize = 2;
  while (bracketSize < totalQualifiers) {
    bracketSize *= 2;
  }

  if (bracketSize > totalQualifiers && config.wildcardMethod === 'best_thirds') {
    const extraNeeded = bracketSize - totalQualifiers;
    wildcardText = ` + ${extraNeeded} best third-placed`;
  }

  const effectiveBracket = bracketSize;
  if (effectiveBracket === 4) knockoutStageName = 'Semi-finals, 3rd Place, Final';
  else if (effectiveBracket === 8) knockoutStageName = 'Quarter-finals, Semi-finals, 3rd Place, Final';
  else if (effectiveBracket === 16) knockoutStageName = 'Round of 16, Quarter-finals, Semi-finals, Final';
  else knockoutStageName = 'Knockout Finals';

  const groupSizeDesc = `${numGroups} groups of ${Math.round(players.length / numGroups)}`;
  const summaryText = `${players.length} members → ${groupSizeDesc} → ${totalQualifiers} qualifiers${wildcardText} → ${knockoutStageName}`;

  return {
    groups,
    groupLetters,
    summaryText,
  };
}

// Generates intra-group round robin fixtures for all groups
export function generateGroupStageFixtures(
  groups: Record<string, Player[]>
): Fixture[] {
  const allFixtures: Fixture[] = [];
  const groupLetters = Object.keys(groups).sort();

  groupLetters.forEach((letter) => {
    const groupMembers = groups[letter] || [];
    const memberNames = groupMembers.map((m) => m.user);
    if (memberNames.length < 2) return;

    const roundRobin = generateSingleRoundRobin(memberNames);
    roundRobin.forEach((f) => {
      allFixtures.push({
        id: `grp-${letter}-${f.id}`,
        matchday: f.matchday,
        round: f.matchday,
        home: f.home,
        away: f.away,
        rest: f.rest,
        group: letter,
        stage: `Group ${letter}`,
        isKnockout: false,
      });
    });
  });

  return allFixtures;
}

// Standings calculation for a single group with tie-breaker logic
export function calculateGroupStandings(
  groupMembers: Player[],
  groupResults: MatchResult[],
  qualifiersCount: number = 2,
  manualTieBreakerOrder?: string[]
): {
  standings: Player[];
  hasTie: boolean;
  tieMessage?: string;
  isGroupComplete: boolean;
  totalGroupMatches: number;
  completedGroupMatches: number;
} {
  if (!groupMembers || groupMembers.length === 0) {
    return {
      standings: [],
      hasTie: false,
      isGroupComplete: false,
      totalGroupMatches: 0,
      completedGroupMatches: 0,
    };
  }

  const memberUsers = new Set(groupMembers.map((m) => m.user));
  // Filter results strictly between members of this group
  const relevantResults = groupResults.filter(
    (r) =>
      memberUsers.has(r.home_user) &&
      memberUsers.has(r.away_user) &&
      !r.isPostponed
  );

  const statsMap = new Map<
    string,
    {
      played: number;
      w: number;
      d: number;
      l: number;
      gf: number;
      ga: number;
      points: number;
      form: ('W' | 'D' | 'L')[];
    }
  >();

  groupMembers.forEach((m) => {
    statsMap.set(m.user, {
      played: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      points: 0,
      form: [],
    });
  });

  // Sort chronological for form
  const sortedResults = [...relevantResults].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );

  sortedResults.forEach((r) => {
    const home = statsMap.get(r.home_user);
    const away = statsMap.get(r.away_user);
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;
    home.gf += r.home_score;
    home.ga += r.away_score;
    away.gf += r.away_score;
    away.ga += r.home_score;

    if (r.home_score > r.away_score) {
      home.w += 1;
      home.points += 3;
      home.form.push('W');
      away.l += 1;
      away.form.push('L');
    } else if (r.away_score > r.home_score) {
      away.w += 1;
      away.points += 3;
      away.form.push('W');
      home.l += 1;
      home.form.push('L');
    } else {
      home.d += 1;
      home.points += 1;
      home.form.push('D');
      away.d += 1;
      away.points += 1;
      away.form.push('D');
    }
  });

  // Calculate total expected matches in single round-robin
  const N = groupMembers.length;
  const totalGroupMatches = (N * (N - 1)) / 2;
  const completedGroupMatches = relevantResults.length;
  const isGroupComplete = completedGroupMatches >= totalGroupMatches && totalGroupMatches > 0;

  // Head-to-Head lookup between two users
  const getHeadToHead = (u1: string, u2: string) => {
    const match = relevantResults.find(
      (r) =>
        (r.home_user === u1 && r.away_user === u2) ||
        (r.home_user === u2 && r.away_user === u1)
    );
    if (!match) return 0;
    if (match.home_user === u1) {
      return match.home_score > match.away_score
        ? 1
        : match.away_score > match.home_score
        ? -1
        : 0;
    } else {
      return match.away_score > match.home_score
        ? 1
        : match.home_score > match.away_score
        ? -1
        : 0;
    }
  };

  let hasTie = false;
  let tieMessage: string | undefined;

  const sortedMembers = [...groupMembers].sort((a, b) => {
    const sA = statsMap.get(a.user)!;
    const sB = statsMap.get(b.user)!;

    // 1. Points
    if (sB.points !== sA.points) return sB.points - sA.points;

    // 2. Goal Difference
    const gdA = sA.gf - sA.ga;
    const gdB = sB.gf - sB.ga;
    if (gdB !== gdA) return gdB - gdA;

    // 3. Goals Scored
    if (sB.gf !== sA.gf) return sB.gf - sA.gf;

    // 4. Head-to-Head
    const h2h = getHeadToHead(a.user, b.user);
    if (h2h !== 0) return -h2h; // 1 means a won -> should come before b

    // 5. Check manual decision order
    if (manualTieBreakerOrder && manualTieBreakerOrder.length > 0) {
      const idxA = manualTieBreakerOrder.indexOf(a.user);
      const idxB = manualTieBreakerOrder.indexOf(b.user);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    }

    // Tie unresolved
    hasTie = true;
    tieMessage = `Tie between ${a.team || a.user} and ${b.team || b.user} needs manual decision`;
    return a.user.localeCompare(b.user);
  });

  const standings: Player[] = sortedMembers.map((member, idx) => {
    const stats = statsMap.get(member.user)!;
    const gd = stats.gf - stats.ga;
    const rank = idx + 1;

    let qualificationStatus: 'qualified' | 'qualifying' | 'eliminated' | 'pending' = 'pending';
    if (isGroupComplete) {
      qualificationStatus = rank <= qualifiersCount ? 'qualified' : 'eliminated';
    } else {
      qualificationStatus = rank <= qualifiersCount ? 'qualifying' : 'pending';
    }

    return {
      ...member,
      played: stats.played,
      w: stats.w,
      d: stats.d,
      l: stats.l,
      gf: stats.gf,
      ga: stats.ga,
      gd,
      points: stats.points,
      groupRank: rank,
      qualificationStatus,
      form: stats.form.slice(-5),
    };
  });

  return {
    standings,
    hasTie: isGroupComplete && hasTie,
    tieMessage: isGroupComplete && hasTie ? tieMessage : undefined,
    isGroupComplete,
    totalGroupMatches,
    completedGroupMatches,
  };
}

// Generates Knockout Fixtures dynamically.
// CRITICAL RULE:
// "Show a knockout stage only after the stage before it is completely finished, and only for matches where BOTH players are already known."
// "NEVER show placeholder matches. Do not show 'Winner SF 1', 'Runner-up SF 2', 'TBD', etc. If the players are not known, the match must not appear anywhere."
export function generateKnockoutFixtures(
  groups: Record<string, Player[]>,
  results: MatchResult[],
  config: GroupStageConfig = DEFAULT_GROUP_CONFIG
): {
  knockoutFixtures: Fixture[];
  isGroupStageFinished: boolean;
  unresolvedTieMessage?: string;
  currentKnockoutStage?: KnockoutStageType;
  allKnockoutStages: KnockoutStageType[];
} {
  const groupLetters = Object.keys(groups).sort();
  if (groupLetters.length < 2) {
    return {
      knockoutFixtures: [],
      isGroupStageFinished: false,
      allKnockoutStages: [],
    };
  }

  // 1. Check if ALL group matches are completely final
  let allGroupsComplete = true;
  let unresolvedTieMessage: string | undefined;
  const groupStandingsMap: Record<string, Player[]> = {};

  for (const letter of groupLetters) {
    const members = groups[letter] || [];
    const calc = calculateGroupStandings(
      members,
      results,
      config.qualifiersPerGroup,
      config.manualTieBreakers?.[letter]
    );

    if (!calc.isGroupComplete) {
      allGroupsComplete = false;
    }
    if (calc.hasTie && calc.tieMessage) {
      unresolvedTieMessage = calc.tieMessage;
    }
    groupStandingsMap[letter] = calc.standings;
  }

  // If group stage is NOT finished or if a tie needs manual decision, NO knockout fixtures appear!
  if (!allGroupsComplete || unresolvedTieMessage) {
    return {
      knockoutFixtures: [],
      isGroupStageFinished: allGroupsComplete,
      unresolvedTieMessage,
      allKnockoutStages: [],
    };
  }

  // 2. Gather qualified players
  const qualifiersByGroup: Record<string, Player[]> = {};
  groupLetters.forEach((letter) => {
    const list = groupStandingsMap[letter] || [];
    qualifiersByGroup[letter] = list.slice(0, config.qualifiersPerGroup);
  });

  const totalQualifiers = groupLetters.length * config.qualifiersPerGroup;
  const allKnockoutStages: KnockoutStageType[] = [];
  const knockoutFixtures: Fixture[] = [];

  // Helper to determine match winner considering penalty shootout
  const getKnockoutWinnerAndLoser = (
    fixtureId: string,
    homeUser: string,
    awayUser: string
  ): { winner: string | null; loser: string | null; isDone: boolean } => {
    const hClean = homeUser.trim().toLowerCase();
    const aClean = awayUser.trim().toLowerCase();

    // 1. Try explicit knockout result
    let res = results.find(
      (r) =>
        r.isKnockout &&
        (((r.home_user || '').trim().toLowerCase() === hClean && (r.away_user || '').trim().toLowerCase() === aClean) ||
          ((r.home_user || '').trim().toLowerCase() === aClean && (r.away_user || '').trim().toLowerCase() === hClean))
    );

    // 2. Fallback to non-group result between the two
    if (!res) {
      res = results.find(
        (r) =>
          !r.group &&
          (((r.home_user || '').trim().toLowerCase() === hClean && (r.away_user || '').trim().toLowerCase() === aClean) ||
            ((r.home_user || '').trim().toLowerCase() === aClean && (r.away_user || '').trim().toLowerCase() === hClean))
      );
    }

    // 3. Fallback to any result between the two
    if (!res) {
      const candidates = results.filter(
        (r) =>
          ((r.home_user || '').trim().toLowerCase() === hClean && (r.away_user || '').trim().toLowerCase() === aClean) ||
          ((r.home_user || '').trim().toLowerCase() === aClean && (r.away_user || '').trim().toLowerCase() === hClean)
      );
      if (candidates.length > 0) res = candidates[candidates.length - 1];
    }

    if (!res || res.isPostponed) {
      return { winner: null, loser: null, isDone: false };
    }

    const resHomeClean = (res.home_user || '').trim().toLowerCase();
    const isDirect = resHomeClean === hClean;
    const hs = isDirect ? res.home_score : res.away_score;
    const as = isDirect ? res.away_score : res.home_score;

    if (hs > as) {
      return { winner: homeUser, loser: awayUser, isDone: true };
    } else if (as > hs) {
      return { winner: awayUser, loser: homeUser, isDone: true };
    } else if (res.penaltyWinner) {
      const penClean = res.penaltyWinner.trim().toLowerCase();
      const winner = penClean === hClean ? homeUser : awayUser;
      const loser = penClean === hClean ? awayUser : homeUser;
      return { winner, loser, isDone: true };
    } else if (res.penaltyHomeScore !== undefined && res.penaltyAwayScore !== undefined) {
      const phs = isDirect ? res.penaltyHomeScore : res.penaltyAwayScore;
      const pas = isDirect ? res.penaltyAwayScore : res.penaltyHomeScore;
      if (phs > pas) {
        return { winner: homeUser, loser: awayUser, isDone: true };
      } else {
        return { winner: awayUser, loser: homeUser, isDone: true };
      }
    }

    // Level without penalty recorded: default winner to homeUser so bracket advances
    return { winner: homeUser, loser: awayUser, isDone: true };
  };

  // Case 1: 2 Groups (e.g. Group A and Group B) -> 4 qualifiers -> Semi-finals -> 3rd Place & Final
  if (groupLetters.length === 2 && config.qualifiersPerGroup === 2) {
    allKnockoutStages.push('semi_final', 'third_place', 'final');

    const firstA = qualifiersByGroup['A']?.[0]?.user;
    const secondA = qualifiersByGroup['A']?.[1]?.user;
    const firstB = qualifiersByGroup['B']?.[0]?.user;
    const secondB = qualifiersByGroup['B']?.[1]?.user;

    // Both players must be known!
    if (firstA && secondB && firstB && secondA) {
      // Semi-finals
      const sf1: Fixture = {
        id: 'ko-semi-1',
        matchday: 101,
        round: 1,
        home: firstA,
        away: secondB,
        rest: null,
        stage: 'Semi-final 1 (1st A vs 2nd B)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };

      const sf2: Fixture = {
        id: 'ko-semi-2',
        matchday: 101,
        round: 1,
        home: firstB,
        away: secondA,
        rest: null,
        stage: 'Semi-final 2 (1st B vs 2nd A)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };

      knockoutFixtures.push(sf1, sf2);

      // Check if BOTH Semi-finals are completed
      const sf1Res = getKnockoutWinnerAndLoser(sf1.id, sf1.home, sf1.away);
      const sf2Res = getKnockoutWinnerAndLoser(sf2.id, sf2.home, sf2.away);

      if (sf1Res.isDone && sf2Res.isDone && sf1Res.winner && sf2Res.winner && sf1Res.loser && sf2Res.loser) {
        // Grand Final & 3rd Place match appear ONLY when both SFs are finished with known players!
        const thirdPlace: Fixture = {
          id: 'ko-third-place',
          matchday: 102,
          round: 2,
          home: sf1Res.loser,
          away: sf2Res.loser,
          rest: null,
          stage: '3rd Place Playoff 🥉',
          isKnockout: true,
          knockoutStage: 'third_place',
        };

        const finalMatch: Fixture = {
          id: 'ko-final',
          matchday: 102,
          round: 2,
          home: sf1Res.winner,
          away: sf2Res.winner,
          rest: null,
          stage: 'Grand Final 🏆',
          isKnockout: true,
          knockoutStage: 'final',
        };

        knockoutFixtures.push(thirdPlace, finalMatch);
      }
    }
  }

  // Case 2: 4 Groups (A, B, C, D) with top 2 = 8 qualifiers -> Quarter-finals -> Semi-finals -> Final
  else if (groupLetters.length === 4 && config.qualifiersPerGroup === 2) {
    allKnockoutStages.push('quarter_final', 'semi_final', 'third_place', 'final');

    const firstA = qualifiersByGroup['A']?.[0]?.user;
    const secondA = qualifiersByGroup['A']?.[1]?.user;
    const firstB = qualifiersByGroup['B']?.[0]?.user;
    const secondB = qualifiersByGroup['B']?.[1]?.user;
    const firstC = qualifiersByGroup['C']?.[0]?.user;
    const secondC = qualifiersByGroup['C']?.[1]?.user;
    const firstD = qualifiersByGroup['D']?.[0]?.user;
    const secondD = qualifiersByGroup['D']?.[1]?.user;

    if (firstA && secondB && firstC && secondD && firstB && secondA && firstD && secondC) {
      const qf1: Fixture = {
        id: 'ko-qf-1',
        matchday: 101,
        round: 1,
        home: firstA,
        away: secondB,
        rest: null,
        stage: 'Quarter-final 1 (1st A vs 2nd B)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      const qf2: Fixture = {
        id: 'ko-qf-2',
        matchday: 101,
        round: 1,
        home: firstC,
        away: secondD,
        rest: null,
        stage: 'Quarter-final 2 (1st C vs 2nd D)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      const qf3: Fixture = {
        id: 'ko-qf-3',
        matchday: 101,
        round: 1,
        home: firstB,
        away: secondA,
        rest: null,
        stage: 'Quarter-final 3 (1st B vs 2nd A)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      const qf4: Fixture = {
        id: 'ko-qf-4',
        matchday: 101,
        round: 1,
        home: firstD,
        away: secondC,
        rest: null,
        stage: 'Quarter-final 4 (1st D vs 2nd C)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };

      knockoutFixtures.push(qf1, qf2, qf3, qf4);

      const qf1Res = getKnockoutWinnerAndLoser(qf1.id, qf1.home, qf1.away);
      const qf2Res = getKnockoutWinnerAndLoser(qf2.id, qf2.home, qf2.away);
      const qf3Res = getKnockoutWinnerAndLoser(qf3.id, qf3.home, qf3.away);
      const qf4Res = getKnockoutWinnerAndLoser(qf4.id, qf4.home, qf4.away);

      if (
        qf1Res.isDone &&
        qf2Res.isDone &&
        qf3Res.isDone &&
        qf4Res.isDone &&
        qf1Res.winner &&
        qf2Res.winner &&
        qf3Res.winner &&
        qf4Res.winner
      ) {
        const sf1: Fixture = {
          id: 'ko-semi-1',
          matchday: 102,
          round: 2,
          home: qf1Res.winner,
          away: qf2Res.winner,
          rest: null,
          stage: 'Semi-final 1',
          isKnockout: true,
          knockoutStage: 'semi_final',
        };
        const sf2: Fixture = {
          id: 'ko-semi-2',
          matchday: 102,
          round: 2,
          home: qf3Res.winner,
          away: qf4Res.winner,
          rest: null,
          stage: 'Semi-final 2',
          isKnockout: true,
          knockoutStage: 'semi_final',
        };

        knockoutFixtures.push(sf1, sf2);

        const sf1Res = getKnockoutWinnerAndLoser(sf1.id, sf1.home, sf1.away);
        const sf2Res = getKnockoutWinnerAndLoser(sf2.id, sf2.home, sf2.away);

        if (sf1Res.isDone && sf2Res.isDone && sf1Res.winner && sf2Res.winner && sf1Res.loser && sf2Res.loser) {
          const thirdPlace: Fixture = {
            id: 'ko-third-place',
            matchday: 103,
            round: 3,
            home: sf1Res.loser,
            away: sf2Res.loser,
            rest: null,
            stage: '3rd Place Playoff 🥉',
            isKnockout: true,
            knockoutStage: 'third_place',
          };
          const grandFinal: Fixture = {
            id: 'ko-final',
            matchday: 103,
            round: 3,
            home: sf1Res.winner,
            away: sf2Res.winner,
            rest: null,
            stage: 'Grand Final 🏆',
            isKnockout: true,
            knockoutStage: 'final',
          };
          knockoutFixtures.push(thirdPlace, grandFinal);
        }
      }
    }
  }

  // Case 3: 3 Groups with top 2 = 6 qualifiers + 2 best 3rd-placed players = 8 qualifiers -> Quarter-finals
  else if (groupLetters.length === 3 && config.qualifiersPerGroup === 2) {
    allKnockoutStages.push('quarter_final', 'semi_final', 'third_place', 'final');

    // Collect 3rd placed players to find the 2 best
    const thirds: Player[] = [];
    groupLetters.forEach((l) => {
      const p = groupStandingsMap[l]?.[2];
      if (p) thirds.push(p);
    });

    // Sort best thirds by pts, gd, gf
    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

    const bestThird1 = thirds[0]?.user;
    const bestThird2 = thirds[1]?.user;

    const firstA = qualifiersByGroup['A']?.[0]?.user;
    const secondA = qualifiersByGroup['A']?.[1]?.user;
    const firstB = qualifiersByGroup['B']?.[0]?.user;
    const secondB = qualifiersByGroup['B']?.[1]?.user;
    const firstC = qualifiersByGroup['C']?.[0]?.user;
    const secondC = qualifiersByGroup['C']?.[1]?.user;

    if (firstA && firstB && firstC && secondA && secondB && secondC && bestThird1 && bestThird2) {
      const qf1: Fixture = {
        id: 'ko-qf-1',
        matchday: 101,
        round: 1,
        home: firstA,
        away: bestThird1,
        rest: null,
        stage: 'Quarter-final 1 (1st A vs Best 3rd)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      const qf2: Fixture = {
        id: 'ko-qf-2',
        matchday: 101,
        round: 1,
        home: firstB,
        away: secondC,
        rest: null,
        stage: 'Quarter-final 2 (1st B vs 2nd C)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      const qf3: Fixture = {
        id: 'ko-qf-3',
        matchday: 101,
        round: 1,
        home: firstC,
        away: bestThird2,
        rest: null,
        stage: 'Quarter-final 3 (1st C vs 2nd Best 3rd)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      const qf4: Fixture = {
        id: 'ko-qf-4',
        matchday: 101,
        round: 1,
        home: secondA,
        away: secondB,
        rest: null,
        stage: 'Quarter-final 4 (2nd A vs 2nd B)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };

      knockoutFixtures.push(qf1, qf2, qf3, qf4);

      const qf1Res = getKnockoutWinnerAndLoser(qf1.id, qf1.home, qf1.away);
      const qf2Res = getKnockoutWinnerAndLoser(qf2.id, qf2.home, qf2.away);
      const qf3Res = getKnockoutWinnerAndLoser(qf3.id, qf3.home, qf3.away);
      const qf4Res = getKnockoutWinnerAndLoser(qf4.id, qf4.home, qf4.away);

      if (
        qf1Res.isDone &&
        qf2Res.isDone &&
        qf3Res.isDone &&
        qf4Res.isDone &&
        qf1Res.winner &&
        qf2Res.winner &&
        qf3Res.winner &&
        qf4Res.winner
      ) {
        const sf1: Fixture = {
          id: 'ko-semi-1',
          matchday: 102,
          round: 2,
          home: qf1Res.winner,
          away: qf2Res.winner,
          rest: null,
          stage: 'Semi-final 1',
          isKnockout: true,
          knockoutStage: 'semi_final',
        };
        const sf2: Fixture = {
          id: 'ko-semi-2',
          matchday: 102,
          round: 2,
          home: qf3Res.winner,
          away: qf4Res.winner,
          rest: null,
          stage: 'Semi-final 2',
          isKnockout: true,
          knockoutStage: 'semi_final',
        };
        knockoutFixtures.push(sf1, sf2);

        const sf1Res = getKnockoutWinnerAndLoser(sf1.id, sf1.home, sf1.away);
        const sf2Res = getKnockoutWinnerAndLoser(sf2.id, sf2.home, sf2.away);

        if (sf1Res.isDone && sf2Res.isDone && sf1Res.winner && sf2Res.winner && sf1Res.loser && sf2Res.loser) {
          const thirdPlace: Fixture = {
            id: 'ko-third-place',
            matchday: 103,
            round: 3,
            home: sf1Res.loser,
            away: sf2Res.loser,
            rest: null,
            stage: '3rd Place Playoff 🥉',
            isKnockout: true,
            knockoutStage: 'third_place',
          };
          const grandFinal: Fixture = {
            id: 'ko-final',
            matchday: 103,
            round: 3,
            home: sf1Res.winner,
            away: sf2Res.winner,
            rest: null,
            stage: 'Grand Final 🏆',
            isKnockout: true,
            knockoutStage: 'final',
          };
          knockoutFixtures.push(thirdPlace, grandFinal);
        }
      }
    }
  }

  // Fallback generic pairing for any other configuration where both players are known
  else {
    const allQualifiers: Player[] = [];
    groupLetters.forEach((l) => {
      const qs = qualifiersByGroup[l] || [];
      allQualifiers.push(...qs);
    });

    if (allQualifiers.length >= 2 && allQualifiers.length % 2 === 0) {
      allKnockoutStages.push('final');
      // Cross-pair
      for (let i = 0; i < allQualifiers.length / 2; i++) {
        const home = allQualifiers[i]?.user;
        const away = allQualifiers[allQualifiers.length - 1 - i]?.user;
        if (home && away) {
          knockoutFixtures.push({
            id: `ko-match-${i + 1}`,
            matchday: 101,
            round: 1,
            home,
            away,
            rest: null,
            stage: `Knockout Match ${i + 1}`,
            isKnockout: true,
            knockoutStage: 'final',
          });
        }
      }
    }
  }

  return {
    knockoutFixtures,
    isGroupStageFinished: allGroupsComplete,
    allKnockoutStages,
  };
}

// CRITICAL FILTER:
// NEVER return or display any match where both players are not known!
export function filterRealMatchesOnly(fixtures: Fixture[]): Fixture[] {
  const placeholderPhrases = [
    'winner',
    'runner-up',
    'tbd',
    'waiting',
    'semi-final',
    'quarter-final',
    'final',
    'group a winner',
    'group b winner',
  ];

  return fixtures.filter((f) => {
    if (!f.home || !f.away) return false;
    const h = f.home.trim().toLowerCase();
    const a = f.away.trim().toLowerCase();
    if (h === '' || a === '') return false;
    const isHomePlaceholder = placeholderPhrases.some((phrase) =>
      h.includes(phrase)
    );
    const isAwayPlaceholder = placeholderPhrases.some((phrase) =>
      a.includes(phrase)
    );
    return !isHomePlaceholder && !isAwayPlaceholder;
  });
}

/**
 * Generates direct single-elimination Knockout Fixtures for all registered players.
 * Supports quarter-finals, semi-finals, grand final, and 3rd place playoff with byes for odd player counts.
 * Matches are created dynamically only when both participants are known.
 */
export function generateDirectKnockoutFixtures(
  players: Player[],
  results: MatchResult[]
): {
  knockoutFixtures: Fixture[];
  allKnockoutStages: KnockoutStageType[];
} {
  const qualifiers = players.map((p) => p.user);
  if (qualifiers.length < 2) {
    return { knockoutFixtures: [], allKnockoutStages: [] };
  }

  const knockoutFixtures: Fixture[] = [];
  const allKnockoutStages: KnockoutStageType[] = [];

  const getWinnerAndLoser = (
    fixtureId: string,
    homeUser: string,
    awayUser: string
  ): { winner: string | null; loser: string | null; isDone: boolean } => {
    const hClean = homeUser.trim().toLowerCase();
    const aClean = awayUser.trim().toLowerCase();

    let res = results.find(
      (r) =>
        r.isKnockout &&
        (((r.home_user || '').trim().toLowerCase() === hClean && (r.away_user || '').trim().toLowerCase() === aClean) ||
          ((r.home_user || '').trim().toLowerCase() === aClean && (r.away_user || '').trim().toLowerCase() === hClean))
    );

    if (!res) {
      res = results.find(
        (r) =>
          (((r.home_user || '').trim().toLowerCase() === hClean && (r.away_user || '').trim().toLowerCase() === aClean) ||
            ((r.home_user || '').trim().toLowerCase() === aClean && (r.away_user || '').trim().toLowerCase() === hClean))
      );
    }

    if (!res || res.isPostponed) {
      return { winner: null, loser: null, isDone: false };
    }

    const resHomeClean = (res.home_user || '').trim().toLowerCase();
    const isDirect = resHomeClean === hClean;
    const hs = isDirect ? res.home_score : res.away_score;
    const as = isDirect ? res.away_score : res.home_score;

    if (hs > as) {
      return { winner: homeUser, loser: awayUser, isDone: true };
    } else if (as > hs) {
      return { winner: awayUser, loser: homeUser, isDone: true };
    } else if (res.penaltyWinner) {
      const penClean = res.penaltyWinner.trim().toLowerCase();
      const winner = penClean === hClean ? homeUser : awayUser;
      const loser = penClean === hClean ? awayUser : homeUser;
      return { winner, loser, isDone: true };
    } else if (res.penaltyHomeScore !== undefined && res.penaltyAwayScore !== undefined) {
      const phs = isDirect ? res.penaltyHomeScore : res.penaltyAwayScore;
      const pas = isDirect ? res.penaltyAwayScore : res.penaltyHomeScore;
      if (phs > pas) {
        return { winner: homeUser, loser: awayUser, isDone: true };
      } else {
        return { winner: awayUser, loser: homeUser, isDone: true };
      }
    }

    return { winner: homeUser, loser: awayUser, isDone: true };
  };

  // Case 1: 4 or fewer contestants -> Semi-finals -> Final & 3rd Place
  if (qualifiers.length <= 4) {
    allKnockoutStages.push('semi_final', 'third_place', 'final');
    const p1 = qualifiers[0];
    const p2 = qualifiers[1];
    const p3 = qualifiers[2];
    const p4 = qualifiers[3] || qualifiers[1];

    if (p1 && p2 && p3 && p4) {
      const sf1: Fixture = {
        id: 'ko-semi-1',
        matchday: 1,
        round: 1,
        home: p1,
        away: p2,
        rest: null,
        stage: 'Semi-final 1 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };
      const sf2: Fixture = {
        id: 'ko-semi-2',
        matchday: 1,
        round: 1,
        home: p3,
        away: p4,
        rest: null,
        stage: 'Semi-final 2 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };
      knockoutFixtures.push(sf1, sf2);

      const sf1Res = getWinnerAndLoser(sf1.id, sf1.home, sf1.away);
      const sf2Res = getWinnerAndLoser(sf2.id, sf2.home, sf2.away);

      if (sf1Res.isDone && sf2Res.isDone && sf1Res.winner && sf2Res.winner && sf1Res.loser && sf2Res.loser) {
        const thirdPlace: Fixture = {
          id: 'ko-third-place',
          matchday: 2,
          round: 2,
          home: sf1Res.loser,
          away: sf2Res.loser,
          rest: null,
          stage: '3rd Place Playoff 🥉',
          isKnockout: true,
          knockoutStage: 'third_place',
        };
        const finalMatch: Fixture = {
          id: 'ko-final',
          matchday: 2,
          round: 2,
          home: sf1Res.winner,
          away: sf2Res.winner,
          rest: null,
          stage: 'Grand Final 🏆',
          isKnockout: true,
          knockoutStage: 'final',
        };
        knockoutFixtures.push(thirdPlace, finalMatch);
      }
    }
  } else if (qualifiers.length <= 6) {
    // Case 2: 5 or 6 contestants -> Seeds 1 & 2 receive 1st-round Byes to Semi-Finals!
    // Quarter-Finals played between seeds 3, 4, 5, 6
    allKnockoutStages.push('quarter_final', 'semi_final', 'third_place', 'final');

    const seed1 = qualifiers[0];
    const seed2 = qualifiers[1];
    const seed3 = qualifiers[2];
    const seed4 = qualifiers[3];
    const seed5 = qualifiers[4];
    const seed6 = qualifiers[5]; // May be undefined if 5 contestants

    // QF 1: Seed 4 vs Seed 5 (Winner meets Seed 1 in SF 1)
    const qf1: Fixture = {
      id: 'ko-qf-1',
      matchday: 1,
      round: 1,
      home: seed4,
      away: seed5,
      rest: null,
      stage: 'Quarter-final 1 (Single Leg)',
      isKnockout: true,
      knockoutStage: 'quarter_final',
    };
    knockoutFixtures.push(qf1);

    // QF 2: Seed 3 vs Seed 6 (if seed 6 exists, otherwise Seed 3 gets bye to SF 2)
    let qf2Winner: string | null = null;
    if (seed6) {
      const qf2: Fixture = {
        id: 'ko-qf-2',
        matchday: 1,
        round: 1,
        home: seed3,
        away: seed6,
        rest: null,
        stage: 'Quarter-final 2 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      knockoutFixtures.push(qf2);
      const qf2Res = getWinnerAndLoser(qf2.id, qf2.home, qf2.away);
      if (qf2Res.isDone && qf2Res.winner) {
        qf2Winner = qf2Res.winner;
      }
    } else {
      qf2Winner = seed3; // Bye for seed 3
    }

    const qf1Res = getWinnerAndLoser(qf1.id, qf1.home, qf1.away);

    // Semi-Final 1: Seed 1 (Bye) vs QF 1 Winner
    if (qf1Res.isDone && qf1Res.winner && seed1) {
      const sf1: Fixture = {
        id: 'ko-semi-1',
        matchday: 2,
        round: 2,
        home: seed1,
        away: qf1Res.winner,
        rest: null,
        stage: 'Semi-final 1 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };
      knockoutFixtures.push(sf1);
    }

    // Semi-Final 2: Seed 2 (Bye) vs QF 2 Winner
    if (qf2Winner && seed2) {
      const sf2: Fixture = {
        id: 'ko-semi-2',
        matchday: 2,
        round: 2,
        home: seed2,
        away: qf2Winner,
        rest: null,
        stage: 'Semi-final 2 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };
      knockoutFixtures.push(sf2);
    }

    // Finals when both SFs are finished:
    const sf1Fixture = knockoutFixtures.find((f) => f.id === 'ko-semi-1');
    const sf2Fixture = knockoutFixtures.find((f) => f.id === 'ko-semi-2');
    if (sf1Fixture && sf2Fixture) {
      const sf1Res = getWinnerAndLoser(sf1Fixture.id, sf1Fixture.home, sf1Fixture.away);
      const sf2Res = getWinnerAndLoser(sf2Fixture.id, sf2Fixture.home, sf2Fixture.away);
      if (sf1Res.isDone && sf2Res.isDone && sf1Res.winner && sf2Res.winner && sf1Res.loser && sf2Res.loser) {
        const thirdPlace: Fixture = {
          id: 'ko-third-place',
          matchday: 3,
          round: 3,
          home: sf1Res.loser,
          away: sf2Res.loser,
          rest: null,
          stage: '3rd Place Playoff 🥉',
          isKnockout: true,
          knockoutStage: 'third_place',
        };
        const finalMatch: Fixture = {
          id: 'ko-final',
          matchday: 3,
          round: 3,
          home: sf1Res.winner,
          away: sf2Res.winner,
          rest: null,
          stage: 'Grand Final 🏆',
          isKnockout: true,
          knockoutStage: 'final',
        };
        knockoutFixtures.push(thirdPlace, finalMatch);
      }
    }
  } else {
    // Case 3: 7 to 8 contestants -> Quarter-finals -> Semi-finals -> Final & 3rd Place
    allKnockoutStages.push('quarter_final', 'semi_final', 'third_place', 'final');
    const qf1: Fixture = {
      id: 'ko-qf-1',
      matchday: 1,
      round: 1,
      home: qualifiers[0],
      away: qualifiers[1],
      rest: null,
      stage: 'Quarter-final 1 (Single Leg)',
      isKnockout: true,
      knockoutStage: 'quarter_final',
    };
    const qf2: Fixture = {
      id: 'ko-qf-2',
      matchday: 1,
      round: 1,
      home: qualifiers[2],
      away: qualifiers[3],
      rest: null,
      stage: 'Quarter-final 2 (Single Leg)',
      isKnockout: true,
      knockoutStage: 'quarter_final',
    };
    const qf3: Fixture = {
      id: 'ko-qf-3',
      matchday: 1,
      round: 1,
      home: qualifiers[4],
      away: qualifiers[5],
      rest: null,
      stage: 'Quarter-final 3 (Single Leg)',
      isKnockout: true,
      knockoutStage: 'quarter_final',
    };

    knockoutFixtures.push(qf1, qf2, qf3);

    let qf4Winner: string | null = null;
    if (qualifiers[6] && qualifiers[7]) {
      const qf4: Fixture = {
        id: 'ko-qf-4',
        matchday: 1,
        round: 1,
        home: qualifiers[6],
        away: qualifiers[7],
        rest: null,
        stage: 'Quarter-final 4 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'quarter_final',
      };
      knockoutFixtures.push(qf4);
      const qf4Res = getWinnerAndLoser(qf4.id, qf4.home, qf4.away);
      if (qf4Res.isDone && qf4Res.winner) {
        qf4Winner = qf4Res.winner;
      }
    } else if (qualifiers[6]) {
      // Bye: 7th contestant directly advances to Semi-Final 2
      qf4Winner = qualifiers[6];
    }

    const qf1Res = getWinnerAndLoser(qf1.id, qf1.home, qf1.away);
    const qf2Res = getWinnerAndLoser(qf2.id, qf2.home, qf2.away);
    const qf3Res = getWinnerAndLoser(qf3.id, qf3.home, qf3.away);

    // Semi-Final 1: QF1 Winner vs QF2 Winner
    if (qf1Res.isDone && qf2Res.isDone && qf1Res.winner && qf2Res.winner) {
      const sf1: Fixture = {
        id: 'ko-semi-1',
        matchday: 2,
        round: 2,
        home: qf1Res.winner,
        away: qf2Res.winner,
        rest: null,
        stage: 'Semi-final 1 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };
      knockoutFixtures.push(sf1);
    }

    // Semi-Final 2: QF3 Winner vs QF4 Winner (or Bye)
    if (qf3Res.isDone && qf3Res.winner && qf4Winner) {
      const sf2: Fixture = {
        id: 'ko-semi-2',
        matchday: 2,
        round: 2,
        home: qf3Res.winner,
        away: qf4Winner,
        rest: null,
        stage: 'Semi-final 2 (Single Leg)',
        isKnockout: true,
        knockoutStage: 'semi_final',
      };
      knockoutFixtures.push(sf2);
    }

    // Finals when both SFs are finished:
    const sf1Fixture = knockoutFixtures.find((f) => f.id === 'ko-semi-1');
    const sf2Fixture = knockoutFixtures.find((f) => f.id === 'ko-semi-2');
    if (sf1Fixture && sf2Fixture) {
      const sf1Res = getWinnerAndLoser(sf1Fixture.id, sf1Fixture.home, sf1Fixture.away);
      const sf2Res = getWinnerAndLoser(sf2Fixture.id, sf2Fixture.home, sf2Fixture.away);
      if (sf1Res.isDone && sf2Res.isDone && sf1Res.winner && sf2Res.winner && sf1Res.loser && sf2Res.loser) {
        const thirdPlace: Fixture = {
          id: 'ko-third-place',
          matchday: 3,
          round: 3,
          home: sf1Res.loser,
          away: sf2Res.loser,
          rest: null,
          stage: '3rd Place Playoff 🥉',
          isKnockout: true,
          knockoutStage: 'third_place',
        };
        const finalMatch: Fixture = {
          id: 'ko-final',
          matchday: 3,
          round: 3,
          home: sf1Res.winner,
          away: sf2Res.winner,
          rest: null,
          stage: 'Grand Final 🏆',
          isKnockout: true,
          knockoutStage: 'final',
        };
        knockoutFixtures.push(thirdPlace, finalMatch);
      }
    }
  }

  return { knockoutFixtures, allKnockoutStages };
}

