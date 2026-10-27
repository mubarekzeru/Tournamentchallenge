import { toPng } from 'html-to-image';

export interface ExportImageOptions {
  fileName?: string;
  pixelRatio?: number;
  quality?: number;
  backgroundColor?: string;
}

const DEFAULT_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="%23071360" stroke="%233ce7ff" stroke-width="2"/></svg>';

let cachedFontEmbedCSS: string | null = null;

async function getFontEmbedCSS(): Promise<string> {
  if (cachedFontEmbedCSS !== null) return cachedFontEmbedCSS;
  try {
    const res = await fetch('/fonts/eFootballStencil-Regular.woff2');
    const buffer = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    cachedFontEmbedCSS = `
      @font-face {
        font-family: 'eFootballStencil-Regular';
        font-style: normal;
        font-weight: 100 900;
        font-display: block;
        src: url(data:font/woff2;base64,${base64}) format('woff2');
      }
      .font-sports, .font-efootball-stencil, .font-club-name, [data-club-name], h1, h2, h3, h4, h5, h6, strong, b, th, .font-bold, .font-extrabold, .font-black {
        font-family: 'eFootballStencil-Regular', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        letter-spacing: 0.01em;
      }
    `;
    return cachedFontEmbedCSS;
  } catch (e) {
    console.warn('Could not load font for export embedding:', e);
    return `
      @font-face {
        font-family: 'eFootballStencil-Regular';
        src: url('/fonts/eFootballStencil-Regular.woff2') format('woff2');
      }
    `;
  }
}

/**
 * Robustly renders an HTMLElement to a PNG data URL.
 * Automatically embeds the eFootball Stencil font as a data URI into the foreignObject SVG.
 */
export async function exportElementToPng(
  element: HTMLElement,
  options: ExportImageOptions = {}
): Promise<string> {
  const {
    pixelRatio = 2,
    quality = 0.98,
    backgroundColor = '#020520',
  } = options;

  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
  } catch {
    // Ignore font readiness error
  }

  const fontEmbedCSS = await getFontEmbedCSS();

  try {
    return await toPng(element, {
      quality,
      pixelRatio,
      backgroundColor,
      skipFonts: false,
      fontEmbedCSS,
      cacheBust: false,
      imagePlaceholder: DEFAULT_IMAGE_PLACEHOLDER,
    });
  } catch (err) {
    console.warn('High-res toPng export with fonts encountered an issue, trying with fallback:', err);
    return await toPng(element, {
      quality: 0.92,
      pixelRatio: 1.5,
      backgroundColor,
      skipFonts: false,
      fontEmbedCSS,
      cacheBust: false,
      imagePlaceholder: DEFAULT_IMAGE_PLACEHOLDER,
    });
  }
}

/**
 * Triggers a browser download for a given base64 image data URL.
 */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
