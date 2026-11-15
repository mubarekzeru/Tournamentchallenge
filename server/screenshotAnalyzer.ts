import { GoogleGenAI, Type } from '@google/genai';
import { Fixture, MatchResult, Player } from '../src/types/tournament';
import { findResultForFixture } from './firestoreBridge';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface AnalyzedMatchScreenshot {
  isMatchScreenshot: boolean;
  homeTeamName: string;
  homeUsername: string;
  homeLogoDescription: string;
  awayTeamName: string;
  awayUsername: string;
  awayLogoDescription: string;
  homeScore: number;
  awayScore: number;
  hasPenaltyShootout: boolean;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  matchedHomeUser: string;
  matchedAwayUser: string;
  confidence: number;
  matchReasoning: string;
}

interface InlineImageData {
  mimeType: string;
  data: string;
}

async function resolveAvatarAsInlineData(
  avatarUrl?: string
): Promise<InlineImageData | null> {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  const trimmed = avatarUrl.trim();
  if (trimmed.startsWith('data:image/')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return null;
    const header = trimmed.slice(5, commaIdx); // e.g. image/png;base64
    const mimeType = header.split(';')[0] || 'image/png';
    const data = trimmed.slice(commaIdx + 1);
    if (!data || data.length > 500_000) return null;
    return { mimeType, data };
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(trimmed, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const mimeType = (res.headers.get('content-type') || 'image/png').split(';')[0];
      if (!mimeType.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 400_000) return null;
      return { mimeType, data: buf.toString('base64') };
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeStr(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function fuzzyFindPlayer(
  players: Player[],
  candidates: Array<string | undefined | null>
): Player | null {
  const cleanedCandidates = candidates
    .map((c) => normalizeStr(c))
    .filter((c) => c.length >= 2);
  if (cleanedCandidates.length === 0) return null;

  // 1. Exact normalized match on user, team, or telegramUsername
  for (const cand of cleanedCandidates) {
    const exact = players.find(
      (p) =>
        normalizeStr(p.user) === cand ||
        normalizeStr(p.team) === cand ||
        (p.telegramUsername && normalizeStr(p.telegramUsername) === cand)
    );
    if (exact) return exact;
  }

  // 2. Partial / prefix / substring match (handles truncated names like "Visça Barça @gayrat10...")
  let bestPlayer: Player | null = null;
  let bestScore = 0;

  for (const p of players) {
    const userNorm = normalizeStr(p.user);
    const teamNorm = normalizeStr(p.team);
    const tgNorm = normalizeStr(p.telegramUsername);

    for (const cand of cleanedCandidates) {
      let score = 0;
      if (userNorm && (cand.includes(userNorm) || userNorm.includes(cand))) {
        score = Math.max(
          score,
          Math.min(cand.length, userNorm.length) >= 3 ? 85 : 0
        );
      }
      if (teamNorm && (cand.includes(teamNorm) || teamNorm.includes(cand))) {
        score = Math.max(
          score,
          Math.min(cand.length, teamNorm.length) >= 4 ? 80 : 0
        );
      }
      if (tgNorm && (cand.includes(tgNorm) || tgNorm.includes(cand))) {
        score = Math.max(
          score,
          Math.min(cand.length, tgNorm.length) >= 3 ? 75 : 0
        );
      }

      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
      }
    }
  }

  return bestScore >= 75 ? bestPlayer : null;
}

export async function analyzeMatchScreenshot(params: {
  imageBase64: string;
  imageMimeType: string;
  players: Player[];
  caption?: string;
  senderTelegramUsername?: string;
  senderDisplayName?: string;
}): Promise<AnalyzedMatchScreenshot> {
  const {
    imageBase64,
    imageMimeType,
    players,
    caption,
    senderTelegramUsername,
    senderDisplayName,
  } = params;

  const rosterSummary = players
    .map(
      (p, idx) =>
        `${idx + 1}. username="${p.user}", clubName="${p.team}", telegram="${
          p.telegramUsername || 'none'
        }"`
    )
    .join('\n');

  const parts: any[] = [
    {
      text: `You are an expert eFootball esports referee & match-screenshot verifier.
Inspect the FIRST attached image (the Telegram group screenshot posted by a player) and compare it against the registered tournament players list and their club logos attached after it.

CRITICAL INSTRUCTIONS:
1. First decide if the screenshot is an eFootball match result screen (e.g., "Match History" list/card showing two teams and final score, "Full Time" match stats screen showing two clubs/badges and score, or final match scoreboard). If it is a random chat image, selfie, meme, or does not show a completed match score between two sides, set isMatchScreenshot=false.
2. Notice the two common eFootball screenshot styles:
   - Style A ("Match History"): Shows Left Club Logo + Club Name + eFootball username underneath, Score (e.g. "0 - 2"), Right Club Logo + Club Name + eFootball username underneath.
   - Style B ("Full Time" stats screen): Shows Left Club Name + Score + Right Club Name at top, "Full Time" label, and Left Club Logo + Right Club Logo beside the match statistics table (usernames may NOT appear in Style B — you MUST match by Club Logo and/or Club Name!).
3. Match BOTH the Left/Home side and Right/Away side to exact registered players from the roster below by comparing:
   - Visual similarity of each club logo in the screenshot against the attached registered player club logo images,
   - Club Name similarity (e.g. "Como Ethiopia", "Manchester United", "Visça Barça", etc.), and
   - eFootball username / Telegram handle if visible in the image or embedded in the club name.
4. For matchedHomeUser and matchedAwayUser, output the EXACT "username" string from the Registered Roster below (or "" if a side does not match any player in the roster). Do NOT invent usernames not in the roster.

REGISTERED TOURNAMENT ROSTER:
${rosterSummary}

Telegram post context:
- Caption: ${caption ? `"${caption}"` : 'none'}
- Telegram sender: ${senderTelegramUsername ? `@${senderTelegramUsername}` : senderDisplayName || 'unknown'}

Here is the posted match screenshot to verify:`,
    },
    {
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    },
  ];

  // Attach up to 20 player club logo references so Gemini can visually match club crests
  const playersWithLogos = await Promise.all(
    players.slice(0, 20).map(async (p) => ({
      player: p,
      img: await resolveAvatarAsInlineData(p.avatarUrl),
    }))
  );

  const attachedLogos = playersWithLogos.filter((x) => x.img !== null);
  if (attachedLogos.length > 0) {
    parts.push({
      text: 'Registered players club logos for visual crest matching:',
    });
    for (const item of attachedLogos) {
      parts.push({
        text: `Logo for username="${item.player.user}" (clubName="${item.player.team}"):`,
      });
      parts.push({
        inlineData: {
          mimeType: item.img!.mimeType,
          data: item.img!.data,
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isMatchScreenshot: {
            type: Type.BOOLEAN,
            description: 'True only if image is a valid eFootball completed match score screenshot.',
          },
          homeTeamName: { type: Type.STRING },
          homeUsername: { type: Type.STRING },
          homeLogoDescription: { type: Type.STRING },
          awayTeamName: { type: Type.STRING },
          awayUsername: { type: Type.STRING },
          awayLogoDescription: { type: Type.STRING },
          homeScore: { type: Type.INTEGER },
          awayScore: { type: Type.INTEGER },
          hasPenaltyShootout: { type: Type.BOOLEAN },
          penaltyHomeScore: { type: Type.INTEGER, nullable: true },
          penaltyAwayScore: { type: Type.INTEGER, nullable: true },
          matchedHomeUser: {
            type: Type.STRING,
            description: 'Exact player username from roster matching left/home side, or empty string.',
          },
          matchedAwayUser: {
            type: Type.STRING,
            description: 'Exact player username from roster matching right/away side, or empty string.',
          },
          confidence: {
            type: Type.INTEGER,
            description: 'Confidence score from 0 to 100.',
          },
          matchReasoning: {
            type: Type.STRING,
            description: 'Brief note explaining how logos/names/usernames were matched.',
          },
        },
        required: [
          'isMatchScreenshot',
          'homeTeamName',
          'homeUsername',
          'awayTeamName',
          'awayUsername',
          'homeScore',
          'awayScore',
          'hasPenaltyShootout',
          'matchedHomeUser',
          'matchedAwayUser',
          'confidence',
          'matchReasoning',
        ],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as AnalyzedMatchScreenshot;
  return parsed;
}

export interface FixtureResolution {
  status: 'matched_unplayed' | 'already_recorded' | 'players_not_matched' | 'no_scheduled_fixture';
  homePlayer?: Player | null;
  awayPlayer?: Player | null;
  fixture?: Fixture;
  existingResult?: MatchResult;
  normalizedHomeScore?: number;
  normalizedAwayScore?: number;
  penaltyWinner?: string;
  penaltyHomeScore?: number;
  penaltyAwayScore?: number;
}

export function resolveScheduledFixtureForScreenshot(params: {
  analysis: AnalyzedMatchScreenshot;
  players: Player[];
  fixtures: Fixture[];
  results: MatchResult[];
  senderTelegramUsername?: string;
}): FixtureResolution {
  const { analysis, players, fixtures, results, senderTelegramUsername } = params;

  const findExactRoster = (u?: string) => {
    if (!u) return null;
    const norm = u.trim().toLowerCase();
    return players.find((p) => p.user.trim().toLowerCase() === norm) || null;
  };

  let homePlayer =
    findExactRoster(analysis.matchedHomeUser) ||
    fuzzyFindPlayer(players, [analysis.homeUsername, analysis.homeTeamName]);

  let awayPlayer =
    findExactRoster(analysis.matchedAwayUser) ||
    fuzzyFindPlayer(players, [analysis.awayUsername, analysis.awayTeamName]);

  // Prevent matching same player to both sides
  if (homePlayer && awayPlayer && homePlayer.user === awayPlayer.user) {
    awayPlayer = fuzzyFindPlayer(
      players.filter((p) => p.user !== homePlayer!.user),
      [analysis.awayUsername, analysis.awayTeamName]
    );
  }

  if (!homePlayer || !awayPlayer) {
    return {
      status: 'players_not_matched',
      homePlayer,
      awayPlayer,
    };
  }

  // Find all fixtures between these two players
  const candidateFixtures = fixtures.filter((f) => {
    const direct =
      f.home.toLowerCase() === homePlayer!.user.toLowerCase() &&
      f.away.toLowerCase() === awayPlayer!.user.toLowerCase();
    const swapped =
      f.home.toLowerCase() === awayPlayer!.user.toLowerCase() &&
      f.away.toLowerCase() === homePlayer!.user.toLowerCase();
    return direct || swapped;
  });

  if (candidateFixtures.length === 0) {
    return {
      status: 'no_scheduled_fixture',
      homePlayer,
      awayPlayer,
    };
  }

  // Separate unplayed vs already recorded
  const unplayed = candidateFixtures
    .filter((f) => !findResultForFixture(f, results))
    .sort((a, b) => a.matchday - b.matchday);

  if (unplayed.length === 0) {
    const firstPlayedFixture = candidateFixtures[0];
    return {
      status: 'already_recorded',
      homePlayer,
      awayPlayer,
      fixture: firstPlayedFixture,
      existingResult: findResultForFixture(firstPlayedFixture, results),
    };
  }

  // Prefer exact home/away orientation if both legs exist on same/early matchday
  const exactOrientation = unplayed.find(
    (f) => f.home.toLowerCase() === homePlayer!.user.toLowerCase()
  );
  const chosenFixture = exactOrientation || unplayed[0];
  const isSwapped =
    chosenFixture.home.toLowerCase() !== homePlayer.user.toLowerCase();

  const normalizedHomeScore = isSwapped ? analysis.awayScore : analysis.homeScore;
  const normalizedAwayScore = isSwapped ? analysis.homeScore : analysis.awayScore;

  let penaltyWinner: string | undefined;
  let penaltyHomeScore: number | undefined;
  let penaltyAwayScore: number | undefined;

  if (
    analysis.hasPenaltyShootout &&
    analysis.penaltyHomeScore !== null &&
    analysis.penaltyAwayScore !== null &&
    analysis.penaltyHomeScore !== undefined &&
    analysis.penaltyAwayScore !== undefined
  ) {
    penaltyHomeScore = isSwapped
      ? analysis.penaltyAwayScore
      : analysis.penaltyHomeScore;
    penaltyAwayScore = isSwapped
      ? analysis.penaltyHomeScore
      : analysis.penaltyAwayScore;

    if (penaltyHomeScore > penaltyAwayScore) {
      penaltyWinner = chosenFixture.home;
    } else if (penaltyAwayScore > penaltyHomeScore) {
      penaltyWinner = chosenFixture.away;
    }
  } else if (
    chosenFixture.isKnockout &&
    normalizedHomeScore === normalizedAwayScore &&
    senderTelegramUsername
  ) {
    // No penalty winner extracted on draw
  }

  return {
    status: 'matched_unplayed',
    homePlayer,
    awayPlayer,
    fixture: chosenFixture,
    normalizedHomeScore,
    normalizedAwayScore,
    penaltyWinner,
    penaltyHomeScore,
    penaltyAwayScore,
  };
}
