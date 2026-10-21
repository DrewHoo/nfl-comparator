// The comparison: an open row read against a peer. The panel and the share
// worker both use it, so a shared link's card and head say what the panel
// shows. Pure: rows in, curves and words out.
import { crossings, curve, toMatch, type Board, type Crossing, type Query, type Row } from './query.ts'
import { countWords, statByKey } from './stats.ts'
import { headWords, queryWords, rankWords, rowWords, seqWords } from './words.ts'

/** the games ahead the "to match" line reads over */
export const K = 5

/** the peers a row can be read against: the rest of the board, forty at most */
export const peersOf = (board: Board, row: Row): Row[] => [...board.ranked, ...board.onTheWay].filter((r) => r.key !== row.key).slice(0, 40)

/** the peer a `vs` key names, else the first peer (the leader, or the next row) */
export const peerOf = (board: Board, row: Row, vs: string | null | undefined): Row | null => {
  const others = peersOf(board, row)
  return others.find((r) => r.key === vs) ?? others[0] ?? null
}

export interface Comparison {
  me: number[]
  them: number[]
  /** the last six crossings inside the window, latest first */
  xs: Crossing[]
  /** what the subject needs over the next K to match the peer there */
  match: { need: number; at: number } | null
  /** the chart's window */
  n: number
}

/** null for a player-season board or a test board: no curve to draw */
export function compare(row: Row, peer: Row, q: Query): Comparison | null {
  if (q.seq === 'teamGames' || q.how === 'every' || q.how === 'count' || q.how === 'streak') return null
  const cq = q.how === 'reach' ? { ...q, how: 'sum' as const } : q
  const me = curve(row.player, cq), them = curve(peer.player, cq)
  const xs = crossings(me, them).filter((c) => c.n <= Math.max(q.n, me.length)).slice(-6).reverse()
  const match = q.how === 'sum' ? toMatch(me.slice(0, Math.max(row.reached, Math.min(me.length, q.n))), them, K) : null
  const n = q.how === 'reach' ? Math.max(row.value ?? 0, peer.value ?? 0) : q.n
  return { me, them, xs, match, n }
}

/** "passed Tom Brady at start 112, 92 wins" */
export const crossingWords = (c: Crossing, peer: Row, q: Query) => `${c.kind} ${peer.player.name} at ${seqWords(q.seq, 1)} ${c.n}, ${countWords(c.value, statByKey(q.stat))}`

/** "To match Tom Brady's 116 wins at start 155, Patrick Mahomes needs 1 win over his next 5 starts." */
export function matchWords(row: Row, peer: Row, cmp: Comparison, q: Query): string | null {
  if (!cmp.match) return null
  const stat = statByKey(q.stat)
  const m = cmp.match
  return `To match ${peer.player.name}'s ${countWords(cmp.them[m.at - 1], stat)} at ${seqWords(q.seq, 1)} ${m.at}, ${row.player.name} needs ${countWords(Math.max(0, m.need), stat)} over his next ${K} ${seqWords(q.seq, K)}${m.need <= 0 ? ' (he is already past it)' : ''}.`
}

export interface ShareText { title: string; description: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const since = (q: Query) => (q.since ? `since ${q.since}` : 'since 1999')
const who = (q: Query) => (q.seq === 'teamGames' ? 'player-seasons' : 'careers')

/** a board's head: the query as the title, the leader as the description */
export function boardText(q: Query, board: Board, site: string): ShareText {
  const stat = statByKey(q.stat)
  const [a, b] = board.ranked
  const scope = q.scope === 'all' ? ', playoffs included' : ''
  const title = `${cap(headWords(q))}${scope} · ${site}`
  const lead = a && a.value != null ? `${a.player.name} leads with ${rowWords(a, q)}${b && b.value != null ? `; ${b.player.name} ${q.how === 'reach' ? `${b.value} ${seqWords(q.seq, b.value)}` : countWords(b.value, stat)}` : ''}. ` : ''
  return { title, description: `${lead}${cap(queryWords(q))}: ${board.ranked.length.toLocaleString('en-US')} ${who(q)} ${since(q)}.` }
}

/** a comparison's head: both names in the title, the claim and where they met in the description */
export function compareText(q: Query, board: Board, row: Row, peer: Row | null, site: string): ShareText {
  const field = board.ranked.length
  const claim = `${row.player.name} has ${rowWords(row, q)}${row.complete && row.value != null ? `, ${rankWords(row, field)} ${who(q)} ${since(q)}` : row.value == null ? '' : ', still inside the window'}.`
  if (!peer) return { title: `${row.player.name}: ${headWords(q)} · ${site}`, description: claim }
  const cmp = compare(row, peer, q)
  const met = cmp ? (cmp.xs[0] ? ` ${cap(crossingWords(cmp.xs[0], peer, q))}.` : ' Their curves never met.') : ''
  const match = cmp ? matchWords(row, peer, cmp, q) : null
  const peerClaim = peer.value == null ? '' : ` ${peer.player.name}: ${rowWords(peer, q)}.`
  return {
    title: `${row.player.name} vs ${peer.player.name}: ${headWords(q)} · ${site}`,
    description: `${claim}${peerClaim}${met}${match ? ` ${match}` : ''}`,
  }
}
