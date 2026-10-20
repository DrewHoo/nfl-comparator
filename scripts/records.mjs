// Prints a player's page as the records mine would build it: every family,
// its best row with the score's terms, the rest folded. Usage:
//   node scripts/records.mjs QB "Cam Newton" "Patrick Mahomes"
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeLedger } from '../src/lib/ledger.ts'
import { mine, page, shapesFor, RECORDS } from '../src/lib/records.ts'
import { queryWords, recordWords, placeWords, runWords, breakerWords } from '../src/lib/words.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [pos = 'QB', ...names] = process.argv.slice(2)
const ledger = decodeLedger(JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${pos}.json`), 'utf8')))

const t0 = Date.now()
const shapes = shapesFor(pos)
const rows = mine(ledger, shapes)
console.log(`${shapes.length} shapes, ${rows.length} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s`)

const words = (r) => `${recordWords(r)} — ${placeWords(r)} · ${runWords(r, RECORDS.minN[r.shape.seq])}${r.breaker ? ' · ' + breakerWords(r) : ''}`
const terms = (r) => Object.entries(r.terms).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`).join(' ')

for (const name of names) {
  const p = ledger.players.find((x) => x.name === name)
  if (!p) { console.log(`\n${name}: not in the ${pos} ledger`); continue }
  const fams = page(rows, p.id, pos)
  const n = fams.reduce((s, f) => s + 1 + f.rest.length, 0)
  console.log(`\n=== ${name} (${p.debut}–${p.games[p.games.length - 1].season}, ${p.games.length} games): ${fams.length} families, ${n} rows ===`)
  const FAMS = Number(process.env.FAMS ?? 18), ROWS = Number(process.env.ROWS ?? 3)
  const only = process.env.FAMILY
  for (const f of fams.filter((f) => !only || f.key.startsWith(only)).slice(0, FAMS)) {
    const r = f.best
    console.log(`\n[${r.score.toFixed(1)}] ${r.kind.toUpperCase()} · ${queryWords({ ...r.shape, n: r.at })}`)
    console.log(`   ${words(r)}`)
    console.log(`   ${terms(r)}${r.folded.length ? ` · folds ${r.folded.length}` : ''}`)
    for (const s of f.rest.slice(0, ROWS)) console.log(`   + [${s.score.toFixed(1)}] ${s.kind} · ${words(s)}`)
    if (f.rest.length > ROWS) console.log(`   + ${f.rest.length - ROWS} more`)
  }
}
