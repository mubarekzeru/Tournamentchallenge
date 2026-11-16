import fs from 'fs';
import path from 'path';
import {
  readLiveTournamentState,
  writeLiveTournamentState,
  computeServerFixtures,
  findResultForFixture,
  ServerTournamentState,
} from './firestoreBridge';
import {
  analyzeMatchScreenshot,
  resolveScheduledFixtureForScreenshot,
} from './screenshotAnalyzer';
import { generateMatchdayResultsPng } from './matchdayGraphicGenerator';
import { MatchResult } from '../src/types/tournament';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BOT_STATE_FILE = path.join(DATA_DIR, 'telegram-bot.json');

export interface TelegramBotEvent {
  id: string;
  timestamp: string;
  type:
    | 'screenshot_recorded'
    | 'screenshot_duplicate'
    | 'screenshot_unmatched'
    | 'matchday_graphic_posted'
    | 'clock_announcement'
    | 'error';
  matchday?: number;
  summary: string;
  detail?: string;
}

export interface TelegramBotState {
  groupChatId: string | number | null;
  groupChatTitle: string;
  autoPostMatchdayGraphic: boolean;
  postedMatchdays: number[];
  sentClockReminders: string[];
  lastUpdateId: number;
  processedMessageKeys: string[];
  recentEvents: TelegramBotEvent[];
}

export interface TelegramBotInfo {
  id: number;
  username: string;
  first_name: string;
}

const DEFAULT_BOT_STATE: TelegramBotState = {
  groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || null,
  groupChatTitle: '',
  autoPostMatchdayGraphic: true,
  postedMatchdays: [],
  sentClockReminders: [],
  lastUpdateId: 0,
  processedMessageKeys: [],
  recentEvents: [],
};

let botState: TelegramBotState = loadBotState();
let botInfo: TelegramBotInfo | null = null;
let pollingActive = false;
let isCheckingMatchdays = false;
let isCheckingClock = false;
let clockMonitorTimer: ReturnType<typeof setInterval> | null = null;

function getBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function loadBotState(): TelegramBotState {
  try {
    if (fs.existsSync(BOT_STATE_FILE)) {
      const raw = fs.readFileSync(BOT_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BOT_STATE,
        ...parsed,
        postedMatchdays: Array.isArray(parsed.postedMatchdays)
          ? parsed.postedMatchdays
          : [],
        sentClockReminders: Array.isArray(parsed.sentClockReminders)
          ? parsed.sentClockReminders
          : [],
        processedMessageKeys: Array.isArray(parsed.processedMessageKeys)
          ? parsed.processedMessageKeys
          : [],
        recentEvents: Array.isArray(parsed.recentEvents)
          ? parsed.recentEvents
          : [],
      };
    }
  } catch (err) {
    console.warn('Could not read telegram-bot.json:', err);
  }
  return { ...DEFAULT_BOT_STATE };
}

function saveBotState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(botState, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write telegram-bot.json:', err);
  }
}

function pushEvent(ev: Omit<TelegramBotEvent, 'id' | 'timestamp'>) {
  botState.recentEvents = [
    {
      id: `tg-ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...ev,
    },
    ...botState.recentEvents,
  ].slice(0, 25);
  saveBotState();
}

async function telegramApi<T = any>(
  method: string,
  body?: Record<string, any>,
  timeoutMs: number = 30_000
): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json()) as any;
    return json;
  } catch (err: any) {
    return { ok: false, description: err?.message || 'Telegram API network error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  const payload: Record<string, any> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (replyToMessageId) {
    payload.reply_parameters = { message_id: replyToMessageId };
  }
  const res = await telegramApi('sendMessage', payload, 15_000);
  if (!res.ok) {
    console.warn('Telegram sendMessage error:', res.description);
  }
  return Boolean(res.ok);
}

export async function sendTelegramPhoto(
  chatId: string | number,
  pngBuffer: Buffer,
  filename: string,
  caption: string
): Promise<{ ok: boolean; error?: string }> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  form.append(
    'photo',
    new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }),
    filename
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const json = (await res.json()) as any;
    if (!json.ok) {
      return { ok: false, error: json.description || 'Failed to send photo' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error sending photo' };
  } finally {
    clearTimeout(timer);
  }
}

async function downloadTelegramFile(
  fileId: string
): Promise<{ base64: string; mimeType: string } | null> {
  const token = getBotToken();
  if (!token) return null;

  const fileInfo = await telegramApi<{ file_path?: string }>('getFile', {
    file_id: fileId,
  });
  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    return null;
  }

  const filePath = fileInfo.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(fileUrl);
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const lower = filePath.toLowerCase();
  const mimeType = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
    ? 'image/webp'
    : 'image/jpeg';

  return {
    base64: buffer.toString('base64'),
    mimeType,
  };
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function checkAndDispatchCompletedMatchdays(
  providedState?: ServerTournamentState,
  options?: { forceMatchday?: number; targetChatId?: string | number }
): Promise<{ postedMatchdays: number[]; errors: string[] }> {
  if (isCheckingMatchdays && !options?.forceMatchday) {
    return { postedMatchdays: [], errors: [] };
  }
  isCheckingMatchdays = true;

  const newlyPosted: number[] = [];
  const errors: string[] = [];

  try {
    const state = providedState || (await readLiveTournamentState());
    const chatId = options?.targetChatId || botState.groupChatId;
    if (!chatId) {
      return {
        postedMatchdays: [],
        errors: ['No Telegram group chat linked yet. Send any message or screenshot in your Telegram group first.'],
      };
    }

    if (!options?.forceMatchday && !botState.autoPostMatchdayGraphic) {
      return { postedMatchdays: [], errors: [] };
    }

    const allFixtures = computeServerFixtures(state);
    if (allFixtures.length === 0) {
      return { postedMatchdays: [], errors: [] };
    }

    const matchdays = Array.from(
      new Set(allFixtures.map((f) => f.matchday))
    ).sort((a, b) => a - b);

    for (const md of matchdays) {
      if (options?.forceMatchday !== undefined && options.forceMatchday !== md) {
        continue;
      }

      const mdFixtures = allFixtures.filter((f) => f.matchday === md);
      if (mdFixtures.length === 0) continue;

      const mdCompletedResults: MatchResult[] = [];
      for (const f of mdFixtures) {
        const res = findResultForFixture(f, state.results || []);
        if (res) {
          mdCompletedResults.push(res);
        }
      }

      const isMatchdayComplete = mdCompletedResults.length === mdFixtures.length;
      const alreadyPosted = botState.postedMatchdays.includes(md);

      if (!isMatchdayComplete) {
        if (options?.forceMatchday === md) {
          errors.push(
            `Matchday ${md} is not finished yet (${mdCompletedResults.length}/${mdFixtures.length} matches completed).`
          );
        }
        continue;
      }

      if (alreadyPosted && options?.forceMatchday !== md) {
        continue;
      }

      // Generate and post ONLY this single completed Matchday's PNG graphic
      const pngBuffer = await generateMatchdayResultsPng({
        matchday: md,
        fixtures: allFixtures,
        results: state.results || [],
        players: state.players || [],
      });

      const totalGoals = mdCompletedResults.reduce(
        (sum, r) => sum + (r.home_score || 0) + (r.away_score || 0),
        0
      );

      const playerMap = new Map(
        (state.players || []).map((p) => [p.user.toLowerCase(), p])
      );
      const summaryArr = mdCompletedResults.map((r) => {
        const homeName =
          playerMap.get(r.home_user.toLowerCase())?.team || r.home_user;
        const awayName =
          playerMap.get(r.away_user.toLowerCase())?.team || r.away_user;
        return `• <b>${escapeHtml(homeName)}</b> ${r.home_score} - ${r.away_score} <b>${escapeHtml(awayName)}</b>`;
      });

      const headline = `⚽ <b>የዛሬው Matchday ${md} ጨዋታ ይሄንን ይመስላል</b>\n\n🏆 <b>MATCHDAY ${md} RESULTS (${mdFixtures.length}/${mdFixtures.length} · ${totalGoals} ጎሎች)</b>`;
      let summaryBlock = '';
      for (const line of summaryArr) {
        if (`${headline}\n${summaryBlock}\n${line}`.length <= 980) {
          summaryBlock += `${summaryBlock ? '\n' : ''}${line}`;
        } else {
          break;
        }
      }

      const caption = summaryBlock ? `${headline}\n${summaryBlock}` : headline;

      const sendRes = await sendTelegramPhoto(
        chatId,
        pngBuffer,
        `ethiopian-efootball-matchday-${md}-results.png`,
        caption
      );

      if (sendRes.ok) {
        if (!botState.postedMatchdays.includes(md)) {
          botState.postedMatchdays.push(md);
          botState.postedMatchdays.sort((a, b) => a - b);
        }
        newlyPosted.push(md);
        pushEvent({
          type: 'matchday_graphic_posted',
          matchday: md,
          summary: `Posted Matchday ${md} Results Graphic to ${botState.groupChatTitle || `Group ${chatId}`}`,
          detail: `${mdCompletedResults.length} matches · ${totalGoals} goals`,
        });
      } else {
        const msg = sendRes.error || `Failed posting Matchday ${md} graphic`;
        errors.push(msg);
        pushEvent({
          type: 'error',
          matchday: md,
          summary: `Could not post Matchday ${md} graphic`,
          detail: msg,
        });
      }
    }

    saveBotState();
  } catch (err: any) {
    errors.push(err?.message || 'Unexpected error checking matchdays');
  } finally {
    isCheckingMatchdays = false;
  }

  return { postedMatchdays: newlyPosted, errors };
}

async function handleTelegramMessage(msg: any) {
  if (!msg || !msg.chat) return;

  const chat = msg.chat;
  const isGroup =
    chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel';

  // Auto-link the Telegram group whenever the bot sees group activity
  if (isGroup) {
    const changed =
      String(botState.groupChatId || '') !== String(chat.id) ||
      (chat.title && botState.groupChatTitle !== chat.title);
    if (changed) {
      botState.groupChatId = chat.id;
      if (chat.title) botState.groupChatTitle = chat.title;
      saveBotState();
    }
  }

  const msgKey = `${chat.id}:${msg.message_id}`;
  if (botState.processedMessageKeys.includes(msgKey)) {
    return;
  }
  botState.processedMessageKeys.push(msgKey);
  if (botState.processedMessageKeys.length > 150) {
    botState.processedMessageKeys = botState.processedMessageKeys.slice(-150);
  }
  saveBotState();

  const text = (msg.text || '').trim();
  if (text.startsWith('/')) {
    const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];
    if (cmd === '/start' || cmd === '/help') {
      await sendTelegramMessage(
        chat.id,
        `⚽ <b>Ethiopian eFootball Tournament Bot Active!</b>\n\n` +
          `• Players: Post your <b>eFootball Match History</b> or <b>Full Time</b> screenshot in this group after finishing a match.\n` +
          `• I automatically match club logos, club names, and usernames to publish your score directly on the tournament website.\n` +
          `• Once all matches of a Matchday are complete, I automatically post that Matchday's official downloadable results graphic here!\n\n` +
          `Commands: /status · /matchday`,
        msg.message_id
      );
      return;
    }

    if (cmd === '/status' || cmd === '/matchday') {
      const state = await readLiveTournamentState();
      const fixtures = computeServerFixtures(state);
      const players = state.players || [];
      const results = state.results || [];
      const regOpen = !state.isRegistrationEnded && results.length === 0;

      if (regOpen) {
        await sendTelegramMessage(
          chat.id,
          `📋 <b>Registration Active</b> · ${players.length} contenders enlisted.\nUpcoming matchdays will unlock as soon as Admin ends registration.`,
          msg.message_id
        );
        return;
      }

      const matchdays = Array.from(new Set(fixtures.map((f) => f.matchday))).sort(
        (a, b) => a - b
      );
      const activeMd =
        matchdays.find((md) => {
          const mdFix = fixtures.filter((f) => f.matchday === md);
          return mdFix.some((f) => !findResultForFixture(f, results));
        }) || matchdays[matchdays.length - 1];

      if (!activeMd) {
        await sendTelegramMessage(
          chat.id,
          `⚽ No scheduled fixtures found yet (${players.length} players registered).`,
          msg.message_id
        );
        return;
      }

      const mdFixtures = fixtures.filter((f) => f.matchday === activeMd);
      const playerMap = new Map(players.map((p) => [p.user.toLowerCase(), p]));
      const doneCount = mdFixtures.filter((f) =>
        Boolean(findResultForFixture(f, results))
      ).length;

      const lines = mdFixtures.map((f) => {
        const res = findResultForFixture(f, results);
        const homeName = playerMap.get(f.home.toLowerCase())?.team || f.home;
        const awayName = playerMap.get(f.away.toLowerCase())?.team || f.away;
        if (res) {
          return `✅ ${escapeHtml(homeName)} <b>${res.home_score}-${res.away_score}</b> ${escapeHtml(awayName)}`;
        }
        return `⏳ ${escapeHtml(homeName)} vs ${escapeHtml(awayName)}`;
      });

      await sendTelegramMessage(
        chat.id,
        `📅 <b>Matchday ${activeMd} Progress (${doneCount}/${mdFixtures.length} finished)</b>\n\n${lines.join('\n')}`,
        msg.message_id
      );
      return;
    }
  }

  // Check for photo OR uncompressed image document
  let fileId: string | null = null;
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    fileId = msg.photo[msg.photo.length - 1].file_id;
  } else if (
    msg.document &&
    typeof msg.document.mime_type === 'string' &&
    msg.document.mime_type.startsWith('image/')
  ) {
    fileId = msg.document.file_id;
  }

  if (!fileId) return;

  // Download image from Telegram
  const downloaded = await downloadTelegramFile(fileId);
  if (!downloaded) {
    console.warn('Could not download Telegram screenshot file:', fileId);
    return;
  }

  const state = await readLiveTournamentState();
  const players = state.players || [];
  if (players.length < 2) return;

  const senderTgUsername = msg.from?.username || undefined;
  const senderDisplayName = [msg.from?.first_name, msg.from?.last_name]
    .filter(Boolean)
    .join(' ');

  let analysis;
  try {
    analysis = await analyzeMatchScreenshot({
      imageBase64: downloaded.base64,
      imageMimeType: downloaded.mimeType,
      players,
      caption: msg.caption,
      senderTelegramUsername: senderTgUsername,
      senderDisplayName,
    });
  } catch (err: any) {
    console.error('Gemini screenshot analysis failed:', err);
    pushEvent({
      type: 'error',
      summary: 'Screenshot analysis failed',
      detail: err?.message || 'Gemini API error',
    });
    return;
  }

  if (!analysis.isMatchScreenshot) {
    // Not an eFootball match result screenshot (ignore normal chat photos silently)
    return;
  }

  const isRegOpen = !state.isRegistrationEnded && (state.results || []).length === 0;
  if (isRegOpen) {
    await sendTelegramMessage(
      chat.id,
      `⏳ <b>Registration is still open!</b>\nDetected match screenshot (<code>${escapeHtml(
        analysis.homeTeamName || 'Home'
      )} ${analysis.homeScore}-${analysis.awayScore} ${escapeHtml(
        analysis.awayTeamName || 'Away'
      )}</code>), please ask the Admin to click <b>End Registration</b> first to unlock scheduled matchdays.`,
      msg.message_id
    );
    return;
  }

  const allFixtures = computeServerFixtures(state);
  const resolution = resolveScheduledFixtureForScreenshot({
    analysis,
    players,
    fixtures: allFixtures,
    results: state.results || [],
    senderTelegramUsername: senderTgUsername,
  });

  if (resolution.status === 'already_recorded' && resolution.fixture) {
    const f = resolution.fixture;
    const ex = resolution.existingResult;
    const homeName = resolution.homePlayer?.team || f.home;
    const awayName = resolution.awayPlayer?.team || f.away;
    pushEvent({
      type: 'screenshot_duplicate',
      matchday: f.matchday,
      summary: `Duplicate screenshot skipped (MD ${f.matchday}): ${homeName} vs ${awayName}`,
      detail: ex ? `Already recorded: ${ex.home_score}-${ex.away_score}` : undefined,
    });
    await sendTelegramMessage(
      chat.id,
      `ℹ️ <b>Already Recorded (Matchday ${f.matchday})</b>\n${escapeHtml(
        homeName
      )} vs ${escapeHtml(awayName)} is already published on the website${
        ex ? ` (<b>${ex.home_score} - ${ex.away_score}</b>)` : ''
      }.`,
      msg.message_id
    );
    return;
  }

  if (
    resolution.status !== 'matched_unplayed' ||
    !resolution.fixture ||
    resolution.normalizedHomeScore === undefined ||
    resolution.normalizedAwayScore === undefined
  ) {
    const summaryText = `${analysis.homeTeamName || analysis.homeUsername || 'Unknown'} ${analysis.homeScore}-${analysis.awayScore} ${analysis.awayTeamName || analysis.awayUsername || 'Unknown'}`;
    pushEvent({
      type: 'screenshot_unmatched',
      summary: `Unmatched screenshot: ${summaryText}`,
      detail:
        resolution.status === 'no_scheduled_fixture'
          ? 'Both clubs matched roster, but no pending scheduled fixture remains between them.'
          : analysis.matchReasoning,
    });
    await sendTelegramMessage(
      chat.id,
      `⚠️ <b>Could Not Auto-Post Screenshot</b>\nRead: <b>${escapeHtml(
        analysis.homeTeamName || analysis.homeUsername || 'Left Club'
      )}</b> ${analysis.homeScore} - ${analysis.awayScore} <b>${escapeHtml(
        analysis.awayTeamName || analysis.awayUsername || 'Right Club'
      )}</b>\nReason: ${
        resolution.status === 'no_scheduled_fixture'
          ? 'No pending tournament fixture found between these two players.'
          : 'Could not match both clubs/usernames/logos to registered tournament players.'
      }`,
      msg.message_id
    );
    return;
  }

  const chosenFixture = resolution.fixture;
  const newResult: MatchResult = {
    id: `res-tg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    matchday: chosenFixture.matchday,
    home_user: chosenFixture.home,
    away_user: chosenFixture.away,
    home_score: resolution.normalizedHomeScore,
    away_score: resolution.normalizedAwayScore,
    venue: 'Telegram Verified Screenshot',
    submitted_at: new Date().toISOString(),
    stage: chosenFixture.stage,
    group: chosenFixture.group,
    isKnockout: chosenFixture.isKnockout,
    ...(resolution.penaltyWinner
      ? {
          penaltyWinner: resolution.penaltyWinner,
          penaltyHomeScore: resolution.penaltyHomeScore,
          penaltyAwayScore: resolution.penaltyAwayScore,
        }
      : {}),
  };

  const updatedResults = [newResult, ...(state.results || [])];
  const updatedState: ServerTournamentState = {
    ...state,
    results: updatedResults,
  };

  await writeLiveTournamentState(updatedState);

  const playerMap = new Map(players.map((p) => [p.user.toLowerCase(), p]));
  const homeDisplay =
    playerMap.get(chosenFixture.home.toLowerCase())?.team || chosenFixture.home;
  const awayDisplay =
    playerMap.get(chosenFixture.away.toLowerCase())?.team || chosenFixture.away;

  // Check matchday completion progress
  const mdFixtures = allFixtures.filter(
    (f) => f.matchday === chosenFixture.matchday
  );
  const mdCompletedCount = mdFixtures.filter((f) =>
    Boolean(findResultForFixture(f, updatedResults))
  ).length;

  pushEvent({
    type: 'screenshot_recorded',
    matchday: chosenFixture.matchday,
    summary: `MD ${chosenFixture.matchday}: ${homeDisplay} ${newResult.home_score}-${newResult.away_score} ${awayDisplay}`,
    detail: analysis.matchReasoning,
  });

  const penNote = newResult.penaltyWinner
    ? ` (Penalties: ${newResult.penaltyHomeScore}-${newResult.penaltyAwayScore}, Winner: @${newResult.penaltyWinner})`
    : '';

  await sendTelegramMessage(
    chat.id,
    `✅ <b>Match Result Published to Website!</b>\n\n` +
      `📅 <b>Matchday ${chosenFixture.matchday}</b>${
        chosenFixture.stage ? ` · ${escapeHtml(chosenFixture.stage)}` : ''
      }\n` +
      `⚽ <b>${escapeHtml(homeDisplay)}</b> (@${escapeHtml(chosenFixture.home)}) <b>${
        newResult.home_score
      } - ${newResult.away_score}</b> <b>${escapeHtml(awayDisplay)}</b> (@${escapeHtml(
        chosenFixture.away
      )})${escapeHtml(penNote)}\n\n` +
      `📊 Matchday ${chosenFixture.matchday} Progress: <b>${mdCompletedCount}/${mdFixtures.length}</b> matches completed`,
    msg.message_id
  );

  // If this completed ALL matches of this Matchday, auto-post that single Matchday's graphic PNG
  await checkAndDispatchCompletedMatchdays(updatedState, {
    targetChatId: chat.id,
  });
}

async function pollLoop() {
  while (pollingActive) {
    try {
      const res = await telegramApi<any[]>(
        'getUpdates',
        {
          offset: botState.lastUpdateId ? botState.lastUpdateId + 1 : undefined,
          timeout: 25,
          allowed_updates: ['message', 'my_chat_member'],
        },
        32_000
      );

      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          if (typeof update.update_id === 'number') {
            botState.lastUpdateId = Math.max(
              botState.lastUpdateId,
              update.update_id
            );
            saveBotState();
          }

          if (update.my_chat_member?.chat) {
            const c = update.my_chat_member.chat;
            if (c.type === 'group' || c.type === 'supergroup') {
              botState.groupChatId = c.id;
              if (c.title) botState.groupChatTitle = c.title;
              saveBotState();
            }
          }

          if (update.message) {
            await handleTelegramMessage(update.message);
          }
        }
      } else if (res.error_code === 409) {
        // Another poller instance temporarily conflicted; wait gracefully
        await new Promise((r) => setTimeout(r, 5000));
      } else if (!res.ok) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

function resolveClockEndDateMs(state: ServerTournamentState): {
  enabled: boolean;
  matchday: number;
  startMs: number;
  endMs: number;
} | null {
  const cc = state.clockConfig;
  if (!cc || cc.enabled === false) return null;

  const pad = (n: number) => n.toString().padStart(2, '0');
  let startDate = new Date(cc.startDate);
  let endDate = new Date(cc.endDate);

  if (isNaN(startDate.getTime())) {
    if (cc.matchDate) {
      const [sh, sm] = (cc.startTime || '21:00').split(':').map((v) => parseInt(v, 10) || 0);
      startDate = new Date(`${cc.matchDate}T${pad(sh)}:${pad(sm)}:00+03:00`);
    } else {
      startDate = new Date();
    }
  }

  // If endDate is missing or older than startDate (e.g. stale Nov 3), default to endTime || 23:00 on startDate day
  if (isNaN(endDate.getTime()) || endDate <= startDate) {
    const startEthDay = startDate.toLocaleDateString('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [eh, em] = (cc.endTime || '23:00').split(':').map((v) => parseInt(v, 10) || 0);
    endDate = new Date(`${startEthDay}T${pad(eh)}:${pad(em)}:00+03:00`);
    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 24 * 3600_000);
    }
  }

  return {
    enabled: true,
    matchday: cc.matchday || 1,
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
  };
}

export function buildAmharicHoursRemainingMessage(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.round(remainingMs / 60_000));
  let timeMention: string;
  if (totalMinutes >= 60) {
    const hoursRounded = Math.max(1, Math.round(remainingMs / 3600_000));
    timeMention = `${hoursRounded} ሰአት`;
  } else {
    timeMention = `${totalMinutes} ደቂቃ`;
  }
  return (
    `ውድ የ efootball ተወዳዳሪዎች ጨዋታው ሊጠናቀቅ ${timeMention} ነው የቀረው።\n` +
    `ያልተጫወታችሁ ካላችሁ ጨዋታችሁን አጠናቁ`
  );
}

export const AMHARIC_MATCHDAY_ENDED_MESSAGE =
  'የዛሬው የቶርናመንት ጨዋታ እዚህ ጋር አብቅቷል። ለቀጣዩ መርሃ ግብር ተዘጋጁ';

export async function checkAndDispatchClockAnnouncements(
  providedState?: ServerTournamentState,
  options?: { forceType?: 'reminder' | 'ended' }
): Promise<{ sent: string[]; error?: string }> {
  if (isCheckingClock && !options?.forceType) {
    return { sent: [] };
  }
  isCheckingClock = true;
  const sent: string[] = [];

  try {
    const state = providedState || (await readLiveTournamentState());
    const chatId = botState.groupChatId;
    if (!chatId) {
      return {
        sent: [],
        error: 'No Telegram group linked yet.',
      };
    }

    const resolved = resolveClockEndDateMs(state);
    if (!resolved) {
      if (options?.forceType === 'ended') {
        const ok = await sendTelegramMessage(chatId, AMHARIC_MATCHDAY_ENDED_MESSAGE);
        if (ok) {
          sent.push('ended_manual');
          pushEvent({
            type: 'clock_announcement',
            summary: 'Sent Amharic matchday closing notice to Telegram group',
          });
        }
        return { sent, error: ok ? undefined : 'Failed sending message to Telegram.' };
      }
      return { sent: [] };
    }

    const nowMs = Date.now();
    const { matchday, startMs, endMs } = resolved;
    const scheduleKey = `${matchday}_${new Date(endMs).toISOString()}`;
    const remainingMs = endMs - nowMs;

    if (options?.forceType === 'reminder') {
      const effectiveRemMs = remainingMs > 0 ? remainingMs : 3600_000;
      const msg = buildAmharicHoursRemainingMessage(effectiveRemMs);
      const ok = await sendTelegramMessage(chatId, msg);
      if (ok) {
        sent.push(`${scheduleKey}:manual_rem`);
        pushEvent({
          type: 'clock_announcement',
          matchday,
          summary: `Sent Amharic countdown reminder to group (MD ${matchday})`,
          detail: msg.replace('\n', ' '),
        });
      }
      return { sent, error: ok ? undefined : 'Failed sending reminder to Telegram.' };
    }

    if (options?.forceType === 'ended') {
      const ok = await sendTelegramMessage(chatId, AMHARIC_MATCHDAY_ENDED_MESSAGE);
      if (ok) {
        const key = `${scheduleKey}:ended`;
        if (!botState.sentClockReminders.includes(key)) {
          botState.sentClockReminders.push(key);
        }
        sent.push(key);
        pushEvent({
          type: 'clock_announcement',
          matchday,
          summary: `Sent Amharic Matchday ${matchday} closing announcement`,
          detail: AMHARIC_MATCHDAY_ENDED_MESSAGE,
        });
      }
      saveBotState();
      return { sent, error: ok ? undefined : 'Failed sending closing notice to Telegram.' };
    }

    // 1. Check if Matchday just ended (within last 3 hours so ancient dates don't spam on startup)
    if (nowMs >= endMs && nowMs - endMs <= 3 * 3600_000) {
      const endedKey = `${scheduleKey}:ended`;
      if (!botState.sentClockReminders.includes(endedKey)) {
        const ok = await sendTelegramMessage(chatId, AMHARIC_MATCHDAY_ENDED_MESSAGE);
        if (ok) {
          botState.sentClockReminders.push(endedKey);
          sent.push(endedKey);
          pushEvent({
            type: 'clock_announcement',
            matchday,
            summary: `Matchday ${matchday} ended — sent Amharic closing notice`,
            detail: AMHARIC_MATCHDAY_ENDED_MESSAGE,
          });
        }
      }
    } else if (remainingMs > 60_000) {
      // 2. Check whole-hour reminder milestones (3h, 2h, 1h left before deadline)
      const totalWindowMs = Math.max(0, endMs - startMs);
      const milestones = [3, 2, 1];
      for (const hr of milestones) {
        const upperMs = hr * 3600_000;
        const lowerMs = (hr - 1) * 3600_000 + 5 * 60_000; // Only send for the current active hour band

        // Skip top boundary if total matchday window is <= milestone + 10m (e.g. don't fire 2h reminder at minute 0 of a 2h window)
        if (totalWindowMs > 0 && totalWindowMs <= upperMs + 10 * 60_000 && hr >= 2) {
          continue;
        }

        if (remainingMs <= upperMs && remainingMs > lowerMs) {
          const remKey = `${scheduleKey}:rem_${hr}h`;
          if (!botState.sentClockReminders.includes(remKey)) {
            const msg = buildAmharicHoursRemainingMessage(upperMs);
            const ok = await sendTelegramMessage(chatId, msg);
            if (ok) {
              botState.sentClockReminders.push(remKey);
              sent.push(remKey);
              pushEvent({
                type: 'clock_announcement',
                matchday,
                summary: `Sent ${hr}h remaining Amharic reminder to Telegram group`,
                detail: msg.replace('\n', ' '),
              });
            }
          }
          break;
        }
      }
    }

    if (botState.sentClockReminders.length > 60) {
      botState.sentClockReminders = botState.sentClockReminders.slice(-60);
    }
    saveBotState();
    return { sent };
  } catch (err: any) {
    return { sent, error: err?.message || 'Clock monitor error' };
  } finally {
    isCheckingClock = false;
  }
}

export async function startTelegramBot() {
  const token = getBotToken();
  if (!token) {
    console.log('Telegram Bot: TELEGRAM_BOT_TOKEN not set; polling inactive.');
    return;
  }
  if (pollingActive) return;

  const meRes = await telegramApi<TelegramBotInfo>('getMe');
  if (meRes.ok && meRes.result) {
    botInfo = meRes.result;
    console.log(
      `Telegram Bot connected: @${botInfo.username} (${botInfo.first_name})`
    );
  } else {
    console.warn('Telegram Bot getMe notice:', meRes.description);
  }

  // Ensure webhook is cleared so getUpdates receives all group messages/photos
  await telegramApi('deleteWebhook', { drop_pending_updates: false });

  pollingActive = true;
  pollLoop().catch((err) => {
    console.error('Telegram poll loop stopped:', err);
    pollingActive = false;
  });

  if (!clockMonitorTimer) {
    checkAndDispatchClockAnnouncements().catch(() => {});
    checkAndDispatchCompletedMatchdays().catch(() => {});
    clockMonitorTimer = setInterval(() => {
      checkAndDispatchClockAnnouncements().catch(() => {});
      checkAndDispatchCompletedMatchdays().catch(() => {});
    }, 30_000);
  }
}

export async function getTelegramStatusSnapshot() {
  const state = await readLiveTournamentState();
  const fixtures = computeServerFixtures(state);
  const results = state.results || [];

  const matchdays = Array.from(new Set(fixtures.map((f) => f.matchday))).sort(
    (a, b) => a - b
  );

  const matchdayProgress = matchdays.map((md) => {
    const mdFix = fixtures.filter((f) => f.matchday === md);
    const done = mdFix.filter((f) =>
      Boolean(findResultForFixture(f, results))
    ).length;
    return {
      matchday: md,
      total: mdFix.length,
      completed: done,
      isComplete: mdFix.length > 0 && done === mdFix.length,
      graphicPosted: botState.postedMatchdays.includes(md),
    };
  });

  const resolvedClock = resolveClockEndDateMs(state);

  return {
    configured: Boolean(getBotToken()),
    pollingActive,
    botInfo,
    groupChatId: botState.groupChatId,
    groupChatTitle: botState.groupChatTitle,
    autoPostMatchdayGraphic: botState.autoPostMatchdayGraphic,
    postedMatchdays: botState.postedMatchdays,
    sentClockReminders: botState.sentClockReminders,
    activeDeadlineEndIso: resolvedClock ? new Date(resolvedClock.endMs).toISOString() : null,
    recentEvents: botState.recentEvents,
    matchdayProgress,
  };
}

export function updateTelegramBotConfig(updates: {
  groupChatId?: string | number | null;
  autoPostMatchdayGraphic?: boolean;
}) {
  if (updates.groupChatId !== undefined) {
    const val =
      updates.groupChatId === null || String(updates.groupChatId).trim() === ''
        ? null
        : String(updates.groupChatId).trim();
    botState.groupChatId = val;
  }
  if (typeof updates.autoPostMatchdayGraphic === 'boolean') {
    botState.autoPostMatchdayGraphic = updates.autoPostMatchdayGraphic;
  }
  saveBotState();
  return botState;
}
