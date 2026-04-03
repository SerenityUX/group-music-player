/**
 * Avatar background colors: each Latin letter A–Z maps to a hue on the rainbow (26 equal steps).
 * Sections (hue groups):
 * - **A–D** — warm reds / oranges
 * - **E–J** — yellow → lime → green
 * - **K–N** — greens → teal
 * - **O–S** — cyan → blue → indigo
 * - **T–Z** — indigo → purple → magenta → red
 *
 * Saturated, dark backgrounds (similar depth to brand green #00CB5B) with **WCAG 2.1 AA** contrast
 * for white text (≥ 4.5:1 for normal-sized initials).
 */

const FALLBACK_BACKGROUND = "#3f3f46";

/** WCAG relative luminance (sRGB), 0–1 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio of #ffffff against `hex` background */
function contrastWhiteOn(hex: string): number {
  const L = relativeLuminance(hex);
  return (1.0 + 0.05) / (L + 0.05);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  const r = hue2rgb(p, q, hn + 1 / 3);
  const g = hue2rgb(p, q, hn);
  const b = hue2rgb(p, q, hn - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorForLetterIndex(index: number): string {
  const hue = (index / 26) * 360;
  let L = 0.36;
  let hex = "#000000";
  for (let tries = 0; tries < 40; tries++) {
    const [r, g, b] = hslToRgb(hue, 0.72, L);
    hex = toHex(r, g, b);
    if (contrastWhiteOn(hex) >= 4.5) break;
    L -= 0.008;
  }
  return hex;
}

/** Precomputed A–Z backgrounds (same order as letter index 0–25). */
const LETTER_BACKGROUND_COLORS: readonly string[] = Array.from({ length: 26 }, (_, i) =>
  colorForLetterIndex(i),
);

function letterIndexFromName(name: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const ch = trimmed[0];
  if (!ch) return null;
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase().charCodeAt(0) - 65;
  // Other Unicode letters: spread across the rainbow by code point
  if (/^\p{L}/u.test(ch)) {
    const cp = trimmed.codePointAt(0);
    if (cp === undefined) return null;
    return cp % 26;
  }
  return null;
}

/**
 * Returns a dark background hex for the avatar circle, derived from the first letter of `name`.
 * Non-letter names (e.g. digits or symbols) use a neutral dark gray with good contrast for white.
 */
export function getPfpBackgroundColorForName(name: string): string {
  const idx = letterIndexFromName(name);
  if (idx === null) return FALLBACK_BACKGROUND;
  return LETTER_BACKGROUND_COLORS[idx] ?? FALLBACK_BACKGROUND;
}
