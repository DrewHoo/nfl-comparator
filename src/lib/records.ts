// Records: what a player leads. A shape is a query without its window; at
// every N the field is ranked and two things are read: who holds the record
// now (rank 1, ties included) and who set it as the field filled in (the
// running best, in the order the entities reached N). A player's leads are
// intervals of N, one row each, so "most wins through his first 150 starts"
// and "...151 starts" are the same row. The score is in bits, shaped like
// Streak King's crown score, and its weights are the knobs in RECORDS. A row
// carries the score's inputs, not the score, so a page (and the tuner)
// scores it with whatever knobs it has. specs/player-pages.spec.md is the
// method; the build (scripts/build-records.mjs) writes one file per player.

import type { Game, Ledger, Player, Pos } from './ledger.ts'
import { holds, items, type Dir, type How, type Query, type Scope, type Seq, type Test } from './query.ts'
import { statByKey, statsFor, type Stat, type StatKey } from './stats.ts'

/** a query without its window: the sentence with N left free */
export type Shape = Omit<Query, 'n'>

export type Kind = 'held' | 'set'

/** what a row needs to know about its player */
export type PlayerRef = Pick<Player, 'id' | 'name' | 'debut' | 'pos'>

export interface RecordRow {
  shape: Shape
  kind: Kind
  /** the entity: the player's id, or id:season for a player-season */
  key: string
  player: PlayerRef
  season: number | null
  team: string | null
  /** the interval of N the row covers (for reach, the milestone grid's index; `from` is the low milestone), and the N (or milestone) it is worded at */
  lo: number
  hi: number
  from?: number
  at: number
  /** the interval's length in games, what the hold term reads */
  len: number
  /** N inside the interval where the lead lapsed (merged over small gaps) */
  holes: number
  value: number
  second: number | null
  field: number
  ties: number
  /** the field's median and top-decile value at the worded N, the dominance unit */
  med: number
  q90: number
  /** the interval reaches the entity's current N and the player is active */
  live: boolean
  /** set: who broke it, at the worded N */
  breaker?: { name: string; season: number | null; value: number; date: number }
  score: number
  terms: Record<string, number>
  /** fancier or wordier rows folded under this one */
  folded: RecordRow[]
}

export type Tier = 'headline' | 'secondary' | 'trivia'

export interface Knobs {
  fieldFloor: number
  keepFloor: number
  admitTies: number
  minN: Record<Seq, number>
  gapTol: number
  depthW: number
  holdW: number
  domW: number
  leadW: number
  sizeW: number
  liveW: number
  setW: number
  seasonShare: number
  touches: number
  tiers: Record<Tier, number>
  words: { scopeAll: number; since: number; test: number; count: number; every: number; streak: number }
}

export const RECORDS: Knobs = {
  /** a field smaller than this ranks nothing */
  fieldFloor: 10,
  /** a row scoring under this at the shipped weights is never kept: the miner's own floor */
  keepFloor: 4,
  /** a tie group at rank 1 this large or smaller is a lead ("one of four") */
  admitTies: 4,
  /** an interval that starts under this N is early-career noise */
  minN: { games: 8, starts: 8, seasons: 1, teamGames: 3 },
  /** N inside an interval where the lead lapsed are bridged when this few in a row */
  gapTol: 2,
  /** bits per doubling of the window's depth in games (a season counts 17) */
  depthW: 1,
  /** bits per doubling of the interval's length in games */
  holdW: 1.5,
  /** per doubling of the gap above the field's median, in top-decile units */
  domW: 2,
  /** per doubling of the gap over second place, in top-decile units */
  leadW: 2,
  /** bits per doubling of a count or streak's value in games */
  sizeW: 1,
  /** a lead still growing */
  liveW: 3,
  /** a record since broken */
  setW: -3,
  /** a player-season is in the field at N when the player started (QB) this share of the team's first N games, or averaged `touches` carries + targets over them */
  seasonShare: 0.5,
  touches: 5,
  /** how a stat site ranks the stat: the leaders page, a secondary table, a split */
  tiers: { headline: 0, secondary: 2, trivia: 6 },
  /** what a claim costs to say */
  words: { scopeAll: 1, since: 3, test: 1, count: 1, every: 1, streak: 3 },
}

/** the knobs a tuner turns: the weights, flat, keyed by path */
export const KNOB_PATHS = ['depthW', 'holdW', 'domW', 'leadW', 'sizeW', 'liveW', 'setW', 'tiers.secondary', 'tiers.trivia', 'words.scopeAll', 'words.test', 'words.count', 'words.every', 'words.streak'] as const

export function withKnob(k: Knobs, path: string, value: number): Knobs {
  const out = { ...k, tiers: { ...k.tiers }, words: { ...k.words } } as Knobs & Record<string, unknown>
  const [a, b] = path.split('.')
  if (b) (out[a] as Record<string, number>)[b] = value
  else out[a] = value
  return out
}
export const knobAt = (k: Knobs, path: string): number => {
  const [a, b] = path.split('.')
  const v = (k as unknown as Record<string, unknown>)[a]
  return b ? (v as Record<string, number>)[b] : (v as number)
}

export function tier(stat: StatKey, pos: Pos): Tier {
  const head: Partial<Record<Pos, StatKey[]>> = {
    QB: ['win', 'payds', 'patd', 'offtd'],
    RB: ['ruyds', 'rutd', 'scrimyds', 'scrtd'],
    WR: ['rec', 'reyds', 'retd', 'scrimyds'],
    TE: ['rec', 'reyds', 'retd', 'scrimyds'],
  }
  if (head[pos]?.includes(stat)) return 'headline'
  if (['att', 'tgt', 'car'].includes(stat)) return pos === 'RB' && stat === 'car' ? 'secondary' : 'trivia'
  return 'secondary'
}

/** the direction a fan wants: fewest of a bad thing */
export const goodDir = (stat: StatKey): Dir => (['int', 'sacked', 'giveaways', 'fumlost', 'loss'].includes(stat) ? 'fewest' : 'most')

const TICK: Partial<Record<StatKey, number>> = { win: 10, payds: 1000, patd: 10, cmp: 100, att: 100, offtd: 10, car: 100, ruyds: 500, rutd: 10, rec: 50, tgt: 50, reyds: 500, retd: 10, scrtd: 10, scrimyds: 500, alltd: 10 }
export const hasMilestones = (stat: StatKey) => TICK[stat] != null

/** the milestone grid a reach counts to, up to `max`: 1, 2.5, 5, 7.5 × the tick, then every 5 ticks */
export function milestones(stat: StatKey, max: number): number[] {
  const t = TICK[stat]
  if (!t) return []
  const out = [1, 2.5, 5, 7.5].map((x) => x * t)
  for (let m = 10 * t; m <= max; m += 5 * t) out.push(m)
  return out.filter((m) => m <= max)
}

/** how much a window's number costs to say: a round N is free */
export function roundCost(n: number, seq: Seq): number {
  if (seq === 'seasons') return [1, 2, 3, 5, 10, 15, 20].includes(n) ? 0 : 1
  if (seq === 'teamGames') return 0
  if (n % 100 === 0) return 0
  if (n % 50 === 0) return 0.5
  if (n % 25 === 0 || n % 10 === 0) return 1
  if (n % 5 === 0) return 2
  return 3
}

/** the shapes the mine walks for a position */
export function shapesFor(pos: Pos): Shape[] {
  const out: Shape[] = []
  const seqs: Seq[] = pos === 'QB' ? ['starts', 'games', 'seasons'] : ['games', 'seasons']
  const scopes: Scope[] = ['reg', 'all']
  const base = { pos, since: null }
  for (const s of statsFor(pos)) {
    if (s.key === 'loss') continue
    const dir = goodDir(s.key)
    for (const scope of scopes) {
      for (const seq of [...seqs, 'teamGames' as Seq]) {
        // "through the team's first 19 games, playoffs included" is a claim nobody makes
        if (seq === 'teamGames' && scope === 'all') continue
        // a fewest-of-a-bad-thing total needs the player to have played: starts only
        if (dir === 'most' || seq === 'starts') out.push({ ...base, stat: s.key, tests: [], how: 'sum', seq, scope, dir })
        // a season item passing a per-game test means one game of it did: seasons take sums only
        if (seq === 'seasons') continue
        for (const how of ['count', 'every', 'streak'] as How[]) {
          for (const min of s.thresholds) {
            // games with a win are wins
            if (how === 'count' && s.key === 'win') continue
            const test: Test = dir === 'fewest' && min === 0 ? { stat: s.key, min: 0, max: 0 } : { stat: s.key, min }
            if (dir === 'fewest' && min !== 0) continue
            out.push({ ...base, stat: s.key, tests: [test], how, seq, scope, dir: 'most' })
          }
        }
      }
      if (dir === 'most' && hasMilestones(s.key)) for (const seq of seqs.filter((x) => x !== 'seasons')) out.push({ ...base, stat: s.key, tests: [], how: 'reach', seq, scope, dir: 'fewest' })
    }
  }
  return out
}

/** one entity's values along the sequence: v[i] at N = i + 1, the date it got there, whether the window is whole */
interface Series { key: string; player: Player; season: number | null; team: string | null; v: number[]; date: number[]; ok: boolean[]; active: boolean }

function walk(groups: Game[][], shape: Shape, stat: Stat): { v: number[]; date: number[] } {
  const v: number[] = [], date: number[] = []
  let cum = 0, run = 0, best = 0
  for (const it of groups) {
    if (shape.how === 'sum') for (const g of it) cum += stat.read(g)
    else {
      const f = it.some((g) => holds(g, shape.tests, shape.pos))
      if (shape.how === 'streak') { run = f ? run + 1 : 0; if (run > best) best = run; cum = best }
      else cum += f ? 1 : 0
    }
    v.push(cum)
    date.push(it[it.length - 1]?.date ?? date[date.length - 1] ?? 0)
  }
  return { v, date }
}

function seriesOf(ledger: Ledger, shape: Shape, grid: number[], k: Knobs): Series[] {
  const stat = statByKey(shape.stat)
  const out: Series[] = []
  for (const p of ledger.players) {
    const active = p.games[p.games.length - 1]?.season === ledger.currentSeason
    if (shape.seq === 'teamGames') {
      const by = new Map<number, Game[]>()
      for (const g of p.games) if (shape.scope === 'all' || !g.post) (by.get(g.season) ?? by.set(g.season, []).get(g.season)!).push(g)
      for (const [season, gs] of by) {
        const team = gs[0].team
        const played = ledger.teamGames[team]?.[season]?.[shape.scope === 'reg' ? 0 : 1] ?? 0
        if (!played) continue
        const own = gs.filter((g) => g.team === team && g.tgn >= 1 && g.tgn <= played)
        const slots: Game[][] = Array.from({ length: played }, () => [])
        for (const g of own) slots[g.tgn - 1].push(g)
        const w = walk(slots, shape, stat)
        let last = season * 10000 + 901, seen = 0
        const date = slots.map((s) => (s.length ? (last = s[s.length - 1].date) : last))
        // in the field once he has played the window: started half of it (QB), or averaged the touches
        const ok = slots.map((s, i) => {
          seen += ledger.pos === 'QB' ? (s.some((g) => g.started) ? 1 : 0) : s.reduce((t, g) => t + g.car + g.tgt, 0)
          return seen >= (ledger.pos === 'QB' ? Math.ceil((i + 1) * k.seasonShare) : (i + 1) * k.touches)
        })
        out.push({ key: `${p.id}:${season}`, player: p, season, team, v: w.v, date, ok, active: season === ledger.currentSeason })
      }
      continue
    }
    if (p.debut < ledger.firstSeason) continue
    const groups = items(p, shape)
    if (!groups.length) continue
    if (shape.how === 'reach') {
      let cum = 0
      const v: number[] = [], date: number[] = [], ok: boolean[] = []
      let gi = 0
      for (let i = 0; i < groups.length && gi < grid.length; i++) {
        for (const g of groups[i]) cum += stat.read(g)
        while (gi < grid.length && cum >= grid[gi]) { v.push(i + 1); date.push(groups[i][groups[i].length - 1].date); ok.push(true); gi++ }
      }
      if (!v.length) continue
      out.push({ key: p.id, player: p, season: null, team: null, v, date, ok, active })
      continue
    }
    const w = walk(groups, shape, stat)
    const ok = shape.seq === 'seasons' ? groups.map((it) => it[0].season < ledger.currentSeason) : w.v.map(() => true)
    out.push({ key: p.id, player: p, season: null, team: null, v: w.v, date: w.date, ok, active })
  }
  return out
}

interface Mark { value: number; second: number | null; field: number; ties: number; med: number; q90: number; breaker?: RecordRow['breaker'] }

/** maximal runs of N, bridging gaps of up to gapTol */
function intervals(ns: number[], gapTol: number): { lo: number; hi: number; holes: number }[] {
  const out: { lo: number; hi: number; holes: number }[] = []
  for (const n of ns) {
    const last = out[out.length - 1]
    if (last && n - last.hi - 1 <= gapTol) { last.holes += n - last.hi - 1; last.hi = n }
    else out.push({ lo: n, hi: n, holes: 0 })
  }
  return out
}

const unitOf = (stat: StatKey) => (['payds', 'ruyds', 'reyds', 'scrimyds'].includes(stat) ? 50 : 1)

/** the score's terms from the row's inputs, under the knobs; the sum is the score */
export function scoreRow(row: Omit<RecordRow, 'score' | 'terms' | 'folded'>, k: Knobs): { score: number; terms: Record<string, number> } {
  const s = row.shape
  const sign = s.dir === 'most' ? 1 : -1
  const unit = s.how === 'sum' ? unitOf(s.stat) : 1
  const scale = Math.max((row.q90 - row.med) * sign, unit)
  const terms: Record<string, number> = {}
  terms.field = Math.log2(row.field)
  terms.depth = k.depthW * Math.log2(Math.max(1, s.how === 'reach' ? row.value : s.seq === 'seasons' ? row.at * 17 : row.at))
  terms.hold = k.holdW * Math.log2(row.len)
  terms.dominance = k.domW * Math.log2(1 + Math.max(0, ((row.value - row.med) * sign) / scale))
  terms.lead = row.second == null ? 0 : k.leadW * Math.log2(1 + Math.max(0, ((row.value - row.second) * sign) / scale))
  if (s.how === 'count' || s.how === 'streak') terms.size = k.sizeW * Math.log2(Math.max(1, row.value))
  terms.tier = -k.tiers[tier(s.stat, s.pos)]
  let words = 0
  if (s.scope === 'all') words += k.words.scopeAll
  if (s.since != null) words += k.words.since
  if (s.how === 'count' || s.how === 'every' || s.how === 'streak') words += k.words[s.how] + k.words.test * s.tests.length
  if (s.how !== 'reach') words += roundCost(row.at, s.seq)
  terms.words = -words
  if (row.live) terms.live = k.liveW
  if (row.kind === 'set') terms.set = k.setW
  return { score: Object.values(terms).reduce((a, b) => a + b, 0), terms }
}

/** the rows scored again under other knobs (a page with the tuner open) */
export const rescore = (rows: RecordRow[], k: Knobs): RecordRow[] => rows.map((r) => ({ ...r, ...scoreRow(r, k), folded: [] }))

/** every held and set row of one shape, for every entity */
export function mineShape(ledger: Ledger, shape: Shape, k = RECORDS): RecordRow[] {
  // the grid stops at the biggest career total in the ledger
  const stat = statByKey(shape.stat)
  const grid = shape.how === 'reach' ? milestones(shape.stat, Math.max(0, ...ledger.players.map((p) => p.games.reduce((t, g) => t + (shape.scope === 'all' || !g.post ? stat.read(g) : 0), 0)))) : []
  const series = seriesOf(ledger, shape, grid, k)
  if (series.length < k.fieldFloor) return []
  const maxN = Math.max(...series.map((s) => s.v.length))
  const sign = shape.dir === 'most' ? 1 : -1
  const held = new Map<string, Map<number, Mark>>()
  const set = new Map<string, Map<number, Mark>>()
  const put = (m: Map<string, Map<number, Mark>>, key: string, n: number, mark: Mark) => (m.get(key) ?? m.set(key, new Map()).get(key)!).set(n, mark)
  const inField = (s: Series, n: number) => s.v.length >= n && s.ok[n - 1]
  for (let n = 1; n <= maxN; n++) {
    const rows = series.filter((s) => inField(s, n)).map((s) => ({ s, good: s.v[n - 1] * sign }))
    if (rows.length < k.fieldFloor) continue
    rows.sort((a, b) => b.good - a.good)
    const top = rows[0].good
    // "each of" is a claim only when the count is the whole window
    if (shape.how === 'every' && top !== n) continue
    let ties = 0
    while (ties < rows.length && rows[ties].good === top) ties++
    const second = ties < rows.length ? rows[ties].good * sign : null
    const med = rows[Math.floor(rows.length / 2)].good * sign
    const q90 = rows[Math.floor(rows.length * 0.1)].good * sign
    const base = { second, field: rows.length, ties, med, q90 }
    if (ties <= k.admitTies) for (let i = 0; i < ties; i++) put(held, rows[i].s.key, n, { value: rows[i].s.v[n - 1], ...base })
    // who set it: the running best as the entities reached N
    const byDate = [...rows].sort((a, b) => a.s.date[n - 1] - b.s.date[n - 1])
    let best = -Infinity, holderMark: Mark | null = null
    for (let i = 0; i < byDate.length; i++) {
      const r = byDate[i]
      if (r.good > best) {
        if (holderMark) holderMark.breaker = { name: r.s.player.name, season: r.s.season, value: r.s.v[n - 1], date: r.s.date[n - 1] }
        best = r.good
        holderMark = { value: r.s.v[n - 1], second: holderMark ? holderMark.value : null, field: i + 1, ties: 1, med, q90 }
        put(set, r.s.key, n, holderMark)
      }
    }
  }
  const out: RecordRow[] = []
  const byKey = new Map(series.map((s) => [s.key, s]))
  const ref = (p: Player): PlayerRef => ({ id: p.id, name: p.name, debut: p.debut, pos: p.pos })
  const emit = (kind: Kind, key: string, marks: Map<number, Mark>, skip?: Map<number, Mark>) => {
    const s = byKey.get(key)!
    const ns = [...marks.keys()].filter((n) => !skip?.has(n)).sort((a, b) => a - b)
    for (const iv of intervals(ns, k.gapTol)) {
      if (iv.lo < k.minN[shape.seq] && shape.how !== 'reach') continue
      const lastN = s.ok.lastIndexOf(true) + 1
      const live = s.active && iv.hi >= lastN
      const len = shape.how === 'reach' ? Math.max(1, s.v[iv.hi - 1] - s.v[iv.lo - 1] + 1) : iv.hi - iv.lo + 1
      const rowAt = (at: number): RecordRow => {
        const m = marks.get(at)!
        const row: Omit<RecordRow, 'score' | 'terms' | 'folded'> = {
          shape, kind, key, player: ref(s.player), season: s.season, team: s.team, lo: iv.lo, hi: iv.hi, holes: iv.holes, len,
          at: shape.how === 'reach' ? grid[at - 1] : at, from: shape.how === 'reach' ? grid[iv.lo - 1] : undefined,
          value: m.value, second: m.second, field: m.field, ties: m.ties, med: m.med, q90: m.q90, live, breaker: kind === 'set' ? m.breaker : undefined,
        }
        return { ...row, ...scoreRow(row, k), folded: [] }
      }
      // the row is worded at the N where it scores best; a live lead and an "each of" at its current edge
      let best: RecordRow | null = null
      if (shape.how === 'every' || shape.how === 'reach' || live) best = rowAt(iv.hi)
      else for (let n = iv.lo; n <= iv.hi; n++) { if (!marks.has(n) || skip?.has(n)) continue; const r = rowAt(n); if (!best || r.score > best.score) best = r }
      if (best) out.push(best)
    }
  }
  for (const [key, marks] of held) emit('held', key, marks)
  for (const [key, marks] of set) emit('set', key, marks, held.get(key))
  return out
}

/** every row of every shape, above the keep floor */
export function mine(ledger: Ledger, shapes = shapesFor(ledger.pos), k = RECORDS): RecordRow[] {
  const out: RecordRow[] = []
  for (const shape of shapes) out.push(...mineShape(ledger, shape, k).filter((r) => r.score >= k.keepFloor))
  return out
}

export const testsKey = (tests: Test[]) => tests.map((t) => `${t.stat}:${t.min}${t.max != null ? `-${t.max}` : ''}`).join(',')
/** the claim's identity without its wording choices (scope, games vs starts) */
const claimKey = (r: RecordRow) => [r.kind, r.key, r.shape.how, r.shape.stat, testsKey(r.shape.tests), r.shape.dir, r.shape.seq === 'teamGames' ? 'season' : r.shape.seq === 'seasons' ? 'seasons' : 'career'].join('|')
const plainness = (r: RecordRow, pos: Pos) => (r.shape.scope === 'all' ? 1 : 0) + (r.shape.seq === (pos === 'QB' ? 'starts' : 'games') || r.shape.seq === 'seasons' || r.shape.seq === 'teamGames' ? 0 : 1)

/** one row per claim: the plainest wording stands, and a fancier one folds under it when its interval is inside */
export function collapse(rows: RecordRow[], pos: Pos): RecordRow[] {
  const groups = new Map<string, RecordRow[]>()
  for (const r of rows) (groups.get(claimKey(r)) ?? groups.set(claimKey(r), []).get(claimKey(r))!).push(r)
  const out: RecordRow[] = []
  for (const g of groups.values()) {
    g.sort((a, b) => plainness(a, pos) - plainness(b, pos) || b.score - a.score)
    const kept: RecordRow[] = []
    for (const r of g) {
      const under = kept.find((k) => { const tol = Math.max(3, 0.1 * (k.hi - k.lo + 1)); return r.lo >= k.lo - tol && r.hi <= k.hi + tol })
      if (under) under.folded.push(r)
      else kept.push(r)
    }
    out.push(...kept)
  }
  return out
}

/** the stat a row is about: a test's stat, or the sum's */
export const statOf = (r: RecordRow): StatKey => r.shape.tests[0]?.stat ?? r.shape.stat
/** the family a page groups by: the stat and the entity kind */
export const family = (r: RecordRow) => `${statOf(r)}|${r.season != null ? 'season' : 'career'}`

/** a derived stat's parts: a row under it that says the same number as a row under a part says nothing new */
export const COMPONENTS: Partial<Record<StatKey, StatKey[]>> = { offtd: ['patd', 'rutd'], alltd: ['offtd', 'scrtd', 'patd', 'rutd', 'retd'], scrtd: ['rutd', 'retd'], scrimyds: ['ruyds', 'reyds'], giveaways: ['int', 'fumlost'] }

export interface Family { key: string; best: RecordRow; rest: RecordRow[] }

const overlaps = (x: RecordRow, r: RecordRow) => x.lo <= r.hi && r.lo <= x.hi
/** the same number over the same stretch of the same sequence, under another stat or verb */
const sameClaim = (x: RecordRow, r: RecordRow) => x.kind === r.kind && x.season === r.season && x.value === r.value && overlaps(x, r) && x.shape.seq === r.shape.seq

/** a player's page: his rows, collapsed, grouped by family, the families by their best row */
export function page(rows: RecordRow[], playerId: string, pos: Pos): Family[] {
  const mine = collapse(rows.filter((r) => r.player.id === playerId), pos)
  // a derived stat's row folds under its part's row when they say the same number
  const kept = new Set(mine)
  for (const r of mine.filter((r) => COMPONENTS[statOf(r)])) {
    const part = mine.find((x) => kept.has(x) && x !== r && COMPONENTS[statOf(r)]!.includes(statOf(x)) && sameClaim(x, r) && x.shape.how === r.shape.how && testsKey(x.shape.tests).replace(statOf(x), '') === testsKey(r.shape.tests).replace(statOf(r), ''))
    if (part) { part.folded.push(r); kept.delete(r) }
  }
  const fams = new Map<string, RecordRow[]>()
  for (const r of mine) if (kept.has(r)) (fams.get(family(r)) ?? fams.set(family(r), []).get(family(r))!).push(r)
  const out: Family[] = []
  for (const [key, rs] of fams) {
    rs.sort((a, b) => b.score - a.score)
    // the same number at the same N under another verb (14 wins, won each of 14, 14 straight) is one claim
    const faces: RecordRow[] = []
    for (const r of rs) {
      const same = faces.find((x) => sameClaim(x, r))
      if (same) same.folded.push(r)
      else faces.push(r)
    }
    out.push({ key, best: faces[0], rest: faces.slice(1) })
  }
  return out.sort((a, b) => b.best.score - a.best.score)
}

// ---- the file: one per player, the rows' inputs and no score

export const FILE_VERSION = 2

export interface FileRow {
  /** the shape without pos and since: [stat, tests, how, seq, scope, dir] */
  s: [StatKey, string, How, Seq, Scope, Dir]
  k: Kind
  n: number | null
  tm: string | null
  lo: number
  hi: number
  fr?: number
  at: number
  len: number
  ho: number
  v: number
  v2: number | null
  f: number
  t: number
  md: number
  q9: number
  lv?: 1
  b?: [string, number | null, number, number]
}

export interface PlayerFile {
  v: number
  id: string
  name: string
  pos: Pos
  born: string | null
  debut: number
  from: number
  to: number
  teams: string[]
  games: number
  active: boolean
  rows: FileRow[]
}

const parseTests = (s: string): Test[] => (s ? s.split(',').map((x) => { const m = /^([a-z]+):(-?\d+)(?:-(\d+))?$/.exec(x)!; return m[3] == null ? { stat: m[1] as StatKey, min: Number(m[2]) } : { stat: m[1] as StatKey, min: Number(m[2]), max: Number(m[3]) } }) : [])

export function encodePlayer(p: Player, rows: RecordRow[], currentSeason: number): PlayerFile {
  const teams = [...new Set(p.games.map((g) => g.team))]
  return {
    v: FILE_VERSION, id: p.id, name: p.name, pos: p.pos, born: p.born, debut: p.debut,
    from: p.games[0].season, to: p.games[p.games.length - 1].season, teams, games: p.games.length, active: p.games[p.games.length - 1].season === currentSeason,
    rows: rows.map((r) => {
      const o: FileRow = {
        s: [r.shape.stat, testsKey(r.shape.tests), r.shape.how, r.shape.seq, r.shape.scope, r.shape.dir], k: r.kind, n: r.season, tm: r.team,
        lo: r.lo, hi: r.hi, at: r.at, len: r.len, ho: r.holes, v: r.value, v2: r.second, f: r.field, t: r.ties, md: r.med, q9: r.q90,
      }
      if (r.from != null) o.fr = r.from
      if (r.live) o.lv = 1
      if (r.breaker) o.b = [r.breaker.name, r.breaker.season, r.breaker.value, r.breaker.date]
      return o
    }),
  }
}

/** the file's rows as the page scores them, under the knobs */
export function decodePlayer(file: PlayerFile, k = RECORDS): RecordRow[] {
  if (file.v !== FILE_VERSION) throw new Error(`player file v${file.v}, expected v${FILE_VERSION}`)
  const player: PlayerRef = { id: file.id, name: file.name, debut: file.debut, pos: file.pos }
  return file.rows.map((o) => {
    const row: Omit<RecordRow, 'score' | 'terms' | 'folded'> = {
      shape: { pos: file.pos, stat: o.s[0], tests: parseTests(o.s[1]), how: o.s[2], seq: o.s[3], scope: o.s[4], since: null, dir: o.s[5] },
      kind: o.k, key: o.n != null ? `${file.id}:${o.n}` : file.id, player, season: o.n, team: o.tm,
      lo: o.lo, hi: o.hi, from: o.fr, at: o.at, len: o.len, holes: o.ho, value: o.v, second: o.v2, field: o.f, ties: o.t, med: o.md, q90: o.q9, live: o.lv === 1,
      breaker: o.b ? { name: o.b[0], season: o.b[1], value: o.b[2], date: o.b[3] } : undefined,
    }
    return { ...row, ...scoreRow(row, k), folded: [] }
  })
}
