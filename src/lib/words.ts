// The words of a query and of a row: the sentence the pickers sit in, the
// claim a row makes. Pure, so the prerender, the panel and a share card say
// the same thing.
import { fmtDate, type Pos } from './ledger.ts'
import type { Query, Row, Seq, Test } from './query.ts'
import { countWords, statByKey } from './stats.ts'

export const POS_WORDS: Record<Pos, string> = { QB: 'quarterbacks', RB: 'running backs', WR: 'receivers', TE: 'tight ends' }

/** the sequence's noun, plural: "starts", "games", "seasons", "team games of a season" */
export function seqWords(seq: Seq, n: number): string {
  if (seq === 'starts') return n === 1 ? 'start' : 'starts'
  if (seq === 'seasons') return n === 1 ? 'season' : 'seasons'
  if (seq === 'teamGames') return `${n === 1 ? 'game' : 'games'} of a season`
  return n === 1 ? 'game' : 'games'
}

/** "280+ passing yards", "no interceptions thrown", "a passing TD" */
export function testWords(t: Test): string {
  const s = statByKey(t.stat)
  if (t.max === 0 && t.min === 0) return `no ${s.noun}`
  if (t.max != null) return `${t.min}–${t.max} ${s.noun}`
  if (t.min === 1 && s.key !== 'win' && s.key !== 'loss') return `a ${s.one}`
  if (s.key === 'win') return 'a win'
  if (s.key === 'loss') return 'a loss'
  return `${t.min}+ ${s.noun}`
}

export const testsWords = (tests: Test[]) => tests.map(testWords).join(' and ')

/** "their first 150 starts" / "their team's first 5 games of a season" */
export function windowWords(q: Query): string {
  if (q.seq === 'teamGames') return `their team's first ${q.n} ${seqWords(q.seq, q.n)}`
  return `their first ${q.n} ${seqWords(q.seq, q.n)}`
}

/** the whole sentence, for a title or a card */
export function queryWords(q: Query): string {
  const who = POS_WORDS[q.pos]
  const stat = statByKey(q.stat)
  const era = q.since ? ` since ${q.since}` : ''
  const scope = q.scope === 'all' ? ', playoffs included' : ''
  if (q.how === 'sum') return `${who} with the ${q.dir} ${stat.noun} through ${windowWords(q)}${scope}${era}`
  if (q.how === 'reach') return `${who} ${q.dir === 'fewest' ? 'fastest' : 'slowest'} to ${countWords(q.n, stat)}, by ${seqWords(q.seq, 2)}${scope}${era}`
  const t = testsWords(q.tests)
  if (q.how === 'every') return `${who} with ${t} in each of ${windowWords(q)}${scope}${era}`
  if (q.how === 'streak') return `${who} with the longest streak of games with ${t} in ${windowWords(q)}${scope}${era}`
  return `${who} with the ${q.dir} games with ${t} in ${windowWords(q)}${scope}${era}`
}

const ord = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]) }

/** a player's name with the season for a player-season row */
export const rowName = (r: Row) => (r.season != null ? `${r.player.name} (${r.season} ${r.team})` : r.player.name)

/** the row's claim: "115 wins through his first 150 starts, playoffs included" */
export function rowWords(r: Row, q: Query): string {
  const stat = statByKey(q.stat)
  const scope = q.scope === 'all' ? ', playoffs included' : ''
  const win = r.season != null ? `${r.team}'s first ${q.n} games of ${r.season}` : `${r.complete ? 'his first' : 'his'} ${r.reached} ${seqWords(q.seq, r.reached)}`
  if (r.value == null) return `${r.reached} ${seqWords(q.seq, r.reached)} and still short of ${countWords(q.n, stat)}`
  if (q.how === 'sum') return `${countWords(r.value, stat)} through ${win}${scope}`
  if (q.how === 'reach') return `${countWords(q.n, stat)} in ${r.value} ${seqWords(q.seq, r.value)}${scope}`
  const t = testsWords(q.tests)
  if (q.how === 'every') return r.all ? `${t} in each of ${win}${scope}` : `${t} in ${r.value} of ${win}${scope}`
  if (q.how === 'streak') return `${r.value} straight ${r.value === 1 ? 'game' : 'games'} with ${t} in ${win}${scope}`
  return `${r.value} ${r.value === 1 ? 'game' : 'games'} with ${t} in ${win}${scope}`
}

/** "1st of 212", "T-3rd of 212" */
export const rankWords = (r: Row, field: number) => `${r.tied ? 'T-' : ''}${ord(r.rank)} of ${field}`

// ---- a record row (src/lib/records.ts): the claim, its place, its run

import type { RecordRow } from './records.ts'

/** "39 games with 10+ carries in his first 140 starts", "250 receptions in 36 games", "14 rushing TDs through CAR's first 15 games of 2011" */
export function recordWords(r: RecordRow): string {
  const s = r.shape, stat = statByKey(s.stat)
  const win = s.seq === 'teamGames' ? `${r.team}'s first ${r.at} games of ${r.season}` : `his first ${r.at} ${seqWords(s.seq, r.at)}`
  const scope = s.scope === 'all' ? ', playoffs included' : ''
  if (s.how === 'sum') return `${countWords(r.value, stat)} through ${win}${scope}`
  if (s.how === 'reach') return `${countWords(r.at, stat)} in ${r.value} ${seqWords(s.seq, r.value)}${scope}`
  const t = testsWords(s.tests)
  if (s.how === 'every') return `${t} in each of ${win}${scope}`
  if (s.how === 'streak') return `${r.value} straight ${r.value === 1 ? 'game' : 'games'} with ${t} in ${win}${scope}`
  return `${r.value} ${r.value === 1 ? 'game' : 'games'} with ${t} in ${win}${scope}`
}

/** "1st of 23, next 15", "one of 4 of 957", "a record at the time, 1st of 154" */
export function placeWords(r: RecordRow): string {
  const stat = statByKey(r.shape.stat)
  const fmt = (v: number) => (r.shape.how === 'reach' ? `${v} ${seqWords(r.shape.seq, v)}` : r.shape.how === 'sum' ? countWords(v, stat) : String(v))
  const who = r.season != null ? 'player-seasons' : 'careers'
  if (r.kind === 'set') return `a record when he got there, 1st of ${r.field.toLocaleString('en-US')} ${who}${r.second != null ? `, past ${fmt(r.second)}` : ''}`
  if (r.ties > 1) return `one of ${r.ties}, of ${r.field.toLocaleString('en-US')} ${who}`
  return `1st of ${r.field.toLocaleString('en-US')} ${who}${r.second != null ? `, next ${fmt(r.second)}` : ''}`
}

/** "leads from start 112 to 144", "fastest to every milestone from 500 to 5,000", "at game 14 only", "and counting" */
export function runWords(r: RecordRow, minN: number): string {
  const s = r.shape, stat = statByKey(s.stat)
  const unit = s.seq === 'teamGames' ? 'game' : seqWords(s.seq, 1)
  if (s.how === 'reach') return r.lo === r.hi ? '' : `fastest to every milestone from ${(r.from ?? r.at).toLocaleString('en-US')} to ${countWords(r.at, stat)}`
  const verb = r.kind === 'set' ? 'held' : 'leads'
  const holes = r.holes ? ` (${r.holes} ${r.holes === 1 ? 'gap' : 'gaps'})` : ''
  if (r.lo === r.hi) return `at ${unit} ${r.at} only`
  const from = r.lo <= minN ? 'from the start' : `from ${unit} ${r.lo}`
  return r.live ? `${verb} ${from}, and counting${holes}` : `${verb} ${from} to ${r.hi}${holes}`
}

/** "broken by Jalen Hurts 2023 (15, Dec 25, 2023)" */
export function breakerWords(r: RecordRow): string {
  if (!r.breaker) return ''
  const stat = statByKey(r.shape.stat)
  const v = r.shape.how === 'sum' ? countWords(r.breaker.value, stat) : String(r.breaker.value)
  return `broken by ${r.breaker.name}${r.breaker.season ? ` ${r.breaker.season}` : ''}, ${v}, ${fmtDate(r.breaker.date)}`
}
