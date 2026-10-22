// The words a shared address carries: a board's title and description, a
// comparison's, a player page's lead. Pure, so the share worker
// (workers/share), the share button, the tab title and the prerender all
// say the same thing. WNBA Comparator has the same module under the same
// name; the comparison itself (curves, crossings, the to-match line) is
// compare.ts.
import type { Board, Query, Row } from './query.ts'
import type { RecordRow } from './records.ts'
import type { Pos } from './ledger.ts'
import { compare, crossingWords, matchWords } from './compare.ts'
import { countWords, statByKey } from './stats.ts'
import { headWords, placeWords, queryWords, rankWords, recordWords, rowWords, searchWords, seqWords, POS_WORDS } from './words.ts'
import { landingOf, landingTitle } from './landing.ts'
import { DEFAULT_QUERY } from './query.ts'

export const SITE = 'NFL Comparator'

export interface ShareText { title: string; description: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const since = (q: Query, board: Board) => `since ${q.since ?? board.since}`
const who = (q: Query) => (q.seq === 'teamGames' ? 'player-seasons' : 'careers')

/** the root page's title: the default board's head term, then what the site is */
export const rootTitle = (site = SITE) => `${cap(searchWords(DEFAULT_QUERY))}, and every NFL player at the same point in his career · ${site}`

/** "Quarterbacks with the most wins through their first 150 starts · NFL Comparator" */
export const shareTitle = (q: Query) => `${cap(queryWords(q))} · ${SITE}`

/** the row's claim as one sentence: "Patrick Mahomes has 115 wins through his first 150 starts, 2nd of 93 careers since 1999." */
export function claimWords(q: Query, board: Board, row: Row): string {
  const tail = row.complete && row.value != null ? `, ${rankWords(row, board.ranked.length)} ${who(q)} ${since(q, board)}` : row.value == null ? '' : ', still inside the window'
  return `${row.player.name} has ${rowWords(row, q)}${tail}.`
}

/** what the share button sends with the board's address: the open row's claim, else the sentence */
export const shareText = (q: Query, board: Board | null, row: Row | null) => (board && row ? claimWords(q, board, row) : `${cap(queryWords(q))}.`)

/** a board's head: the query as the title (a named board's, when it has a page), the leader as the description */
export function boardText(q: Query, board: Board, site = SITE): ShareText {
  const stat = statByKey(q.stat)
  const [a, b] = board.ranked
  const scope = q.scope === 'all' ? ', playoffs included' : ''
  const landing = landingOf(q)
  const title = `${landing ? landingTitle(landing, board.since) : `${cap(headWords(q))}${scope}`} · ${site}`
  const lead = a && a.value != null ? `${a.player.name} leads with ${rowWords(a, q)}${b && b.value != null ? `; ${b.player.name} ${q.how === 'reach' ? `${b.value} ${seqWords(q.seq, b.value)}` : countWords(b.value, stat)}` : ''}. ` : ''
  return { title, description: `${lead}${cap(queryWords(q))}: ${board.ranked.length.toLocaleString('en-US')} ${who(q)} ${since(q, board)}.` }
}

/** a comparison's head: both names in the title, the claim and where they met in the description */
export function compareText(q: Query, board: Board, row: Row, peer: Row | null, site = SITE): ShareText {
  const claim = claimWords(q, board, row)
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

/** a player page's lead line: his best claim, or what the page is when he leads nothing */
export function playerLead(name: string, pos: Pos, face: RecordRow | null | undefined, firstSeason: number): string {
  return face ? `${name}: ${recordWords(face)}, ${placeWords(face)}.` : `Every comparison ${name} leads among ${POS_WORDS[pos]} at the same point in the career, since ${firstSeason}.`
}

/** a player page's head: the title is the fact people type ("cam newton records"), the description leads with his face row */
export function playerText(name: string, pos: Pos, face: RecordRow | null | undefined, firstSeason: number, site = SITE): ShareText {
  const lead = playerLead(name, pos, face, firstSeason)
  const rest = ` Every comparison he leads among ${POS_WORDS[pos]} at the same point in the career, since ${firstSeason}.`
  return { title: `${name}: every record he holds at the same point in a career, since ${firstSeason} · ${site}`, description: face ? `${lead}${rest}` : lead }
}
