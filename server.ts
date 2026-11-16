import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  readLiveTournamentState,
  computeServerFixtures,
  ServerTournamentState,
} from './server/firestoreBridge';
import { generateMatchdayResultsPng } from './server/matchdayGraphicGenerator';
import {
  startTelegramBot,
  checkAndDispatchCompletedMatchdays,
  checkAndDispatchClockAnnouncements,
  getTelegramStatusSnapshot,
  updateTelegramBotConfig,
} from './server/telegramBot';

dotenv.config();

const app = express();
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Support JSON payloads up to 25MB for avatars and tournament data
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'tournament.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadTournamentData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.players)) {
        const teamMap: Record<string, string> = {
          BIL: 'Bilal FC',
          AMN: 'Aman United',
          MAMD: 'Madridistas',
          TFK: 'Teshale Kings',
          ISC: 'Isaac Stars',
          MBK: 'Muby All-Stars',
          YONS: 'Yonas Warriors',
        };
        let changed = false;
        parsed.players = parsed.players.map((p: any) => {
          if (teamMap[p.team]) {
            p.team = teamMap[p.team];
            changed = true;
          }
          if (p.subtitle !== undefined) {
            delete p.subtitle;
            changed = true;
          }
          return p;
        });
        if (changed) {
          saveTournamentData(parsed);
        }
      }
      return parsed;
    } catch (e) {
      console.error('Error reading tournament data file:', e);
    }
  }
  return null;
}

function saveTournamentData(data: unknown) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving tournament data:', e);
    return false;
  }
}

const DEFAULT_ADMIN_PASSCODE = "-]MK3kMJPdLn]!1mX=81lbx";
const TWO_STEP_MASTER_KEY = "QurwyG{0P]}cuYX5dB[0f4X{PV59AtXbYhq2]ryL~9Nvm2]I7R";

// GET current tournament data (accessible by anyone visiting)
app.get('/api/tournament', (_req, res) => {
  const data = loadTournamentData();
  res.json({
    success: true,
    data: data || null,
  });
});

// GET current admin passcode
app.get('/api/admin/password', (_req, res) => {
  const data = loadTournamentData();
  res.json({
    success: true,
    passcode: data?.adminPasscode || DEFAULT_ADMIN_PASSCODE,
  });
});

// POST change admin password with 2-step verification master key
app.post('/api/admin/change-password', (req, res) => {
  const { twoStepKey, newPasscode } = req.body;
  if (!twoStepKey || twoStepKey.trim() !== TWO_STEP_MASTER_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid 2-step verification master key. Password change rejected.',
    });
  }

  if (!newPasscode || newPasscode.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'New passcode cannot be empty.',
    });
  }

  const existingData = loadTournamentData();
  const data = existingData || { players: [], results: [] };
  data.adminPasscode = newPasscode.trim();
  data.updatedAt = new Date().toISOString();
  saveTournamentData(data);

  res.json({
    success: true,
    message: 'Administrator password updated successfully.',
    passcode: data.adminPasscode,
  });
});

// POST update tournament data (players, profile pictures, results, registration & schedule config)
app.post('/api/tournament', (req, res) => {
  const {
    players,
    results,
    adminPasscode,
    tournamentFormat,
    groupStageConfig,
    clockConfig,
    isRegistrationEnded,
  } = req.body;
  if (!players || !results) {
    return res.status(400).json({ success: false, error: 'Missing players or results' });
  }

  const existingData = loadTournamentData();
  const payload: Record<string, any> = {
    players,
    results,
    adminPasscode: adminPasscode || existingData?.adminPasscode || DEFAULT_ADMIN_PASSCODE,
    updatedAt: new Date().toISOString(),
  };

  if (tournamentFormat !== undefined) {
    payload.tournamentFormat = tournamentFormat;
  } else if (existingData?.tournamentFormat !== undefined) {
    payload.tournamentFormat = existingData.tournamentFormat;
  }

  if (groupStageConfig !== undefined) {
    payload.groupStageConfig = groupStageConfig;
  } else if (existingData?.groupStageConfig !== undefined) {
    payload.groupStageConfig = existingData.groupStageConfig;
  }

  if (clockConfig !== undefined) {
    payload.clockConfig = clockConfig;
  } else if (existingData?.clockConfig !== undefined) {
    payload.clockConfig = existingData.clockConfig;
  }

  if (typeof isRegistrationEnded === 'boolean') {
    payload.isRegistrationEnded = isRegistrationEnded;
  } else if (typeof existingData?.isRegistrationEnded === 'boolean') {
    payload.isRegistrationEnded = existingData.isRegistrationEnded;
  }

  const saved = saveTournamentData(payload);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'Could not write to storage' });
  }

  // Asynchronously check if any Matchday just became 100% completed or clock notice due
  checkAndDispatchCompletedMatchdays(payload as ServerTournamentState).catch((err) => {
    console.warn('Telegram matchday check after update skipped/failed:', err);
  });
  checkAndDispatchClockAnnouncements(payload as ServerTournamentState).catch(() => {});

  res.json({ success: true, data: payload });
});

// Reset tournament data
app.post('/api/tournament/reset', (_req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    res.json({ success: true, message: 'Tournament data reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not reset tournament data' });
  }
});

// AI Intelligence & Tactics Scout grounded with live Google Search
app.post('/api/ai/scout', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    const fullPrompt = context
      ? `You are an expert eFootball esports intelligence analyst and tactics scout for the Ethiopian Esports League eFootball Tournament Challenge.\nTournament Context:\n${context}\n\nUser Question/Topic: ${prompt}\n\nPlease give an up-to-date, comprehensive, and tactical briefing using current Google Search data.`
      : `You are an expert eFootball esports intelligence analyst and tactics scout. Using live Google Search data, provide an up-to-date briefing on:\n${prompt}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: fullPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const searchChunks = groundingMetadata?.groundingChunks || [];
    const webSources = searchChunks
      .map((c: any) => c.web)
      .filter((w: any) => Boolean(w?.uri && w?.title));
    const searchQueries = groundingMetadata?.webSearchQueries || [];

    res.json({
      success: true,
      text,
      sources: webSources,
      searchQueries,
    });
  } catch (error: any) {
    console.error('AI Scout with Google Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate AI scouting report',
    });
  }
});

// Telegram Bot Status, Group Config & Single-Matchday Results Graphic Endpoints
app.get('/api/telegram/status', async (_req, res) => {
  try {
    const snapshot = await getTelegramStatusSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to retrieve Telegram bot status',
    });
  }
});

app.post('/api/telegram/config', async (req, res) => {
  try {
    const { groupChatId, autoPostMatchdayGraphic } = req.body || {};
    updateTelegramBotConfig({
      groupChatId,
      autoPostMatchdayGraphic,
    });
    const snapshot = await getTelegramStatusSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to update Telegram bot config',
    });
  }
});

app.post('/api/telegram/post-matchday', async (req, res) => {
  try {
    const matchdayNum = Number(req.body?.matchday);
    if (!Number.isFinite(matchdayNum) || matchdayNum < 1) {
      return res.status(400).json({ success: false, error: 'Valid matchday number required' });
    }
    const state = await readLiveTournamentState();
    const dispatchRes = await checkAndDispatchCompletedMatchdays(state, {
      forceMatchday: matchdayNum,
    });
    const snapshot = await getTelegramStatusSnapshot();
    if (dispatchRes.errors.length > 0 && dispatchRes.postedMatchdays.length === 0) {
      return res.status(400).json({
        success: false,
        error: dispatchRes.errors[0],
        data: snapshot,
      });
    }
    res.json({
      success: true,
      postedMatchdays: dispatchRes.postedMatchdays,
      data: snapshot,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to post Matchday graphic to Telegram',
    });
  }
});

app.post('/api/telegram/send-clock-notice', async (req, res) => {
  try {
    const noticeType = req.body?.type === 'ended' ? 'ended' : 'reminder';
    const state = await readLiveTournamentState();
    const noticeRes = await checkAndDispatchClockAnnouncements(state, {
      forceType: noticeType,
    });
    const snapshot = await getTelegramStatusSnapshot();
    if (noticeRes.error) {
      return res.status(400).json({
        success: false,
        error: noticeRes.error,
        data: snapshot,
      });
    }
    res.json({
      success: true,
      sent: noticeRes.sent,
      data: snapshot,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send Amharic clock announcement to Telegram',
    });
  }
});

app.get('/api/telegram/matchday-graphic/:matchday', async (req, res) => {
  try {
    const matchdayNum = Number(req.params.matchday);
    if (!Number.isFinite(matchdayNum) || matchdayNum < 1) {
      return res.status(400).json({ success: false, error: 'Invalid matchday number' });
    }
    const state = await readLiveTournamentState();
    const fixtures = computeServerFixtures(state);
    const pngBuffer = await generateMatchdayResultsPng({
      matchday: matchdayNum,
      fixtures,
      results: state.results || [],
      players: state.players || [],
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="efootball-matchday-${matchdayNum}-results.png"`
    );
    res.send(pngBuffer);
  } catch (err: any) {
    console.error('Matchday PNG generation error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate matchday graphic',
    });
  }
});

async function startServer() {
  if (!isProd) {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    startTelegramBot().catch((err) => {
      console.error('Failed to start Telegram Bot poller:', err);
    });
  });
}

startServer();
