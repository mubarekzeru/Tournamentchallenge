import {
  GoogleGenAI,
  Type,
  ThinkingLevel,
  FunctionDeclaration,
  Content,
} from '@google/genai';
import {
  readLiveTournamentState,
  computeServerFixtures,
  findResultForFixture,
  ServerTournamentState,
} from './firestoreBridge';
import { calculateStandings } from '../src/utils/standings';
import {
  generateMatchdayResultsPng,
  generateStandingsPng,
  generateUpcomingFixturesPng,
  generatePostponedMatchesPng,
} from './matchdayGraphicGenerator';
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  getLinkedGroupInfo,
  recordBotEvent,
  markMatchdayPosted,
  markPostponedAnnounced,
} from './telegramBot';

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantExecutedAction {
  tool: string;
  ok: boolean;
  summary: string;
  graphicPreviewBase64?: string;
  graphicType?: string;
}

export interface TelegramAssistantRequest {
  message: string;
  history?: AssistantChatMessage[];
  canBroadcast: boolean;
  senderName?: string;
  imageBase64?: string;
  imageMimeType?: string;
  replyChatId?: string | number; // Where Q&A should be contextualized if from Telegram
}

export interface TelegramAssistantResponse {
  reply: string;
  actions: AssistantExecutedAction[];
  modelUsed: string;
  usedFallback?: boolean;
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isQuotaOrRateError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate')
  );
}

function buildLiveTournamentContext(state: ServerTournamentState): {
  summaryText: string;
  activeMatchday: number;
  postponedCount: number;
} {
  const players = state.players || [];
  const results = state.results || [];
  const fixtures = computeServerFixtures(state);
  const standings = calculateStandings(players, results);
  const playerMap = new Map(players.map((p) => [p.user.toLowerCase(), p]));

  const matchdays = Array.from(new Set(fixtures.map((f) => f.matchday))).sort(
    (a, b) => a - b
  );
  const activeMatchday =
    matchdays.find((md) => {
      const mdFix = fixtures.filter((f) => f.matchday === md);
      return mdFix.some((f) => !findResultForFixture(f, results));
    }) ||
    matchdays[matchdays.length - 1] ||
    1;

  const activeFixtures = fixtures.filter((f) => f.matchday === activeMatchday);
  const activeLines = activeFixtures.map((f) => {
    const res = findResultForFixture(f, results);
    const homeTeam = playerMap.get(f.home.toLowerCase())?.team || f.home;
    const awayTeam = playerMap.get(f.away.toLowerCase())?.team || f.away;
    const ppd = results.find(
      (r) =>
        r.isPostponed &&
        r.matchday === f.matchday &&
        ((r.home_user.toLowerCase() === f.home.toLowerCase() &&
          r.away_user.toLowerCase() === f.away.toLowerCase()) ||
          (r.home_user.toLowerCase() === f.away.toLowerCase() &&
            r.away_user.toLowerCase() === f.home.toLowerCase()))
    );
    if (res) {
      return `- [DONE] ${homeTeam} (@${f.home}) ${res.home_score}-${res.away_score} ${awayTeam} (@${f.away})`;
    }
    if (ppd) {
      return `- [POSTPONED] ${homeTeam} (@${f.home}) vs ${awayTeam} (@${f.away})${
        ppd.postponedReason ? ` (Reason: ${ppd.postponedReason})` : ''
      }`;
    }
    return `- [PENDING] ${homeTeam} (@${f.home}) vs ${awayTeam} (@${f.away})`;
  });

  const standingsLines = standings
    .slice(0, 15)
    .map(
      (p) =>
        `${p.rank}. ${p.team} (@${p.user}) — P:${p.played} W:${p.w} D:${p.d} L:${p.l} GD:${
          p.gd >= 0 ? `+${p.gd}` : p.gd
        } PTS:${p.points}`
    );

  const postponedList = results.filter((r) => Boolean(r.isPostponed));
  const postponedLines = postponedList.map((r) => {
    const h = playerMap.get(r.home_user.toLowerCase())?.team || r.home_user;
    const a = playerMap.get(r.away_user.toLowerCase())?.team || r.away_user;
    return `- MD ${r.matchday}: ${h} (@${r.home_user}) vs ${a} (@${r.away_user})${
      r.postponedReason ? ` | Reason: ${r.postponedReason}` : ''
    }${r.rescheduledMatchday ? ` | Rescheduled to MD ${r.rescheduledMatchday}` : ''}`;
  });

  const recentResults = results
    .filter((r) => !r.isPostponed)
    .slice(0, 8)
    .map((r) => {
      const h = playerMap.get(r.home_user.toLowerCase())?.team || r.home_user;
      const a = playerMap.get(r.away_user.toLowerCase())?.team || r.away_user;
      return `- MD ${r.matchday}: ${h} ${r.home_score}-${r.away_score} ${a}`;
    });

  const cc = state.clockConfig;
  const clockSummary = cc?.enabled
    ? `Active Clock: Matchday ${cc.matchday || activeMatchday}, Start: ${
        cc.startTime || 'N/A'
      }, Due/End: ${cc.endTime || '23:00'}, EndISO: ${cc.endDate}`
    : 'Clock Banner: Not active';

  const groupInfo = getLinkedGroupInfo();

  const summaryText = [
    `TOURNAMENT SNAPSHOT (ETHIOPIAN eFOOTBALL CHAMPIONSHIP):`,
    `- Format: ${state.tournamentFormat || 'league_single'} | Registration Ended: ${Boolean(
      state.isRegistrationEnded
    )}`,
    `- Players Registered: ${players.length} | Total Fixtures: ${fixtures.length} | Total Matchdays: ${matchdays.length}`,
    `- Linked Telegram Group: ${
      groupInfo.groupChatId
        ? `${groupInfo.groupChatTitle || 'Linked Group'} (${groupInfo.groupChatId})`
        : 'Not linked yet'
    }`,
    `- ${clockSummary}`,
    `\nSTANDINGS (TOP ${standingsLines.length}):\n${standingsLines.join('\n') || 'None'}`,
    `\nCURRENT / ACTIVE MATCHDAY ${activeMatchday} FIXTURES:\n${activeLines.join('\n') || 'None'}`,
    `\nPOSTPONED MATCHES (${postponedList.length}):\n${postponedLines.join('\n') || 'None'}`,
    `\nRECENT VERIFIED RESULTS:\n${recentResults.join('\n') || 'None'}`,
  ].join('\n');

  return {
    summaryText,
    activeMatchday,
    postponedCount: postponedList.length,
  };
}

const POST_NEWS_DECL: FunctionDeclaration = {
  name: 'post_tournament_news',
  description:
    'Posts official tournament news, announcements, or reminders directly into the linked Telegram tournament group.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      headline: {
        type: Type.STRING,
        description:
          'Short bold headline for the news announcement (in Amharic or English matching the request).',
      },
      message: {
        type: Type.STRING,
        description:
          'Clear formatted body text of the news or announcement to send to players in the Telegram group.',
      },
    },
    required: ['headline', 'message'],
  },
};

const POST_GRAPHIC_DECL: FunctionDeclaration = {
  name: 'post_website_graphic',
  description:
    'Generates an official PNG graphic photo from the tournament website (matchday_results, standings, upcoming_fixtures, or postponed_matches) — or sends the admin-attached website PNG image (attached_image) — to the linked Telegram tournament group.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      graphicType: {
        type: Type.STRING,
        description:
          'Which graphic to post: "matchday_results" (single matchday result poster), "standings" (league table graphic), "upcoming_fixtures" (matchday schedule graphic), "postponed_matches" (postponed match notice card), or "attached_image" (if the user attached an image).',
        enum: [
          'matchday_results',
          'standings',
          'upcoming_fixtures',
          'postponed_matches',
          'attached_image',
        ],
      },
      matchday: {
        type: Type.INTEGER,
        description:
          'Optional Matchday number when graphicType is matchday_results or upcoming_fixtures.',
      },
      caption: {
        type: Type.STRING,
        description:
          'Amharic or English caption to send with the graphic photo in the Telegram group.',
      },
    },
    required: ['graphicType', 'caption'],
  },
};

const POST_POSTPONED_DECL: FunctionDeclaration = {
  name: 'post_postponed_matches',
  description:
    'Posts an official postponed match notification (and PNG card) to the linked Telegram tournament group covering all currently postponed matches (isPostponed: true) or a custom postponement note.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customNote: {
        type: Type.STRING,
        description:
          'Optional custom Amharic or English message explaining which match was postponed, the reason, or rescheduled time.',
      },
      includeGraphic: {
        type: Type.BOOLEAN,
        description:
          'Whether to generate and attach the Postponed Matches PNG graphic card (defaults to true).',
      },
    },
  },
};

async function executeAssistantTool(
  name: string,
  args: Record<string, any>,
  state: ServerTournamentState,
  req: TelegramAssistantRequest
): Promise<{ resultPayload: Record<string, any>; actionRecord: AssistantExecutedAction }> {
  const groupInfo = getLinkedGroupInfo();
  const chatId = groupInfo.groupChatId;

  if (!req.canBroadcast) {
    return {
      resultPayload: {
        ok: false,
        error: 'Permission denied: only Tournament Administrators can post announcements or graphics to the group.',
      },
      actionRecord: {
        tool: name,
        ok: false,
        summary: 'Broadcast blocked (Admin permission required)',
      },
    };
  }

  if (!chatId) {
    return {
      resultPayload: {
        ok: false,
        error: 'No Telegram group is linked yet. Link your Telegram group in the Bot Panel or send a message in the group first.',
      },
      actionRecord: {
        tool: name,
        ok: false,
        summary: 'No Telegram group linked',
      },
    };
  }

  if (name === 'post_tournament_news') {
    const headline = String(args.headline || 'Official Tournament Update').trim();
    const body = String(args.message || '').trim();
    if (!body) {
      return {
        resultPayload: { ok: false, error: 'News message body is empty.' },
        actionRecord: { tool: name, ok: false, summary: 'Empty news body' },
      };
    }

    const formatted = `📢 <b>${escapeHtml(headline)}</b>\n\n${escapeHtml(body)}`;
    const sent = await sendTelegramMessage(chatId, formatted);
    if (sent) {
      recordBotEvent({
        type: 'clock_announcement',
        summary: `AI Assistant posted news: ${headline}`,
        detail: body.slice(0, 140),
      });
    }
    return {
      resultPayload: {
        ok: sent,
        groupTitle: groupInfo.groupChatTitle || String(chatId),
        headline,
      },
      actionRecord: {
        tool: name,
        ok: sent,
        summary: sent
          ? `Posted news "${headline}" to ${groupInfo.groupChatTitle || 'Telegram group'}`
          : 'Telegram API failed sending news message',
      },
    };
  }

  if (name === 'post_website_graphic') {
    const graphicType = String(args.graphicType || 'standings');
    const captionRaw = String(args.caption || '').trim();
    const fixtures = computeServerFixtures(state);
    const results = state.results || [];
    const players = state.players || [];

    let pngBuffer: Buffer;
    let filename = 'ethiopian-efootball-graphic.png';
    let defaultCaption = '📊 Ethiopian eFootball Official Graphic';
    let postedMd: number | undefined;

    if (graphicType === 'attached_image') {
      if (!req.imageBase64) {
        return {
          resultPayload: {
            ok: false,
            error: 'No attached image found in this request. Ask the user to attach or select a graphic type (standings, matchday_results, upcoming_fixtures, postponed_matches).',
          },
          actionRecord: {
            tool: name,
            ok: false,
            summary: 'No attached image provided',
          },
        };
      }
      const cleanBase64 = req.imageBase64.includes(',')
        ? req.imageBase64.split(',')[1]
        : req.imageBase64;
      pngBuffer = Buffer.from(cleanBase64, 'base64');
      filename = 'efootball-website-graphic.png';
      defaultCaption = '📸 Ethiopian eFootball Official Graphic';
    } else if (graphicType === 'matchday_results') {
      const matchdays = Array.from(new Set(fixtures.map((f) => f.matchday))).sort(
        (a, b) => a - b
      );
      let md = Number(args.matchday);
      if (!Number.isFinite(md) || md < 1) {
        // Pick latest matchday that has results, or 1
        const completedMds = matchdays.filter((m) =>
          results.some((r) => !r.isPostponed && r.matchday === m)
        );
        md = completedMds[completedMds.length - 1] || matchdays[0] || 1;
      }
      postedMd = md;
      pngBuffer = await generateMatchdayResultsPng({
        matchday: md,
        fixtures,
        results,
        players,
      });
      filename = `ethiopian-efootball-matchday-${md}-results.png`;
      defaultCaption = `⚽ የዛሬው Matchday ${md} ጨዋታ ይሄንን ይመስላል`;
    } else if (graphicType === 'upcoming_fixtures') {
      const mdArg = Number(args.matchday);
      const generated = await generateUpcomingFixturesPng({
        matchday: Number.isFinite(mdArg) && mdArg > 0 ? mdArg : undefined,
        fixtures,
        results,
        players,
        clockConfig: state.clockConfig,
      });
      pngBuffer = generated.buffer;
      postedMd = generated.matchday;
      filename = `ethiopian-efootball-matchday-${generated.matchday}-schedule.png`;
      defaultCaption = `📅 የ Matchday ${generated.matchday} ቀጣይ ጨዋታዎች መርሃ ግብር`;
    } else if (graphicType === 'postponed_matches') {
      const generated = await generatePostponedMatchesPng({
        results,
        players,
      });
      pngBuffer = generated.buffer;
      filename = 'ethiopian-efootball-postponed-matches.png';
      defaultCaption = `⏳ የተራዘሙ የቶርናመንት ጨዋታዎች ማሳሰቢያ`;
    } else {
      pngBuffer = await generateStandingsPng({
        players,
        results,
      });
      filename = 'ethiopian-efootball-standings.png';
      defaultCaption = '🏆 የኢትዮጵያ eFootball ቶርናመንት የደረጃ ሰንጠረዥ';
    }

    const safeCaption = escapeHtml(captionRaw || defaultCaption).slice(0, 1000);
    const sendRes = await sendTelegramPhoto(chatId, pngBuffer, filename, safeCaption);

    if (sendRes.ok) {
      if (graphicType === 'matchday_results' && postedMd) {
        markMatchdayPosted(postedMd);
      }
      recordBotEvent({
        type: 'matchday_graphic_posted',
        matchday: postedMd,
        summary: `AI Assistant posted ${graphicType} graphic to ${
          groupInfo.groupChatTitle || 'Telegram group'
        }`,
        detail: safeCaption.slice(0, 120),
      });
    }

    return {
      resultPayload: {
        ok: sendRes.ok,
        error: sendRes.error,
        graphicType,
        matchday: postedMd,
        groupTitle: groupInfo.groupChatTitle || String(chatId),
      },
      actionRecord: {
        tool: name,
        ok: sendRes.ok,
        graphicType,
        graphicPreviewBase64: `data:image/png;base64,${pngBuffer.toString('base64')}`,
        summary: sendRes.ok
          ? `Posted ${graphicType} PNG graphic${
              postedMd ? ` (MD ${postedMd})` : ''
            } to Telegram group`
          : `Failed posting ${graphicType}: ${sendRes.error}`,
      },
    };
  }

  if (name === 'post_postponed_matches') {
    const results = state.results || [];
    const players = state.players || [];
    const postponed = results.filter((r) => Boolean(r.isPostponed));
    const playerMap = new Map(players.map((p) => [p.user.toLowerCase(), p]));
    const customNote = String(args.customNote || '').trim();
    const includeGraphic = args.includeGraphic !== false;

    if (postponed.length === 0 && !customNote) {
      return {
        resultPayload: {
          ok: false,
          error:
            'There are currently 0 postponed matches marked in the tournament database, and no custom postponement note was provided.',
        },
        actionRecord: {
          tool: name,
          ok: false,
          summary: 'No postponed matches found to announce',
        },
      };
    }

    const lines = postponed.map((r) => {
      const h = playerMap.get(r.home_user.toLowerCase())?.team || r.home_user;
      const a = playerMap.get(r.away_user.toLowerCase())?.team || r.away_user;
      const reason = r.postponedReason ? ` (${r.postponedReason})` : '';
      const resched = r.rescheduledMatchday
        ? ` → ወደ Matchday ${r.rescheduledMatchday} ተዛውሯል`
        : '';
      return `• MD ${r.matchday}: ${h} (@${r.home_user}) vs ${a} (@${r.away_user})${reason}${resched}`;
    });

    const header = '⏳ <b>የተራዘመ ጨዋታ ማሳሰቢያ / Postponed Match Advisory</b>';
    const bodyParts: string[] = [];
    if (customNote) bodyParts.push(escapeHtml(customNote));
    if (lines.length > 0) {
      bodyParts.push(escapeHtml(lines.join('\n')));
    }
    const textMsg = `${header}\n\n${bodyParts.join('\n\n')}`;

    let ok = false;
    let previewBase64: string | undefined;

    if (includeGraphic && postponed.length > 0) {
      const { buffer } = await generatePostponedMatchesPng({ results, players });
      previewBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
      const photoRes = await sendTelegramPhoto(
        chatId,
        buffer,
        'ethiopian-efootball-postponed-matches.png',
        textMsg.slice(0, 1000)
      );
      ok = photoRes.ok;
    } else {
      ok = await sendTelegramMessage(chatId, textMsg);
    }

    if (ok) {
      if (postponed.length > 0) {
        markPostponedAnnounced(postponed.map((r) => r.id));
      }
      recordBotEvent({
        type: 'clock_announcement',
        summary: `AI Assistant posted postponed match advisory (${postponed.length} match${
          postponed.length === 1 ? '' : 'es'
        })`,
        detail: customNote || lines[0],
      });
    }

    return {
      resultPayload: {
        ok,
        postponedCount: postponed.length,
        groupTitle: groupInfo.groupChatTitle || String(chatId),
      },
      actionRecord: {
        tool: name,
        ok,
        graphicType: previewBase64 ? 'postponed_matches' : undefined,
        graphicPreviewBase64: previewBase64,
        summary: ok
          ? `Posted postponed match notice (${postponed.length} postponed) to Telegram group`
          : 'Failed posting postponed match notice',
      },
    };
  }

  return {
    resultPayload: { ok: false, error: `Unknown tool: ${name}` },
    actionRecord: { tool: name, ok: false, summary: `Unknown tool ${name}` },
  };
}

async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: Content[];
    systemInstruction: string;
    tools?: Array<{ functionDeclarations: FunctionDeclaration[] }>;
  }
): Promise<{ response: any; modelUsed: string }> {
  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastErr: any = null;

  for (const model of modelsToTry) {
    try {
      const config: Record<string, any> = {
        systemInstruction: params.systemInstruction,
        temperature: 0.3,
      };
      if (model === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      if (params.tools && params.tools.length > 0) {
        config.tools = params.tools;
      }

      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config,
      });
      return { response, modelUsed: model };
    } catch (err: any) {
      lastErr = err;
      if (!isQuotaOrRateError(err)) {
        // Also retry second model on transient errors, only break if fatal auth
        if (String(err?.message || '').includes('API_KEY_INVALID')) {
          throw err;
        }
      }
    }
  }

  throw lastErr || new Error('Gemini API request failed');
}

async function deterministicFallbackAssistant(
  req: TelegramAssistantRequest,
  state: ServerTournamentState
): Promise<TelegramAssistantResponse> {
  const msgLower = (req.message || '').toLowerCase();
  const { activeMatchday, postponedCount } = buildLiveTournamentContext(state);
  const actions: AssistantExecutedAction[] = [];

  // Direct image upload from Admin when quota is tight
  if (req.canBroadcast && req.imageBase64) {
    const caption = req.message?.trim() || '📸 የኢትዮጵያ eFootball ቶርናመንት መረጃ';
    const exec = await executeAssistantTool(
      'post_website_graphic',
      { graphicType: 'attached_image', caption },
      state,
      req
    );
    actions.push(exec.actionRecord);
    return {
      reply: exec.actionRecord.ok
        ? 'ፎቶው እና መልእክቱ ወደ Telegram ግሩፕ በተሳካ ሁኔታ ተልኳል።'
        : `ፎቶውን መላክ አልተቻለም: ${exec.actionRecord.summary}`,
      actions,
      modelUsed: 'fallback-direct',
      usedFallback: true,
    };
  }

  // Standings graphic request
  if (
    req.canBroadcast &&
    (msgLower.includes('standings') ||
      msgLower.includes('table') ||
      msgLower.includes('ሰንጠረዥ') ||
      msgLower.includes('ደረጃ')) &&
    (msgLower.includes('post') ||
      msgLower.includes('send') ||
      msgLower.includes('ፖስት') ||
      msgLower.includes('ላክ'))
  ) {
    const exec = await executeAssistantTool(
      'post_website_graphic',
      {
        graphicType: 'standings',
        caption: '🏆 የኢትዮጵያ eFootball ቶርናመንት የደረጃ ሰንጠረዥ',
      },
      state,
      req
    );
    actions.push(exec.actionRecord);
    return {
      reply: exec.actionRecord.ok
        ? 'የደረጃ ሰንጠረዥ ግራፊክ ፎቶው ወደ Telegram ግሩፕ ፖስት ተደርጓል!'
        : `መላክ አልተቻለም: ${exec.actionRecord.summary}`,
      actions,
      modelUsed: 'fallback-direct',
      usedFallback: true,
    };
  }

  // Postponed matches request
  if (
    req.canBroadcast &&
    (msgLower.includes('postponed') || msgLower.includes('ተራዝም') || msgLower.includes('የተራዘመ')) &&
    (msgLower.includes('post') ||
      msgLower.includes('send') ||
      msgLower.includes('ፖስት') ||
      msgLower.includes('ላክ'))
  ) {
    const exec = await executeAssistantTool(
      'post_postponed_matches',
      { includeGraphic: true },
      state,
      req
    );
    actions.push(exec.actionRecord);
    return {
      reply: exec.actionRecord.ok
        ? `የተራዘሙ ጨዋታዎች ማሳሰቢያ (${postponedCount}) ወደ ግሩፑ ፖስት ተደርጓል።`
        : `የተራዘመ ጨዋታ መረጃ መላክ አልተቻለም: ${exec.actionRecord.summary}`,
      actions,
      modelUsed: 'fallback-direct',
      usedFallback: true,
    };
  }

  // Upcoming fixtures graphic request
  if (
    req.canBroadcast &&
    (msgLower.includes('upcoming') ||
      msgLower.includes('fixture') ||
      msgLower.includes('schedule') ||
      msgLower.includes('ቀጣይ') ||
      msgLower.includes('መርሃ')) &&
    (msgLower.includes('post') ||
      msgLower.includes('send') ||
      msgLower.includes('ፖስት') ||
      msgLower.includes('ላክ'))
  ) {
    const exec = await executeAssistantTool(
      'post_website_graphic',
      {
        graphicType: 'upcoming_fixtures',
        matchday: activeMatchday,
        caption: `📅 የ Matchday ${activeMatchday} ጨዋታዎች መርሃ ግብር`,
      },
      state,
      req
    );
    actions.push(exec.actionRecord);
    return {
      reply: exec.actionRecord.ok
        ? `የ Matchday ${activeMatchday} ጨዋታዎች ግራፊክ ፎቶ ወደ ግሩፑ ፖስት ተደርጓል።`
        : `መላክ አልተቻለም: ${exec.actionRecord.summary}`,
      actions,
      modelUsed: 'fallback-direct',
      usedFallback: true,
    };
  }

  // Otherwise provide a live Amharic/English tournament briefing without failing
  const standings = calculateStandings(state.players || [], state.results || []);
  const top3 = standings
    .slice(0, 3)
    .map((p) => `${p.rank}. ${p.team} (${p.points} pts)`)
    .join(', ');
  const completedCount = (state.results || []).filter((r) => !r.isPostponed).length;

  return {
    reply:
      `⚠️ የ AI ሞዴል በጊዜያዊነት በብዛት ጥያቄ (Quota 429) ተጨናንቋል፤ ሆኖም የቀጥታ የቶርናመንት መረጃ ይሄው:\n` +
      `• አሁን ያለው Matchday: ${activeMatchday}\n` +
      `• የተመዘገቡ ተጫዋቾች: ${(state.players || []).length}\n` +
      `• የተጠናቀቁ ጨዋታዎች: ${completedCount} | የተራዘሙ: ${postponedCount}\n` +
      `• ከፍተኛ 3: ${top3 || 'ገና ውጤት የለም'}\n\n` +
      `ግራፊክ ወይም ዜና ወደ ግሩፕ ለመላክ ከታች ያሉትን ፈጣን ቁልፎች (Quick Actions) ወይም "standings post", "upcoming post", "postponed post" ብለው መጠቀም ይችላሉ።`,
    actions,
    modelUsed: 'fallback-direct',
    usedFallback: true,
  };
}

export async function runTelegramAiAssistant(
  req: TelegramAssistantRequest
): Promise<TelegramAssistantResponse> {
  const state = await readLiveTournamentState();
  const { summaryText } = buildLiveTournamentContext(state);

  const systemInstruction = [
    `You are the official AI Assistant for the Ethiopian Esports League eFootball Tournament Telegram Bot (@MetaRefereeBot).`,
    `Speak naturally and helpfully in the SAME language the user writes in (Amharic when addressed in Amharic, English when addressed in English).`,
    `Always rely strictly on the LIVE TOURNAMENT SNAPSHOT below — never invent scores, teams, players, or standings.`,
    req.canBroadcast
      ? `You are chatting with a verified Tournament Administrator. You have function tools to:
1) post_tournament_news: post news/announcements to the Telegram group when the Admin tells you new updates or news to share.
2) post_website_graphic: generate and post official website PNG graphics ('matchday_results', 'standings', 'upcoming_fixtures', 'postponed_matches', or 'attached_image' if an image was attached by the admin).
3) post_postponed_matches: post postponed match notices & PNG card to the Telegram group.
Whenever the Admin clearly asks you to post/share news, a graphic photo, or a postponed game to the group, call the appropriate tool(s) immediately, then report clearly what was posted!`
      : `You are in READ-ONLY Q&A mode for a tournament participant/viewer. Answer questions about fixtures, standings, postponed matches, matchdays, and deadlines accurately. Do NOT promise to broadcast messages to the group since only Admins can broadcast.`,
    req.imageBase64
      ? `NOTE: The user has attached an image/graphic with this message. If they ask to post or share this photo to the group, call post_website_graphic with graphicType="attached_image".`
      : '',
    `\n${summaryText}`,
  ]
    .filter(Boolean)
    .join('\n');

  const historyContents: Content[] = (req.history || [])
    .slice(-8)
    .map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    }));

  const currentParts: any[] = [];
  if (req.imageBase64) {
    const cleanBase64 = req.imageBase64.includes(',')
      ? req.imageBase64.split(',')[1]
      : req.imageBase64;
    currentParts.push({
      inlineData: {
        mimeType: req.imageMimeType || 'image/png',
        data: cleanBase64,
      },
    });
  }
  currentParts.push({
    text: req.senderName
      ? `[From ${req.senderName}]: ${req.message}`
      : req.message,
  });

  const contents: Content[] = [
    ...historyContents,
    { role: 'user', parts: currentParts },
  ];

  const tools = req.canBroadcast
    ? [
        {
          functionDeclarations: [
            POST_NEWS_DECL,
            POST_GRAPHIC_DECL,
            POST_POSTPONED_DECL,
          ],
        },
      ]
    : undefined;

  const actions: AssistantExecutedAction[] = [];

  try {
    const ai = getAiClient();
    const { response: firstRes, modelUsed } = await generateWithFallback(ai, {
      contents,
      systemInstruction,
      tools,
    });

    const functionCalls = firstRes.functionCalls;
    if (functionCalls && functionCalls.length > 0 && req.canBroadcast) {
      const modelContent = firstRes.candidates?.[0]?.content;
      const fnResponseParts: any[] = [];

      for (const call of functionCalls) {
        const { resultPayload, actionRecord } = await executeAssistantTool(
          call.name,
          (call.args || {}) as Record<string, any>,
          state,
          req
        );
        actions.push(actionRecord);
        fnResponseParts.push({
          functionResponse: {
            name: call.name,
            response: resultPayload,
          },
        });
      }

      const followUpContents: Content[] = [
        ...contents,
        ...(modelContent ? [modelContent] : []),
        { role: 'user', parts: fnResponseParts },
      ];

      const { response: finalRes } = await generateWithFallback(ai, {
        contents: followUpContents,
        systemInstruction,
        tools,
      });

      return {
        reply:
          finalRes.text?.trim() ||
          actions.map((a) => `• ${a.summary}`).join('\n'),
        actions,
        modelUsed,
      };
    }

    return {
      reply:
        firstRes.text?.trim() ||
        'ይቅርታ፣ ምላሽ ማመንጨት አልተቻለም። እባክዎ ጥያቄዎን በድጋሚ ይሞክሩ።',
      actions,
      modelUsed,
    };
  } catch (err: any) {
    if (isQuotaOrRateError(err)) {
      return deterministicFallbackAssistant(req, state);
    }
    throw err;
  }
}
