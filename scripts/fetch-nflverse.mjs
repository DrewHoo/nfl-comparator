// Downloads the nflverse release files the ledger is built from into
// data/raw/ (gitignored). Skips a file that is already there; delete it to
// refetch. Release assets: https://github.com/nflverse/nflverse-data/releases
//   stats_player/stats_player_week_<season>.csv.gz  one row per player-game with a stat line, 1999 on
//   schedules/games.csv                              every game with scores, the starting QBs and the coaches
//   players/players.csv                              the id crosswalk, birth dates, positions
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIRST_SEASON, CURRENT_SEASON } from './lib/window.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data/raw')
const BASE = 'https://github.com/nflverse/nflverse-data/releases/download'
fs.mkdirSync(RAW, { recursive: true })

const wants = [
  ['schedules/games.csv', 'games.csv'],
  ['players/players.csv.gz', 'players.csv.gz'],
]
for (let s = FIRST_SEASON; s <= CURRENT_SEASON; s++) wants.push([`stats_player/stats_player_week_${s}.csv.gz`, `stats_player_week_${s}.csv.gz`])

// the running season's files change nightly; refetch those when older than a day
const fresh = (file) => {
  if (!fs.existsSync(file)) return false
  const running = file.includes(`_${CURRENT_SEASON}.`) || file.endsWith('games.csv')
  return !running || Date.now() - fs.statSync(file).mtimeMs < 86_400_000
}

let n = 0
for (const [asset, name] of wants) {
  const file = path.join(RAW, name)
  if (fresh(file)) continue
  const res = await fetch(`${BASE}/${asset}`)
  if (!res.ok) { console.error(`fetch ${asset}: HTTP ${res.status}`); process.exitCode = 1; continue }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  n++
  console.log(`${name} ${(fs.statSync(file).size / 1024).toFixed(0)}KB`)
}
console.log(`fetched ${n} file(s) into data/raw`)
