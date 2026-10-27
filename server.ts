import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const ai = new GoogleGenAI();
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

// POST update tournament data (players, profile pictures, results)
app.post('/api/tournament', (req, res) => {
  const { players, results } = req.body;
  if (!players || !results) {
    return res.status(400).json({ success: false, error: 'Missing players or results' });
  }

  const existingData = loadTournamentData();
  const payload = {
    players,
    results,
    adminPasscode: existingData?.adminPasscode || DEFAULT_ADMIN_PASSCODE,
    updatedAt: new Date().toISOString(),
  };

  const saved = saveTournamentData(payload);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'Could not write to storage' });
  }

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

// AI Intelligence & Tactics Scout grounded with live Google Search (gemini-3.5-flash)
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
      model: 'gemini-3.5-flash',
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
  });
}

startServer();
