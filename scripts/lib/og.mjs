// The social-card drawing kit shared by scripts/gen-og.mjs (the board's
// committed og.png and card.png) and scripts/prerender.mjs (a card per
// player page, drawn at build). One palette, the page's fonts as glyph
// outlines, and the frame every card sits in.
//
// Text is drawn as glyph outlines through opentype.js (pinned to 1.3.4; 2.x
// emits NaN path data), because sharp's librsvg never finds Graduate or Plex
// Mono. The TTFs are committed under scripts/fonts/ (OFL).
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const font = (f) => opentype.parse(readFileSync(resolve(ROOT, 'scripts/fonts', f)).buffer.slice(0))
export const FONT = {
  Graduate: font('Graduate-Regular.ttf'),
  Mono: font('IBMPlexMono-Regular.ttf'),
  MonoBold: font('IBMPlexMono-SemiBold.ttf'),
  Serif: font('SourceSerif4-Regular.ttf'),
}

export const BG = '#282127', INK = '#efe6d9', MUTED = '#bfb2a6', FAINT = '#857a75', LINE = '#453a42', CREAM = '#f3e2bc', RUST = '#c36c36'

export const width = (str, name, size, spacing = 0) => FONT[name].getAdvanceWidth(str, size, { kerning: true, letterSpacing: spacing / size })

/** a run of text as a filled path; anchor start|middle|end */
export function text(str, { x, y, font: name, size, fill, anchor = 'start', spacing = 0, opacity }) {
  const f = FONT[name]
  const opts = { kerning: true, letterSpacing: spacing / size }
  const w = f.getAdvanceWidth(str, size, opts)
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return `<path d="${f.getPath(str, x0, y, size, opts).toPathData(2)}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`
}

/** the string cut at a word to fit maxW, with an ellipsis */
export function fit(str, name, size, maxW, spacing = 0) {
  if (width(str, name, size, spacing) <= maxW) return str
  const words = str.split(' ')
  while (words.length > 1) {
    words.pop()
    const s = words.join(' ') + '…'
    if (width(s, name, size, spacing) <= maxW) return s
  }
  let s = str
  while (s.length > 1 && width(s + '…', name, size, spacing) > maxW) s = s.slice(0, -1)
  return s + '…'
}

/** the biggest size at or under `size` that fits maxW */
export function sizeToFit(str, name, size, maxW, spacing = 0, min = 24) {
  let s = size
  while (s > min && width(str, name, s, spacing) > maxW) s -= 2
  return s
}

export const dashed = (x1, y, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${LINE}" stroke-dasharray="1 3"/>`

/** the frame: the dark field with the glow, then the parts */
export function frame(W, H, parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="-0.2" r="0.9">
      <stop offset="0%" stop-color="${CREAM}" stop-opacity="0.12"/>
      <stop offset="65%" stop-color="${CREAM}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${parts.join('\n  ')}
</svg>`
}

/** the footer every card shares: the site's path left, the rust rule right */
export function footer(W, H, path) {
  const L = 100, R = W - 100, y = H - 36
  return [
    text(path, { x: L, y, font: 'Mono', size: 13, fill: FAINT, spacing: 1 }),
    `<rect x="${R - 80}" y="${y - 9}" width="80" height="3" fill="${RUST}"/>`,
  ]
}

export const toPng = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file)
