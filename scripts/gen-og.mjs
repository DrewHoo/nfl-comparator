// Generate the board's social preview images. Run: npm run gen:og
//   public/og.png    1200x630, what X/Bluesky/LinkedIn/Reddit/iMessage show
//   public/card.png  1200x750, the 8:5 cover for the index site's project card
//
// The composition is the real thing: the page's default board (quarterbacks
// by wins through their first 150 starts, regular season) from src/data/QB.json
// through src/lib/query.ts, drawn in the page's own look. It drifts as
// results come in; re-run after a redesign or when a fresher board is worth
// committing. Outputs are committed; CI does not regenerate them. The player
// pages' cards are drawn at build by scripts/prerender.mjs instead.
//
// The drawing kit (fonts as outlines, palette, frame) is scripts/lib/og.mjs;
// the board card itself is scripts/lib/og-board.mjs, which the prerender
// draws for every named board too.
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }
import { decodeLedger } from '../src/lib/ledger.ts'
import { evaluate, DEFAULT_QUERY } from '../src/lib/query.ts'
import { hasTitleFont, toPng } from './lib/og.mjs'
import { boardCard } from './lib/og-board.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// the committed images carry the real heading face; a fallback would ship a different card
if (!hasTitleFont()) throw new Error('gen-og: Georgia Bold missing; run on a Mac or set GEORGIA_BOLD to a Georgia Bold TTF')
const outDir = resolve(ROOT, 'public')
mkdirSync(outDir, { recursive: true })

const ledger = decodeLedger(JSON.parse(readFileSync(resolve(ROOT, 'src/data/QB.json'), 'utf8')))
const query = DEFAULT_QUERY
const board = evaluate(ledger, query)
const render = (W, H) => boardCard(query, board, { W, H, seasons: `${ledger.firstSeason}–${ledger.currentSeason}`, site: `${config.domain}/${pkg.name}` })

for (const { name, w, h } of [
  { name: 'og.png', w: 1200, h: 630 },
  { name: 'card.png', w: 1200, h: 750 },
]) {
  await toPng(render(w, h), resolve(outDir, name))
  console.log(`wrote ${name} (${w}x${h})`)
}
