// Mines what every player leads (src/lib/records.ts) and writes one file per
// player with a row to public/players/<id>.json, plus public/players/index.json
// (who has a page). Runs before `vite build` so the files ship with the site,
// and on its own (`npm run records`) for the dev server. Nothing here is
// committed; the ledgers in src/data are the source.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeLedger, POSITIONS } from '../src/lib/ledger.ts'
import { encodePlayer, mine } from '../src/lib/records.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/players')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const index = []
const t0 = Date.now()
for (const pos of POSITIONS) {
  const ledger = decodeLedger(JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${pos}.json`), 'utf8')))
  const t = Date.now()
  const rows = mine(ledger)
  const by = new Map()
  for (const r of rows) (by.get(r.player.id) ?? by.set(r.player.id, []).get(r.player.id)).push(r)
  for (const p of ledger.players) {
    const mine = by.get(p.id)
    if (!mine) continue
    const file = encodePlayer(p, mine, ledger.currentSeason)
    fs.writeFileSync(path.join(OUT, `${p.id}.json`), JSON.stringify(file))
    index.push({ id: p.id, name: p.name, pos, from: file.from, to: file.to, n: mine.length, top: Math.round(Math.max(...mine.map((r) => r.score)) * 10) / 10 })
  }
  console.log(`${pos}: ${rows.length} rows, ${by.size} of ${ledger.players.length} players with a page, ${((Date.now() - t) / 1000).toFixed(1)}s`)
}
index.sort((a, b) => b.top - a.top)
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))
console.log(`${index.length} player files in public/players, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
