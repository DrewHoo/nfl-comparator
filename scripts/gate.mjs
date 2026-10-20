// The known-answer gate: four published factoids the ledger has to reproduce.
// Prints each with the numbers it found; the test in src/lib/query.test.ts
// pins the ones that pass. Run after `npm run ledger`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeLedger } from '../src/lib/ledger.ts'
import { evaluate, DEFAULT_QUERY } from '../src/lib/query.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const load = (pos) => decodeLedger(JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${pos}.json`), 'utf8')))
const QB = load('QB'), WR = load('WR')
const row = (board, name, season) => [...board.ranked, ...board.onTheWay].find((r) => r.player.name === name && (season == null || r.season === season))

console.log('1. Mahomes and Brady, wins through their first 150 starts')
for (const scope of ['reg', 'all']) {
  const b = evaluate(QB, { ...DEFAULT_QUERY, n: 150, scope })
  const m = row(b, 'Patrick Mahomes'), t = row(b, 'Tom Brady')
  console.log(`   ${scope}: Mahomes ${m?.value} (${m?.reached} starts, rank ${m?.rank}), Brady ${t?.value} (rank ${t?.rank})`)
}
console.log('1b. W-L through their first 151 games')
for (const scope of ['reg', 'all']) {
  const w = evaluate(QB, { ...DEFAULT_QUERY, stat: 'win', seq: 'games', n: 151, scope })
  const l = evaluate(QB, { ...DEFAULT_QUERY, stat: 'loss', seq: 'games', n: 151, scope })
  console.log(`   ${scope}: Mahomes ${row(w, 'Patrick Mahomes')?.value}-${row(l, 'Patrick Mahomes')?.value}, Brady ${row(w, 'Tom Brady')?.value}-${row(l, 'Tom Brady')?.value}`)
}

console.log('2. 280+ yds and a TD in each of the team\'s first 5 games, since 2011')
{
  const b = evaluate(QB, { ...DEFAULT_QUERY, how: 'every', tests: [{ stat: 'payds', min: 280 }, { stat: 'patd', min: 1 }], n: 5, seq: 'teamGames', since: 2011 })
  console.log('   ' + b.ranked.filter((r) => r.all).map((r) => `${r.player.name} ${r.season}`).join(', '))
}

console.log('3. passing + rushing TDs through 120 regular-season games')
{
  const b = evaluate(QB, { ...DEFAULT_QUERY, stat: 'offtd', seq: 'games', n: 120 })
  console.log('   ' + b.ranked.slice(0, 4).map((r) => `${r.rank}. ${r.player.name} ${r.value}`).join(' · '))
}

console.log('4. fewest games to 250 receptions')
{
  const b = evaluate(WR, { ...DEFAULT_QUERY, pos: 'WR', stat: 'rec', how: 'reach', n: 250, seq: 'games', dir: 'fewest' })
  console.log('   ' + b.ranked.slice(0, 4).map((r) => `${r.rank}. ${r.player.name} ${r.value}`).join(' · '))
}
