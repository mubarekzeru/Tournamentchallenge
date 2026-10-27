import {
  Player,
  Fixture,
  MatchResult,
  TournamentFormat,
  GroupStageConfig,
  KnockoutStageType,
} from '../types/tournament';
import {
  partitionPlayersIntoGroups,
  calculateGroupStandings,
  DEFAULT_GROUP_CONFIG,
} from './groupStage';

export interface BracketTieParticipant {
  user: string;
  player?: Player;
  isWinner: boolean;
  isLoser: boolean;
  score: number | null;
  penaltyScore?: number | null;
}

export interface BracketTieModel {
  id: string; // e.g. "ko-qf-1"
  fixtureId?: string;
  stage: KnockoutStageType;
  stageName: string; // e.g. "Quarter-finals"
  stageBadge: string; // e.g. "QF 1"
  side: 'left' | 'right' | 'center';
  home: BracketTieParticipant | null;
  away: BracketTieParticipant | null;
  isCompleted: boolean;
  isLive: boolean;
  isPostponed: boolean;
  postponedReason?: string;
  venue: string;
  dateStr?: string;
  winnerUser: string | null;
  loserUser: string | null;
  penaltyWinner?: string | null;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  isBye?: boolean;
  byeUser?: string | null;
  // Connection mapping:
  childLeftId?: string; // id of match feeding into home
  childRightId?: string; // id of match feeding into away
  nextMatchId?: string; // id of match this winner advances to
}

export interface BracketRoundColumn {
  stage: KnockoutStageType;
  title: string;
  badge: string;
  leftTies: BracketTieModel[];
  rightTies: BracketTieModel[];
}

export interface SymmetricalBracketData {
  title: string;
  subtitle: string;
  rounds: BracketRoundColumn[];
  finalTie: BracketTieModel | null;
  thirdPlaceTie: BracketTieModel | null;
  champion: Player | null;
  allTies: BracketTieModel[];
  isReady: boolean;
  emptyStateReason?: string;
  stats: {
    totalTies: number;
    completedTies: number;
    upcomingTies: number;
    totalGoals: number;
  };
}

// Helper to look up recorded result for a knockout match
function findResult(
  results: MatchResult[],
  homeUser?: string | null,
  awayUser?: string | null,
  stage?: string
): MatchResult | undefined {
  if (!homeUser || !awayUser) return undefined;
  const hClean = homeUser.trim().toLowerCase();
  const aClean = awayUser.trim().toLowerCase();

  // 1. Try explicit match flagged with isKnockout
  const koMatch = results.find((r) => {
    if (!r.isKnockout) return false;
    const rH = (r.home_user || '').trim().toLowerCase();
    const rA = (r.away_user || '').trim().toLowerCase();
    const isPair = (rH === hClean && rA === aClean) || (rH === aClean && rA === hClean);
    if (!isPair) return false;
    if (stage && r.stage) {
      return r.stage.toLowerCase().includes(stage.toLowerCase());
    }
    return true;
  });
  if (koMatch) return koMatch;

  // 2. Any match flagged with isKnockout between the two players
  const anyKoMatch = results.find((r) => {
    if (!r.isKnockout) return false;
    const rH = (r.home_user || '').trim().toLowerCase();
    const rA = (r.away_user || '').trim().toLowerCase();
    return (rH === hClean && rA === aClean) || (rH === aClean && rA === hClean);
  });
  if (anyKoMatch) return anyKoMatch;

  // 3. Match tagged with matching stage name in stage string
  if (stage) {
    const stageMatch = results.find((r) => {
      const rH = (r.home_user || '').trim().toLowerCase();
      const rA = (r.away_user || '').trim().toLowerCase();
      const isPair = (rH === hClean && rA === aClean) || (rH === aClean && rA === hClean);
      if (!isPair) return false;
      return r.stage && r.stage.toLowerCase().includes(stage.toLowerCase());
    });
    if (stageMatch) return stageMatch;
  }

  // 4. Non-group match (e.g. from direct cup or Owner Desk score entry where isKnockout was not set)
  const nonGroupMatch = results.find((r) => {
    if (r.group) return false;
    const rH = (r.home_user || '').trim().toLowerCase();
    const rA = (r.away_user || '').trim().toLowerCase();
    return (rH === hClean && rA === aClean) || (rH === aClean && rA === hClean);
  });
  if (nonGroupMatch) return nonGroupMatch;

  // 5. Final fallback: Most recent recorded match between the two participants
  const matchingResults = results.filter((r) => {
    const rH = (r.home_user || '').trim().toLowerCase();
    const rA = (r.away_user || '').trim().toLowerCase();
    return (rH === hClean && rA === aClean) || (rH === aClean && rA === hClean);
  });

  return matchingResults.length > 0 ? matchingResults[matchingResults.length - 1] : undefined;
}

// Determines winner and loser from a match result
function evaluateResult(
  res: MatchResult | undefined,
  homeUser: string | null,
  awayUser: string | null
): {
  isCompleted: boolean;
  winner: string | null;
  loser: string | null;
  homeScore: number | null;
  awayScore: number | null;
  penaltyWinner: string | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
} {
  if (!res || res.isPostponed || homeUser === null || awayUser === null) {
    return {
      isCompleted: false,
      winner: null,
      loser: null,
      homeScore: null,
      awayScore: null,
      penaltyWinner: null,
      penaltyHomeScore: null,
      penaltyAwayScore: null,
    };
  }

  const hClean = homeUser.trim().toLowerCase();
  const aClean = awayUser.trim().toLowerCase();
  const resHomeClean = (res.home_user || '').trim().toLowerCase();
  const isDirect = resHomeClean === hClean;
  const hs = isDirect ? res.home_score : res.away_score;
  const as = isDirect ? res.away_score : res.home_score;
  let winner: string | null = null;
  let loser: string | null = null;

  if (hs > as) {
    winner = homeUser;
    loser = awayUser;
  } else if (as > hs) {
    winner = awayUser;
    loser = homeUser;
  } else if (res.penaltyWinner) {
    const penClean = res.penaltyWinner.trim().toLowerCase();
    winner = penClean === hClean ? homeUser : awayUser;
    loser = penClean === hClean ? awayUser : homeUser;
  } else if (res.penaltyHomeScore !== undefined && res.penaltyAwayScore !== undefined) {
    const phs = isDirect ? res.penaltyHomeScore : res.penaltyAwayScore;
    const pas = isDirect ? res.penaltyAwayScore : res.penaltyHomeScore;
    if (phs > pas) {
      winner = homeUser;
      loser = awayUser;
    } else {
      winner = awayUser;
      loser = homeUser;
    }
  } else {
    // Draw without penalty winner recorded: default winner to homeUser (higher seed) so bracket advances
    winner = homeUser;
    loser = awayUser;
  }

  return {
    isCompleted: true,
    winner,
    loser,
    homeScore: hs,
    awayScore: as,
    penaltyWinner: res.penaltyWinner || null,
    penaltyHomeScore: res.penaltyHomeScore !== undefined ? res.penaltyHomeScore : null,
    penaltyAwayScore: res.penaltyAwayScore !== undefined ? res.penaltyAwayScore : null,
  };
}

/**
 * Builds the complete Symmetrical Dual-Wing Cup Bracket
 * for both Group Stage Knockouts and Direct Cup Knockouts.
 */
export function buildSymmetricalBracket(
  players: Player[],
  results: MatchResult[],
  tournamentFormat: TournamentFormat = 'knockout',
  config: GroupStageConfig = DEFAULT_GROUP_CONFIG
): SymmetricalBracketData {
  const playerMap = new Map<string, Player>(players.map((p) => [p.user, p]));

  // In League Format: Bracket is not applicable
  if (tournamentFormat === 'league_single' || tournamentFormat === 'league_double') {
    return {
      title: 'ETHIOPIAN eFOOTBALL TOURNAMENT',
      subtitle: 'CHAMPIONSHIP BRACKET',
      rounds: [],
      finalTie: null,
      thirdPlaceTie: null,
      champion: null,
      allTies: [],
      isReady: false,
      emptyStateReason:
        'Bracket is hidden in League Format. Switch to Knockout playing style in Administrator to view tournament bracket.',
      stats: { totalTies: 0, completedTies: 0, upcomingTies: 0, totalGoals: 0 },
    };
  }

  // 1. Determine Qualifiers / Participants directly from registered players
  let qualifiers: string[] = [];
  let isGroupStageFinished = true;

  if (tournamentFormat === 'group_stage') {
    const { groups, groupLetters } = partitionPlayersIntoGroups(players, config, results);
    const qualifiersByGroup: Record<string, string[]> = {};

    let allDone = true;
    groupLetters.forEach((letter) => {
      const members = groups[letter] || [];
      const calc = calculateGroupStandings(
        members,
        results,
        config.qualifiersPerGroup,
        config.manualTieBreakers?.[letter]
      );
      if (!calc.isGroupComplete) allDone = false;
      qualifiersByGroup[letter] = calc.standings
        .slice(0, config.qualifiersPerGroup)
        .map((p) => p.user);
    });

    isGroupStageFinished = allDone;

    // Combine group qualifiers with strict cross-seeding
    // 2 Groups (Group A and Group B): 1st A vs 2nd B, 1st B vs 2nd A
    if (groupLetters.length >= 2) {
      const firstA = qualifiersByGroup['A']?.[0] || groups['A']?.[0]?.user;
      const secondA = qualifiersByGroup['A']?.[1] || groups['A']?.[1]?.user;
      const firstB = qualifiersByGroup['B']?.[0] || groups['B']?.[0]?.user;
      const secondB = qualifiersByGroup['B']?.[1] || groups['B']?.[1]?.user;
      if (firstA && secondB && firstB && secondA) {
        qualifiers = [firstA, secondB, firstB, secondA]; // SF1: 1A vs 2B (left wing), SF2: 1B vs 2A (right wing)
      }
    } else if (groupLetters.length === 4) {
      // 4 Groups: 1st A vs 2nd B, 1st C vs 2nd D (left wing); 1st B vs 2nd A, 1st D vs 2nd C (right wing)
      const a1 = qualifiersByGroup['A']?.[0];
      const a2 = qualifiersByGroup['A']?.[1];
      const b1 = qualifiersByGroup['B']?.[0];
      const b2 = qualifiersByGroup['B']?.[1];
      const c1 = qualifiersByGroup['C']?.[0];
      const c2 = qualifiersByGroup['C']?.[1];
      const d1 = qualifiersByGroup['D']?.[0];
      const d2 = qualifiersByGroup['D']?.[1];
      if (a1 && a2 && b1 && b2 && c1 && c2 && d1 && d2) {
        qualifiers = [a1, b2, c1, d2, b1, a2, d1, c2];
      }
    } else if (groupLetters.length === 3) {
      // 3 Groups with 2 best thirds
      const thirds: { user: string; points: number; gd: number; gf: number }[] = [];
      groupLetters.forEach((l) => {
        const mems = groups[l] || [];
        const calc = calculateGroupStandings(mems, results, 2);
        const p = calc.standings[2];
        if (p) thirds.push({ user: p.user, points: p.points, gd: p.gd, gf: p.gf });
      });
      thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

      const a1 = qualifiersByGroup['A']?.[0];
      const a2 = qualifiersByGroup['A']?.[1];
      const b1 = qualifiersByGroup['B']?.[0];
      const b2 = qualifiersByGroup['B']?.[1];
      const c1 = qualifiersByGroup['C']?.[0];
      const c2 = qualifiersByGroup['C']?.[1];
      const t1 = thirds[0]?.user;
      const t2 = thirds[1]?.user;
      if (a1 && b2 && c1 && t2 && b1 && a2 && c2 && t1) {
        qualifiers = [a1, t1, b1, c2, c1, t2, a2, b2];
      }
    } else {
      // Generic pool of qualifiers
      const list: string[] = [];
      groupLetters.forEach((l) => {
        list.push(...(qualifiersByGroup[l] || []));
      });
      qualifiers = list;
    }
  } else {
    // tournamentFormat === 'knockout_cup' (direct cup draw from registered players)
    qualifiers = players.map((p) => p.user);
  }

  if (qualifiers.length < 2) {
    return {
      title: 'ETHIOPIAN eFOOTBALL TOURNAMENT',
      subtitle: 'CHAMPIONSHIP DRAW',
      rounds: [],
      finalTie: null,
      thirdPlaceTie: null,
      champion: null,
      allTies: [],
      isReady: false,
      emptyStateReason: 'At least 2 qualified contestants are required to generate the cup bracket.',
      stats: { totalTies: 0, completedTies: 0, upcomingTies: 0, totalGoals: 0 },
    };
  }

  // Bracket Structure Assembly
  const allTies: BracketTieModel[] = [];
  const rounds: BracketRoundColumn[] = [];

  // Helper to build a tie model
  const createTie = (
    id: string,
    stage: KnockoutStageType,
    stageName: string,
    stageBadge: string,
    side: 'left' | 'right' | 'center',
    homeUser: string | null,
    awayUser: string | null,
    options?: { childLeftId?: string; childRightId?: string; nextMatchId?: string }
  ): BracketTieModel => {
    const res = findResult(results, homeUser, awayUser, stage);
    const evalData = evaluateResult(res, homeUser, awayUser);
    const homePlayer = homeUser ? playerMap.get(homeUser) : undefined;
    const awayPlayer = awayUser ? playerMap.get(awayUser) : undefined;

    const tie: BracketTieModel = {
      id,
      stage,
      stageName,
      stageBadge,
      side,
      home: homeUser
        ? {
            user: homeUser,
            player: homePlayer,
            isWinner: evalData.isCompleted && evalData.winner === homeUser,
            isLoser: evalData.isCompleted && evalData.loser === homeUser,
            score: evalData.homeScore,
            penaltyScore: evalData.penaltyHomeScore,
          }
        : null,
      away: awayUser
        ? {
            user: awayUser,
            player: awayPlayer,
            isWinner: evalData.isCompleted && evalData.winner === awayUser,
            isLoser: evalData.isCompleted && evalData.loser === awayUser,
            score: evalData.awayScore,
            penaltyScore: evalData.penaltyAwayScore,
          }
        : null,
      isCompleted: evalData.isCompleted,
      isLive: !evalData.isCompleted && homeUser !== null && awayUser !== null && !!res,
      isPostponed: !!res?.isPostponed,
      postponedReason: res?.postponedReason,
      venue: res?.venue || 'Online Lobby • PS5 / Mobile',
      dateStr: res?.submitted_at,
      winnerUser: evalData.winner,
      loserUser: evalData.loser,
      penaltyWinner: evalData.penaltyWinner,
      penaltyHomeScore: evalData.penaltyHomeScore,
      penaltyAwayScore: evalData.penaltyAwayScore,
      childLeftId: options?.childLeftId,
      childRightId: options?.childRightId,
      nextMatchId: options?.nextMatchId,
    };

    allTies.push(tie);
    return tie;
  };

  // Case A: 4 Qualifiers -> Semi-finals (1 left, 1 right) -> Final (center)
  if (qualifiers.length <= 4) {
    const sf1Home = qualifiers[0] || null;
    const sf1Away = qualifiers[1] || null;
    const sf2Home = qualifiers[2] || null;
    const sf2Away = qualifiers[3] || null;

    const sf1 = createTie('ko-semi-1', 'semi_final', 'Semi-finals', 'SF 1', 'left', sf1Home, sf1Away, {
      nextMatchId: 'ko-final',
    });
    const sf2 = createTie('ko-semi-2', 'semi_final', 'Semi-finals', 'SF 2', 'right', sf2Home, sf2Away, {
      nextMatchId: 'ko-final',
    });

    const finalHome = sf1.winnerUser;
    const finalAway = sf2.winnerUser;
    const finalTie = createTie(
      'ko-final',
      'final',
      'Grand Final',
      'FINAL',
      'center',
      finalHome,
      finalAway,
      { childLeftId: 'ko-semi-1', childRightId: 'ko-semi-2' }
    );

    const thirdHome = sf1.loserUser;
    const thirdAway = sf2.loserUser;
    const thirdTie = createTie(
      'ko-third-place',
      'third_place',
      '3rd Place Playoff',
      '3RD PLACE',
      'center',
      thirdHome,
      thirdAway
    );

    rounds.push({
      stage: 'semi_final',
      title: 'SEMI-FINALS',
      badge: 'STAGE 1',
      leftTies: [sf1],
      rightTies: [sf2],
    });

    const champion = finalTie.winnerUser ? playerMap.get(finalTie.winnerUser) || null : null;

    const completedCount = allTies.filter((t) => t.isCompleted).length;
    const totalGoals = allTies
      .filter((t) => t.isCompleted)
      .reduce((sum, t) => sum + (t.home?.score ?? 0) + (t.away?.score ?? 0), 0);

    return {
      title: 'ETHIOPIAN eFOOTBALL TOURNAMENT',
      subtitle: 'CHAMPIONSHIP BRACKET',
      rounds,
      finalTie,
      thirdPlaceTie: thirdTie,
      champion,
      allTies,
      isReady: true,
      stats: {
        totalTies: allTies.length,
        completedTies: completedCount,
        upcomingTies: allTies.length - completedCount,
        totalGoals,
      },
    };
  }

  // Case B: 5 or 6 Qualifiers -> 2 Quarter-finals (1 left, 1 right) -> 2 Semi-finals with Byes for Seeds 1 & 2 -> Final & 3rd Place
  if (qualifiers.length <= 6) {
    const seed1 = qualifiers[0] || null;
    const seed2 = qualifiers[1] || null;
    const seed3 = qualifiers[2] || null;
    const seed4 = qualifiers[3] || null;
    const seed5 = qualifiers[4] || null;
    const seed6 = qualifiers[5] || null;

    // Left Wing QF: Seed 4 vs Seed 5 -> Winner advances to SF 1
    const qf1 = createTie(
      'ko-qf-1',
      'quarter_final',
      'Quarter-finals',
      'QF 1',
      'left',
      seed4,
      seed5,
      { nextMatchId: 'ko-semi-1' }
    );

    // Right Wing QF: Seed 3 vs Seed 6 -> Winner advances to SF 2
    const qf2 = createTie(
      'ko-qf-2',
      'quarter_final',
      'Quarter-finals',
      'QF 2',
      'right',
      seed3,
      seed6,
      { nextMatchId: 'ko-semi-2' }
    );

    // Left Wing SF: Seed 1 (1st Round Bye) vs QF 1 Winner
    const sf1 = createTie(
      'ko-semi-1',
      'semi_final',
      'Semi-finals',
      'SF 1',
      'left',
      seed1,
      qf1.winnerUser,
      { childRightId: 'ko-qf-1', nextMatchId: 'ko-final' }
    );

    // Right Wing SF: Seed 2 (1st Round Bye) vs QF 2 Winner
    const sf2 = createTie(
      'ko-semi-2',
      'semi_final',
      'Semi-finals',
      'SF 2',
      'right',
      seed2,
      qf2.winnerUser,
      { childRightId: 'ko-qf-2', nextMatchId: 'ko-final' }
    );

    // Center Final
    const finalTie = createTie(
      'ko-final',
      'final',
      'Grand Final',
      'FINAL',
      'center',
      sf1.winnerUser,
      sf2.winnerUser,
      { childLeftId: 'ko-semi-1', childRightId: 'ko-semi-2' }
    );

    // Center 3rd place match
    const thirdTie = createTie(
      'ko-third-place',
      'third_place',
      '3rd Place Playoff',
      '3RD PLACE',
      'center',
      sf1.loserUser,
      sf2.loserUser
    );

    rounds.push({
      stage: 'quarter_final',
      title: 'QUARTER-FINALS',
      badge: 'STAGE 1',
      leftTies: [qf1],
      rightTies: [qf2],
    });

    rounds.push({
      stage: 'semi_final',
      title: 'SEMI-FINALS',
      badge: 'STAGE 2',
      leftTies: [sf1],
      rightTies: [sf2],
    });

    const champion = finalTie.winnerUser ? playerMap.get(finalTie.winnerUser) || null : null;
    const completedCount = allTies.filter((t) => t.isCompleted).length;
    const totalGoals = allTies
      .filter((t) => t.isCompleted)
      .reduce((sum, t) => sum + (t.home?.score ?? 0) + (t.away?.score ?? 0), 0);

    return {
      title: 'ETHIOPIAN eFOOTBALL TOURNAMENT',
      subtitle: 'CHAMPIONSHIP BRACKET',
      rounds,
      finalTie,
      thirdPlaceTie: thirdTie,
      champion,
      allTies,
      isReady: true,
      stats: {
        totalTies: allTies.length,
        completedTies: completedCount,
        upcomingTies: allTies.length - completedCount,
        totalGoals,
      },
    };
  }

  // Case C: 7 or 8 Qualifiers -> Quarter-finals (2 left, 2 right) -> Semi-finals (1 left, 1 right) -> Final (center)
  if (qualifiers.length <= 8) {
    // Left Wing QF ties
    const qf1 = createTie(
      'ko-qf-1',
      'quarter_final',
      'Quarter-finals',
      'QF 1',
      'left',
      qualifiers[0] || null,
      qualifiers[1] || null,
      { nextMatchId: 'ko-semi-1' }
    );
    const qf2 = createTie(
      'ko-qf-2',
      'quarter_final',
      'Quarter-finals',
      'QF 2',
      'left',
      qualifiers[2] || null,
      qualifiers[3] || null,
      { nextMatchId: 'ko-semi-1' }
    );

    // Right Wing QF ties
    const qf3 = createTie(
      'ko-qf-3',
      'quarter_final',
      'Quarter-finals',
      'QF 3',
      'right',
      qualifiers[4] || null,
      qualifiers[5] || null,
      { nextMatchId: 'ko-semi-2' }
    );
    const qf4 = createTie(
      'ko-qf-4',
      'quarter_final',
      'Quarter-finals',
      'QF 4',
      'right',
      qualifiers[6] || null,
      qualifiers[7] || null,
      { nextMatchId: 'ko-semi-2' }
    );

    // Left SF (QF1 vs QF2 winners)
    const sf1 = createTie(
      'ko-semi-1',
      'semi_final',
      'Semi-finals',
      'SF 1',
      'left',
      qf1.winnerUser,
      qf2.winnerUser,
      { childLeftId: 'ko-qf-1', childRightId: 'ko-qf-2', nextMatchId: 'ko-final' }
    );

    // Right SF (QF3 vs QF4 winners)
    const sf2 = createTie(
      'ko-semi-2',
      'semi_final',
      'Semi-finals',
      'SF 2',
      'right',
      qf3.winnerUser,
      qf4.winnerUser,
      { childLeftId: 'ko-qf-3', childRightId: 'ko-qf-4', nextMatchId: 'ko-final' }
    );

    // Center Final
    const finalTie = createTie(
      'ko-final',
      'final',
      'Grand Final',
      'FINAL',
      'center',
      sf1.winnerUser,
      sf2.winnerUser,
      { childLeftId: 'ko-semi-1', childRightId: 'ko-semi-2' }
    );

    // Center 3rd place match
    const thirdTie = createTie(
      'ko-third-place',
      'third_place',
      '3rd Place Playoff',
      '3RD PLACE',
      'center',
      sf1.loserUser,
      sf2.loserUser
    );

    rounds.push({
      stage: 'quarter_final',
      title: 'QUARTER-FINALS',
      badge: 'STAGE 1',
      leftTies: [qf1, qf2],
      rightTies: [qf3, qf4],
    });

    rounds.push({
      stage: 'semi_final',
      title: 'SEMI-FINALS',
      badge: 'STAGE 2',
      leftTies: [sf1],
      rightTies: [sf2],
    });

    const champion = finalTie.winnerUser ? playerMap.get(finalTie.winnerUser) || null : null;
    const completedCount = allTies.filter((t) => t.isCompleted).length;
    const totalGoals = allTies
      .filter((t) => t.isCompleted)
      .reduce((sum, t) => sum + (t.home?.score ?? 0) + (t.away?.score ?? 0), 0);

    return {
      title: 'ETHIOPIAN eFOOTBALL TOURNAMENT',
      subtitle: 'CHAMPIONSHIP BRACKET',
      rounds,
      finalTie,
      thirdPlaceTie: thirdTie,
      champion,
      allTies,
      isReady: true,
      stats: {
        totalTies: allTies.length,
        completedTies: completedCount,
        upcomingTies: allTies.length - completedCount,
        totalGoals,
      },
    };
  }

  // Case C: 16 Qualifiers -> Round of 16 (4 left, 4 right) -> Quarter-finals (2 left, 2 right) -> Semi-finals (1 left, 1 right) -> Final (center)
  // Left wing R16 ties
  const r16_1 = createTie('ko-r16-1', 'round_of_16', 'Round of 16', 'R16 1', 'left', qualifiers[0] || null, qualifiers[1] || null, { nextMatchId: 'ko-qf-1' });
  const r16_2 = createTie('ko-r16-2', 'round_of_16', 'Round of 16', 'R16 2', 'left', qualifiers[2] || null, qualifiers[3] || null, { nextMatchId: 'ko-qf-1' });
  const r16_3 = createTie('ko-r16-3', 'round_of_16', 'Round of 16', 'R16 3', 'left', qualifiers[4] || null, qualifiers[5] || null, { nextMatchId: 'ko-qf-2' });
  const r16_4 = createTie('ko-r16-4', 'round_of_16', 'Round of 16', 'R16 4', 'left', qualifiers[6] || null, qualifiers[7] || null, { nextMatchId: 'ko-qf-2' });

  // Right wing R16 ties
  const r16_5 = createTie('ko-r16-5', 'round_of_16', 'Round of 16', 'R16 5', 'right', qualifiers[8] || null, qualifiers[9] || null, { nextMatchId: 'ko-qf-3' });
  const r16_6 = createTie('ko-r16-6', 'round_of_16', 'Round of 16', 'R16 6', 'right', qualifiers[10] || null, qualifiers[11] || null, { nextMatchId: 'ko-qf-3' });
  const r16_7 = createTie('ko-r16-7', 'round_of_16', 'Round of 16', 'R16 7', 'right', qualifiers[12] || null, qualifiers[13] || null, { nextMatchId: 'ko-qf-4' });
  const r16_8 = createTie('ko-r16-8', 'round_of_16', 'Round of 16', 'R16 8', 'right', qualifiers[14] || null, qualifiers[15] || null, { nextMatchId: 'ko-qf-4' });

  // QF ties
  const qf1 = createTie('ko-qf-1', 'quarter_final', 'Quarter-finals', 'QF 1', 'left', r16_1.winnerUser, r16_2.winnerUser, { childLeftId: 'ko-r16-1', childRightId: 'ko-r16-2', nextMatchId: 'ko-semi-1' });
  const qf2 = createTie('ko-qf-2', 'quarter_final', 'Quarter-finals', 'QF 2', 'left', r16_3.winnerUser, r16_4.winnerUser, { childLeftId: 'ko-r16-3', childRightId: 'ko-r16-4', nextMatchId: 'ko-semi-1' });
  const qf3 = createTie('ko-qf-3', 'quarter_final', 'Quarter-finals', 'QF 3', 'right', r16_5.winnerUser, r16_6.winnerUser, { childLeftId: 'ko-r16-5', childRightId: 'ko-r16-6', nextMatchId: 'ko-semi-2' });
  const qf4 = createTie('ko-qf-4', 'quarter_final', 'Quarter-finals', 'QF 4', 'right', r16_7.winnerUser, r16_8.winnerUser, { childLeftId: 'ko-r16-7', childRightId: 'ko-r16-8', nextMatchId: 'ko-semi-2' });

  // SF ties
  const sf1 = createTie('ko-semi-1', 'semi_final', 'Semi-finals', 'SF 1', 'left', qf1.winnerUser, qf2.winnerUser, { childLeftId: 'ko-qf-1', childRightId: 'ko-qf-2', nextMatchId: 'ko-final' });
  const sf2 = createTie('ko-semi-2', 'semi_final', 'Semi-finals', 'SF 2', 'right', qf3.winnerUser, qf4.winnerUser, { childLeftId: 'ko-qf-3', childRightId: 'ko-qf-4', nextMatchId: 'ko-final' });

  // Final & 3rd Place
  const finalTie = createTie('ko-final', 'final', 'Grand Final', 'FINAL', 'center', sf1.winnerUser, sf2.winnerUser, { childLeftId: 'ko-semi-1', childRightId: 'ko-semi-2' });
  const thirdTie = createTie('ko-third-place', 'third_place', '3rd Place Playoff', '3RD PLACE', 'center', sf1.loserUser, sf2.loserUser);

  rounds.push({
    stage: 'round_of_16',
    title: 'ROUND OF 16',
    badge: 'STAGE 1',
    leftTies: [r16_1, r16_2, r16_3, r16_4],
    rightTies: [r16_5, r16_6, r16_7, r16_8],
  });

  rounds.push({
    stage: 'quarter_final',
    title: 'QUARTER-FINALS',
    badge: 'STAGE 2',
    leftTies: [qf1, qf2],
    rightTies: [qf3, qf4],
  });

  rounds.push({
    stage: 'semi_final',
    title: 'SEMI-FINALS',
    badge: 'STAGE 3',
    leftTies: [sf1],
    rightTies: [sf2],
  });

  const champion = finalTie.winnerUser ? playerMap.get(finalTie.winnerUser) || null : null;
  const completedCount = allTies.filter((t) => t.isCompleted).length;
  const totalGoals = allTies
    .filter((t) => t.isCompleted)
    .reduce((sum, t) => sum + (t.home?.score ?? 0) + (t.away?.score ?? 0), 0);

  return {
    title: 'ETHIOPIAN eFOOTBALL TOURNAMENT',
    subtitle: 'CHAMPIONSHIP BRACKET',
    rounds,
    finalTie,
    thirdPlaceTie: thirdTie,
    champion,
    allTies,
    isReady: true,
    stats: {
      totalTies: allTies.length,
      completedTies: completedCount,
      upcomingTies: allTies.length - completedCount,
      totalGoals,
    },
  };
}

/**
 * Traces the complete path of a player through the bracket
 * and returns the set of match IDs they participated in or lead to.
 */
export function getPlayerPathMatchIds(
  username: string,
  allTies: BracketTieModel[]
): Set<string> {
  const pathIds = new Set<string>();
  if (!username) return pathIds;

  allTies.forEach((tie) => {
    if (tie.home?.user === username || tie.away?.user === username) {
      pathIds.add(tie.id);
    }
  });

  return pathIds;
}
