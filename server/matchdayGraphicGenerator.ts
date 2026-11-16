import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { Fixture, MatchResult, Player } from '../src/types/tournament';

const FONT_STENCIL_PATH = path.resolve(
  process.cwd(),
  'public/fonts/eFootballStencil-Regular.ttf'
);
const FONT_SANS_PATH = path.resolve(
  process.cwd(),
  'public/fonts/eFootballSans-Regular.ttf'
);

function escapeXml(str: string | number | undefined | null): string {
  const s = String(str ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(str: string, maxLen: number): string {
  const clean = (str || '').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

async function resolveAvatarDataUri(avatarUrl?: string): Promise<string | null> {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  const trimmed = avatarUrl.trim();
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(trimmed, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || 'image/png';
      if (!contentType.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 500_000) return null;
      return `data:${contentType};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }
  return null;
}

export interface MatchdayGraphicInput {
  matchday: number;
  fixtures: Fixture[];
  results: MatchResult[];
  players: Player[];
}

export async function generateMatchdayResultsPng(
  input: MatchdayGraphicInput
): Promise<Buffer> {
  const { matchday, fixtures, results, players } = input;
  const playerMap = new Map<string, Player>(
    players.map((p) => [p.user.toLowerCase().trim(), p])
  );

  // Build list of completed results ONLY for this single matchday
  const mdResults: MatchResult[] = [];
  const seenIds = new Set<string>();

  for (const f of fixtures) {
    if (f.matchday !== matchday) continue;
    const matched = results.find((r) => {
      if (r.isPostponed) return false;
      const samePair =
        (r.home_user.toLowerCase() === f.home.toLowerCase() &&
          r.away_user.toLowerCase() === f.away.toLowerCase()) ||
        (r.home_user.toLowerCase() === f.away.toLowerCase() &&
          r.away_user.toLowerCase() === f.home.toLowerCase());
      if (!samePair) return false;
      if (f.isKnockout) return Boolean(r.isKnockout) || r.matchday === matchday;
      return r.matchday === matchday;
    });
    if (matched && !seenIds.has(matched.id)) {
      seenIds.add(matched.id);
      mdResults.push(matched);
    }
  }

  // Fallback: also include any non-postponed results tagged with this matchday
  for (const r of results) {
    if (!r.isPostponed && r.matchday === matchday && !seenIds.has(r.id)) {
      seenIds.add(r.id);
      mdResults.push(r);
    }
  }

  // Preload player avatars cleanly for embedded SVG rendering
  const avatarDataMap = new Map<string, string | null>();
  const uniqueUsers = new Set<string>();
  mdResults.forEach((r) => {
    uniqueUsers.add(r.home_user.toLowerCase().trim());
    uniqueUsers.add(r.away_user.toLowerCase().trim());
  });

  await Promise.all(
    Array.from(uniqueUsers).map(async (u) => {
      const p = playerMap.get(u);
      const dataUri = await resolveAvatarDataUri(p?.avatarUrl);
      avatarDataMap.set(u, dataUri);
    })
  );

  const totalMatches = mdResults.length;
  const totalGoals = mdResults.reduce(
    (sum, r) => sum + (r.home_score || 0) + (r.away_score || 0),
    0
  );
  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0';

  const stageSet = Array.from(
    new Set(mdResults.map((r) => r.stage).filter(Boolean))
  );
  const stageSubtitle =
    stageSet.length === 1
      ? `${stageSet[0]} · All ${totalMatches} Matches Completed`
      : `Matchday ${matchday} Complete · All ${totalMatches} Fixtures Finalized`;

  const cols = totalMatches <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(totalMatches / cols));

  const width = 1240;
  const paddingX = 48;
  const headerHeight = 148;
  const statsHeight = 96;
  const cardGapX = 24;
  const cardGapY = 20;
  const cardWidth =
    cols === 1
      ? width - paddingX * 2
      : (width - paddingX * 2 - cardGapX) / 2;
  const cardHeight = 166;
  const cardsStartY = headerHeight + statsHeight + 48;
  const footerHeight = 76;
  const height = Math.max(
    520,
    cardsStartY + rows * cardHeight + Math.max(0, rows - 1) * cardGapY + footerHeight + 24
  );

  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const clipDefs: string[] = [];
  const cardNodes: string[] = [];

  mdResults.forEach((r, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = paddingX + col * (cardWidth + cardGapX);
    const y = cardsStartY + row * (cardHeight + cardGapY);

    const homeKey = r.home_user.toLowerCase().trim();
    const awayKey = r.away_user.toLowerCase().trim();
    const homeP = playerMap.get(homeKey);
    const awayP = playerMap.get(awayKey);

    const homeTeam = truncateText(homeP?.team || r.home_user, 23);
    const awayTeam = truncateText(awayP?.team || r.away_user, 23);
    const homeUser = truncateText(`@${r.home_user}`, 24);
    const awayUser = truncateText(`@${r.away_user}`, 24);

    const isHomeWinner =
      r.home_score > r.away_score || r.penaltyWinner === r.home_user;
    const isAwayWinner =
      r.away_score > r.home_score || r.penaltyWinner === r.away_user;

    const homeAvatar = avatarDataMap.get(homeKey);
    const awayAvatar = avatarDataMap.get(awayKey);

    const homeClipId = `clip-home-${idx}`;
    const awayClipId = `clip-away-${idx}`;
    const homeImgCx = x + 36;
    const homeImgCy = y + 72;
    const awayImgCx = x + 36;
    const awayImgCy = y + 116;

    clipDefs.push(
      `<clipPath id="${homeClipId}"><circle cx="${homeImgCx}" cy="${homeImgCy}" r="16" /></clipPath>`,
      `<clipPath id="${awayClipId}"><circle cx="${awayImgCx}" cy="${awayImgCy}" r="16" /></clipPath>`
    );

    const homeAvatarSvg = homeAvatar
      ? `<image href="${homeAvatar}" x="${homeImgCx - 16}" y="${homeImgCy - 16}" width="32" height="32" clip-path="url(#${homeClipId})" preserveAspectRatio="xMidYMid slice" />`
      : `<circle cx="${homeImgCx}" cy="${homeImgCy}" r="16" fill="#071360" /><text x="${homeImgCx}" y="${homeImgCy + 5}" text-anchor="middle" fill="#3ce7ff" font-size="13" font-weight="bold" font-family="eFootball Sans">${escapeXml((homeP?.team || r.home_user).slice(0, 2).toUpperCase())}</text>`;

    const awayAvatarSvg = awayAvatar
      ? `<image href="${awayAvatar}" x="${awayImgCx - 16}" y="${awayImgCy - 16}" width="32" height="32" clip-path="url(#${awayClipId})" preserveAspectRatio="xMidYMid slice" />`
      : `<circle cx="${awayImgCx}" cy="${awayImgCy}" r="16" fill="#071360" /><text x="${awayImgCx}" y="${awayImgCy + 5}" text-anchor="middle" fill="#3ce7ff" font-size="13" font-weight="bold" font-family="eFootball Sans">${escapeXml((awayP?.team || r.away_user).slice(0, 2).toUpperCase())}</text>`;

    const penText = r.penaltyWinner
      ? `<text x="${x + cardWidth / 2}" y="${y + cardHeight - 12}" text-anchor="middle" fill="#eaff28" font-size="11" font-family="eFootball Sans">Penalties Winner: @${escapeXml(r.penaltyWinner)}${
          r.penaltyHomeScore !== undefined && r.penaltyAwayScore !== undefined
            ? ` (${r.penaltyHomeScore}-${r.penaltyAwayScore})`
            : ''
        }</text>`
      : '';

    const stageLabel = escapeXml(
      `Matchday ${r.matchday} · ${r.stage || 'Official Fixture'}`
    );

    cardNodes.push(`
      <g>
        <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="16" fill="#060c4c" stroke="#3ce7ff" stroke-opacity="0.38" stroke-width="1.5" />
        <line x1="${x + 16}" y1="${y + 38}" x2="${x + cardWidth - 16}" y2="${y + 38}" stroke="#3ce7ff" stroke-opacity="0.18" stroke-width="1" />
        <text x="${x + 18}" y="${y + 25}" fill="#3ce7ff" font-size="12" font-weight="bold" font-family="eFootball Sans">${stageLabel}</text>
        <rect x="${x + cardWidth - 96}" y="${y + 11}" width="80" height="20" rx="6" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-opacity="0.5" stroke-width="1" />
        <text x="${x + cardWidth - 56}" y="${y + 25}" text-anchor="middle" fill="#6ee7b7" font-size="10.5" font-weight="bold" font-family="eFootball Sans">FINAL FT</text>

        <!-- Home Row -->
        <circle cx="${homeImgCx}" cy="${homeImgCy}" r="17" fill="#040836" stroke="${isHomeWinner ? '#eaff28' : '#3ce7ff'}" stroke-width="1.5" />
        ${homeAvatarSvg}
        <text x="${x + 64}" y="${y + 68}" fill="${isHomeWinner ? '#eaff28' : '#ffffff'}" font-size="16" font-weight="bold" font-family="eFootball Stencil">${escapeXml(homeTeam)}</text>
        <text x="${x + 64}" y="${y + 84}" fill="#3ce7ff" font-size="11.5" font-family="eFootball Sans">${escapeXml(homeUser)}</text>
        <rect x="${x + cardWidth - 70}" y="${y + 53}" width="52" height="34" rx="9" fill="#081466" stroke="${isHomeWinner ? '#eaff28' : '#3ce7ff'}" stroke-opacity="${isHomeWinner ? '0.85' : '0.4'}" stroke-width="1.5" />
        <text x="${x + cardWidth - 44}" y="${y + 77}" text-anchor="middle" fill="${isHomeWinner ? '#eaff28' : '#ffffff'}" font-size="20" font-weight="bold" font-family="eFootball Stencil">${r.home_score}</text>

        <!-- Away Row -->
        <circle cx="${awayImgCx}" cy="${awayImgCy}" r="17" fill="#040836" stroke="${isAwayWinner ? '#eaff28' : '#3ce7ff'}" stroke-width="1.5" />
        ${awayAvatarSvg}
        <text x="${x + 64}" y="${y + 113}" fill="${isAwayWinner ? '#eaff28' : '#ffffff'}" font-size="16" font-weight="bold" font-family="eFootball Stencil">${escapeXml(awayTeam)}</text>
        <text x="${x + 64}" y="${y + 129}" fill="#3ce7ff" font-size="11.5" font-family="eFootball Sans">${escapeXml(awayUser)}</text>
        <rect x="${x + cardWidth - 70}" y="${y + 98}" width="52" height="34" rx="9" fill="#081466" stroke="${isAwayWinner ? '#eaff28' : '#3ce7ff'}" stroke-opacity="${isAwayWinner ? '0.85' : '0.4'}" stroke-width="1.5" />
        <text x="${x + cardWidth - 44}" y="${y + 122}" text-anchor="middle" fill="${isAwayWinner ? '#eaff28' : '#ffffff'}" font-size="20" font-weight="bold" font-family="eFootball Stencil">${r.away_score}</text>

        ${penText}
      </g>
    `);
  });

  const statsY = headerHeight + 18;
  const footerY = height - 46;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#050d4a" />
      <stop offset="50%" stop-color="#03072c" />
      <stop offset="100%" stop-color="#01041b" />
    </linearGradient>
    <radialGradient id="topGlow" cx="50%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#3ce7ff" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#050d4a" stop-opacity="0" />
    </radialGradient>
    ${clipDefs.join('\n    ')}
  </defs>

  <!-- Background Frame -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="28" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="${width}" height="${height}" rx="28" fill="url(#topGlow)" />
  <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="26" fill="none" stroke="#3ce7ff" stroke-opacity="0.45" stroke-width="2.5" />

  <!-- Top Header Badge -->
  <rect x="${paddingX}" y="38" width="66" height="66" rx="18" fill="#071360" stroke="#eaff28" stroke-width="2.5" />
  <text x="${paddingX + 33}" y="82" text-anchor="middle" fill="#eaff28" font-size="34" font-weight="bold" font-family="eFootball Stencil">e</text>

  <circle cx="${paddingX + 92}" cy="46" r="5" fill="#eaff28" />
  <text x="${paddingX + 106}" y="51" fill="#eaff28" font-size="13.5" font-weight="bold" letter-spacing="1.4" font-family="eFootball Stencil">OFFICIAL MATCH RESULTS BULLETIN · ETHIOPIAN eFOOTBALL</text>
  <text x="${paddingX + 86}" y="86" fill="#ffffff" font-size="34" font-weight="bold" letter-spacing="0.6" font-family="eFootball Stencil">MATCHDAY ${matchday} RESULTS</text>
  <text x="${paddingX + 86}" y="110" fill="#3ce7ff" font-size="14" font-family="eFootball Sans">${escapeXml(`Verified Final Scores · Single Matchday ${matchday} Bulletin`)}</text>

  <!-- Right Pill Stamp -->
  <rect x="${width - paddingX - 210}" y="42" width="210" height="30" rx="15" fill="#050842" stroke="#3ce7ff" stroke-opacity="0.5" stroke-width="1.5" />
  <text x="${width - paddingX - 105}" y="62" text-anchor="middle" fill="#eaff28" font-size="12" font-weight="bold" font-family="eFootball Stencil">MATCHDAY ${matchday} OFFICIAL</text>
  <text x="${width - paddingX}" y="92" text-anchor="end" fill="#8e9bd4" font-size="12" font-family="eFootball Sans">Generated ${escapeXml(dateLabel)}</text>

  <line x1="${paddingX}" y1="134" x2="${width - paddingX}" y2="134" stroke="#3ce7ff" stroke-opacity="0.28" stroke-width="1.5" />

  <!-- Summary Stats Bar -->
  <rect x="${paddingX}" y="${statsY}" width="${width - paddingX * 2}" height="${statsHeight - 10}" rx="18" fill="#040938" stroke="#3ce7ff" stroke-opacity="0.26" stroke-width="1.5" />
  <line x1="${width / 3}" y1="${statsY + 14}" x2="${width / 3}" y2="${statsY + statsHeight - 24}" stroke="#3ce7ff" stroke-opacity="0.22" stroke-width="1.5" />
  <line x1="${(width * 2) / 3}" y1="${statsY + 14}" x2="${(width * 2) / 3}" y2="${statsY + statsHeight - 24}" stroke="#3ce7ff" stroke-opacity="0.22" stroke-width="1.5" />

  <text x="${paddingX + (width - paddingX * 2) / 6}" y="${statsY + 42}" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="bold" font-family="eFootball Stencil">${totalMatches}</text>
  <text x="${paddingX + (width - paddingX * 2) / 6}" y="${statsY + 66}" text-anchor="middle" fill="#8e9bd4" font-size="12" font-family="eFootball Sans">MATCHES COMPLETED</text>

  <text x="${width / 2}" y="${statsY + 42}" text-anchor="middle" fill="#eaff28" font-size="30" font-weight="bold" font-family="eFootball Stencil">${totalGoals}</text>
  <text x="${width / 2}" y="${statsY + 66}" text-anchor="middle" fill="#8e9bd4" font-size="12" font-family="eFootball Sans">TOTAL GOALS SCORED</text>

  <text x="${width - paddingX - (width - paddingX * 2) / 6}" y="${statsY + 42}" text-anchor="middle" fill="#3ce7ff" font-size="30" font-weight="bold" font-family="eFootball Stencil">${avgGoals}</text>
  <text x="${width - paddingX - (width - paddingX * 2) / 6}" y="${statsY + 66}" text-anchor="middle" fill="#8e9bd4" font-size="12" font-family="eFootball Sans">AVG GOALS / MATCH</text>

  <!-- Match Cards -->
  ${cardNodes.join('\n  ')}

  <!-- Footer -->
  <line x1="${paddingX}" y1="${footerY - 22}" x2="${width - paddingX}" y2="${footerY - 22}" stroke="#3ce7ff" stroke-opacity="0.22" stroke-width="1.5" />
  <text x="${paddingX}" y="${footerY + 4}" fill="#8e9bd4" font-size="12.5" font-family="eFootball Sans">${escapeXml(stageSubtitle)}</text>
  <text x="${width - paddingX}" y="${footerY + 4}" text-anchor="end" fill="#3ce7ff" font-size="12.5" font-family="eFootball Sans">Official Ethiopian eFootball Matchday ${matchday} Bulletin</text>
</svg>`;

  const fontFiles: string[] = [];
  if (fs.existsSync(FONT_STENCIL_PATH)) fontFiles.push(FONT_STENCIL_PATH);
  if (fs.existsSync(FONT_SANS_PATH)) fontFiles.push(FONT_SANS_PATH);

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1600,
    },
    font: {
      fontFiles,
      loadSystemFonts: true,
      defaultFontFamily: 'eFootball Sans',
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
