// A board's social card: the query as the heading, its top rows with their
// values, in the page's own look, inside the safe column. Drawn by
// scripts/gen-og.mjs for the committed default board (public/og.png,
// card.png) and by scripts/prerender.mjs for every named board
// (dist/<slug>/og.png).
import { CREAM, FAINT, INK, dashed, footer, frame, masthead, safeL, safeR, text, width } from './og.mjs'
import { headWords, rowName, POS_WORDS } from '../../src/lib/words.ts'

/** the card's SVG for a query and its board (query.ts `evaluate`) */
export function boardCard(query, board, { W = 1200, H = 630, seasons, site }) {
  const L = safeL(W), R = safeR(W)
  const rowH = 42
  const top = 206
  const rows = board.ranked.slice(0, Math.floor((H - 60 - top) / rowH))
  const who = query.seq === 'teamGames' ? 'player-seasons' : 'careers'
  const parts = masthead(W, {
    heading: headWords(query).replace(/^./, (c) => c.toUpperCase()),
    sub: `${POS_WORDS[query.pos]} · ${query.scope === 'all' ? 'playoffs included' : 'regular season'} · ${board.ranked.length} ${who} with the whole window`,
  })
  rows.forEach((r, i) => {
    const y = top + rowH * i + 26
    const rank = `${r.tied ? 'T' : ''}${r.rank}`
    const name = rowName(r)
    parts.push(text(rank, { x: L + 4, y, font: 'Mono', size: 12, fill: r.rank === 1 ? CREAM : FAINT }))
    parts.push(text(name, { x: L + 44, y, font: 'Serif', size: 22, fill: INK }))
    if (r.season == null) parts.push(text(`${r.from}–${r.to}`, { x: L + 44 + width(name, 'Serif', 22) + 14, y, font: 'Mono', size: 10.5, fill: FAINT, spacing: 0.8 }))
    parts.push(text((r.value ?? 0).toLocaleString('en-US'), { x: R, y: y + 1, font: 'Graduate', size: 26, fill: CREAM, anchor: 'end' }))
    if (r !== rows[rows.length - 1]) parts.push(dashed(L, y + 14, R))
  })
  parts.push(...footer(W, H, `${seasons} · ${site}`))
  return frame(W, H, parts)
}
