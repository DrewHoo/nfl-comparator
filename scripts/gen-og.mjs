// Generate the board's social preview images. Run: npm run gen:og
//   public/og.png    1200x630, what X/Bluesky/LinkedIn/Reddit/iMessage show
//   public/card.png  1200x750, the 8:5 cover for the index site's project card
//
// The composition is the real thing: the default board (quarterbacks by wins
// through their first 150 starts, playoffs included) from src/data/QB.json
// through src/lib/query.ts, drawn in the page's own look. It drifts as
// results come in; re-run after a redesign or when a fresher board is worth
// committing. Outputs are committed; CI does not regenerate them. The player
// pages' cards are drawn at build by scripts/prerender.mjs instead.
//
// The drawing kit (fonts as outlines, palette, frame) is scripts/lib/og.mjs.
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }
import { decodeLedger } from '../src/lib/ledger.ts'
import { evaluate, DEFAULT_QUERY } from '../src/lib/query.ts'
import { headWords, POS_WORDS } from '../src/lib/words.ts'
import { CREAM, FAINT, INK, dashed, footer, frame, hasTitleFont, masthead, safeL, safeR, text, toPng, width } from './lib/og.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// the committed images carry the real heading face; a fallback would ship a different card
if (!hasTitleFont()) throw new Error('gen-og: Georgia Bold missing; run on a Mac or set GEORGIA_BOLD to a Georgia Bold TTF')
const outDir = resolve(ROOT, 'public')
mkdirSync(outDir, { recursive: true })

const ledger = decodeLedger(JSON.parse(readFileSync(resolve(ROOT, 'src/data/QB.json'), 'utf8')))
const query = { ...DEFAULT_QUERY, scope: 'all' }
const board = evaluate(ledger, query)

function render(W, H) {
  const L = safeL(W), R = safeR(W)
  const rowH = 42
  const top = 206
  const rows = board.ranked.slice(0, Math.floor((H - 60 - top) / rowH))
  const parts = masthead(W, {
    heading: headWords(query).replace(/^./, (c) => c.toUpperCase()),
    sub: `${POS_WORDS[query.pos]} · playoffs included · ${board.ranked.length} careers with the whole window`,
  })
  rows.forEach((r, i) => {
    const y = top + rowH * i + 26
    const rank = `${r.tied ? 'T' : ''}${r.rank}`
    parts.push(text(rank, { x: L + 4, y, font: 'Mono', size: 12, fill: r.rank === 1 ? CREAM : FAINT }))
    parts.push(text(r.player.name, { x: L + 44, y, font: 'Serif', size: 22, fill: INK }))
    parts.push(text(`${r.from}–${r.to}`, { x: L + 44 + width(r.player.name, 'Serif', 22) + 14, y, font: 'Mono', size: 10.5, fill: FAINT, spacing: 0.8 }))
    parts.push(text(String(r.value), { x: R, y: y + 1, font: 'Graduate', size: 26, fill: CREAM, anchor: 'end' }))
    if (r !== rows[rows.length - 1]) parts.push(dashed(L, y + 14, R))
  })
  parts.push(...footer(W, H, `1999–${ledger.currentSeason} · ${config.domain}/${pkg.name}`))
  return frame(W, H, parts)
}

for (const { name, w, h } of [
  { name: 'og.png', w: 1200, h: 630 },
  { name: 'card.png', w: 1200, h: 750 },
]) {
  await toPng(render(w, h), resolve(outDir, name))
  console.log(`wrote ${name} (${w}x${h})`)
}
