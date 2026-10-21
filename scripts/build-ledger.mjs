// Builds the ledger the site reads: per player, every game with a stat line,
// in order, joined to the schedule for the result, the start flag (QBs only:
// the schedule names each game's starting QB) and the team's game number that
// season. One file per position group under src/data/, each a compact array
// form (src/lib/ledger.ts decodes it; COLS below is the row layout).
//
// What the data can't say, so the site doesn't: a game a player dressed for
// but recorded no stat in is absent (nflverse's weekly stats are "touched a
// play", not "played"), and no position but QB has a start flag.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCsv } from './lib/csv.mjs'
import { FIRST_SEASON, CURRENT_SEASON } from './lib/window.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, 'data/raw')
const OUT = path.join(ROOT, 'src/data')
fs.mkdirSync(OUT, { recursive: true })

// the row layout; src/lib/ledger.ts reads the same order
export const COLS = ['season', 'week', 'post', 'date', 'team', 'opp', 'started', 'result', 'tgn',
  'att', 'cmp', 'payds', 'patd', 'int', 'sacked', 'car', 'ruyds', 'rutd', 'rec', 'tgt', 'reyds', 'retd', 'fumlost']
const GROUPS = { QB: ['QB'], RB: ['RB', 'FB', 'HB'], WR: ['WR'], TE: ['TE'] }
const groupOf = (pos) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(pos)) ?? null

// the schedule: result per team per game, the starting QBs, the team's game number
// the stat rows carry a franchise's current code (LA, LAC, LV); the schedule
// carries the code of the day (STL, SD, OAK). The ledger uses the current one.
const CODE = { STL: 'LA', SD: 'LAC', OAK: 'LV' }
const games = readCsv(path.join(RAW, 'games.csv')).map((g) => ({ ...g, home_team: CODE[g.home_team] ?? g.home_team, away_team: CODE[g.away_team] ?? g.away_team }))
const byGame = new Map()
const teamSeason = new Map() // `${team}|${season}` -> [{ id, week, post, date }]
for (const g of games) {
  if (g.away_score === '' || g.home_score === '') continue // unplayed
  const post = g.game_type === 'REG' ? 0 : 1
  const date = Number(g.gameday.replace(/-/g, ''))
  byGame.set(g.game_id, { g, post, date })
  for (const side of ['away', 'home']) {
    const key = `${g[`${side}_team`]}|${g.season}`
    if (!teamSeason.has(key)) teamSeason.set(key, [])
    teamSeason.get(key).push({ id: g.game_id, week: Number(g.week), post, date })
  }
}
const tgnOf = new Map() // `${game_id}|${team}` -> n
const teamGames = {} // team -> season -> [reg, all]
for (const [key, list] of teamSeason) {
  const [team, season] = key.split('|')
  list.sort((a, b) => a.date - b.date || a.week - b.week)
  list.forEach((x, i) => tgnOf.set(`${x.id}|${team}`, i + 1))
  const reg = list.filter((x) => !x.post).length
  ;(teamGames[team] ??= {})[season] = [reg, list.length]
}

// players: birth date and display name
const people = new Map()
for (const p of readCsv(path.join(RAW, 'players.csv.gz'))) people.set(p.gsis_id, p)

const num = (v) => (v === '' || v === 'NA' ? 0 : Math.round(Number(v)))
const statFile = (s) => path.join(RAW, `stats_player_week_${s}.csv.gz`)

// nflverse's 2001 and 2002 weekly files give a Jaguar's home games to the
// visitor: the row's team is the opponent's code and its opponent_team is
// JAX (Brunell's 2001 week 1 reads PIT v JAX from PIT's side), so Brunell's
// page listed fifteen teams and his home results were the opponent's. The
// away games are right. A player is a Jaguar that season when any row of his
// says team JAX, or when every row of his faces JAX and the season before or
// after has him on JAX (Fred Taylor's two 2001 games were both at home). The
// swap applies only while the files still show the symptom (no JAX row in a
// JAX home game), so an upstream fix turns it off.
const SWAPPED = { JAX: [2001, 2002] }
const swapRows = new Set() // `${season}|${player_id}`: the player's rows facing the team that season are his own team's
for (const [team, seasons] of Object.entries(SWAPPED)) {
  const onTeam = new Map() // season -> Set of player ids with a row on the team
  const near = [...new Set(seasons.flatMap((s) => [s - 1, s, s + 1]))].filter((s) => s >= FIRST_SEASON && s <= CURRENT_SEASON && fs.existsSync(statFile(s)))
  const facing = new Map() // `${season}|${id}` -> [rows facing the team, rows in all]
  for (const s of near) {
    const ids = new Set()
    let homeRows = 0
    for (const r of readCsv(statFile(s))) {
      if (r.team === team) { ids.add(r.player_id); if (byGame.get(r.game_id)?.g.home_team === team) homeRows++ }
      if (!seasons.includes(s)) continue
      const k = `${s}|${r.player_id}`
      const f = facing.get(k) ?? [0, 0]
      f[1]++
      if (r.opponent_team === team) f[0]++
      facing.set(k, f)
    }
    onTeam.set(s, ids)
    if (seasons.includes(s) && homeRows > 0) { console.log(`${team} ${s}: ${homeRows} home rows on the team's side; the files are fixed upstream, no swap`); facing.clear() }
  }
  for (const s of seasons) {
    const own = onTeam.get(s) ?? new Set()
    const adjacent = new Set([...(onTeam.get(s - 1) ?? []), ...(onTeam.get(s + 1) ?? [])])
    for (const [k, [vs, all]] of facing) {
      const [season, id] = k.split('|')
      if (Number(season) !== s || vs === 0) continue
      if (own.has(id) || (vs === all && adjacent.has(id))) swapRows.add(k)
    }
    console.log(`${team} ${s}: ${[...swapRows].filter((k) => k.startsWith(`${s}|`)).length} players' home rows swapped to the team's side`)
  }
}

const players = new Map() // id -> { id, name, born, posCount, rows }
let dropped = 0
for (let s = FIRST_SEASON; s <= CURRENT_SEASON; s++) {
  const file = statFile(s)
  if (!fs.existsSync(file)) continue
  for (const r of readCsv(file)) {
    const grp = groupOf(r.position)
    if (!grp) continue
    if (SWAPPED[r.opponent_team]?.includes(s) && swapRows.has(`${s}|${r.player_id}`)) [r.team, r.opponent_team] = [r.opponent_team, r.team]
    const gm = byGame.get(r.game_id)
    if (!gm) { dropped++; continue }
    const { g, post, date } = gm
    const home = g.home_team === r.team
    const away = g.away_team === r.team
    if (!home && !away) { dropped++; continue }
    const own = Number(home ? g.home_score : g.away_score)
    const theirs = Number(home ? g.away_score : g.home_score)
    const result = own > theirs ? 2 : own < theirs ? 0 : 1
    const started = grp === 'QB' ? ((home ? g.home_qb_id : g.away_qb_id) === r.player_id ? 1 : 0) : -1
    const p = players.get(r.player_id) ?? (players.set(r.player_id, {
      id: r.player_id, name: r.player_display_name, born: people.get(r.player_id)?.birth_date || null,
      // the season the career began, which can be before the ledger (a career field leaves those out)
      debut: Number(people.get(r.player_id)?.rookie_season) || null, posCount: {}, rows: [],
    }), players.get(r.player_id))
    p.posCount[grp] = (p.posCount[grp] ?? 0) + 1
    p.rows.push([
      Number(r.season), Number(r.week), post, date, r.team, r.opponent_team, started, result, tgnOf.get(`${r.game_id}|${r.team}`) ?? 0,
      num(r.attempts), num(r.completions), num(r.passing_yards), num(r.passing_tds), num(r.passing_interceptions), num(r.sacks_suffered),
      num(r.carries), num(r.rushing_yards), num(r.rushing_tds), num(r.receptions), num(r.targets), num(r.receiving_yards), num(r.receiving_tds),
      num(r.fumbles_lost_total),
    ])
  }
}

const teams = [...new Set(games.flatMap((g) => [g.home_team, g.away_team]))].sort()
const ti = new Map(teams.map((t, i) => [t, i]))
const out = { QB: [], RB: [], WR: [], TE: [] }
for (const p of players.values()) {
  const grp = Object.entries(p.posCount).sort((a, b) => b[1] - a[1])[0][0]
  p.rows.sort((a, b) => a[3] - b[3] || a[1] - b[1])
  const rows = p.rows.map((r) => { const c = r.slice(); c[4] = ti.get(r[4]); c[5] = ti.get(r[5]) ?? -1; return c })
  out[grp].push({ id: p.id, name: p.name, born: p.born, debut: p.debut ?? rows[0][0], rows })
}
const builtAt = new Date().toISOString()
for (const grp of Object.keys(out)) {
  out[grp].sort((a, b) => b.rows.length - a.rows.length)
  const file = { v: 1, builtAt, firstSeason: FIRST_SEASON, currentSeason: CURRENT_SEASON, pos: grp, cols: COLS, teams, teamGames, players: out[grp] }
  const text = JSON.stringify(file)
  fs.writeFileSync(path.join(OUT, `${grp}.json`), text)
  console.log(`${grp}: ${out[grp].length} players, ${out[grp].reduce((n, p) => n + p.rows.length, 0)} rows, ${(text.length / 1024 / 1024).toFixed(1)}MB`)
}
console.log(`games ${byGame.size}, dropped rows ${dropped} (no game or team mismatch), built ${builtAt}`)
