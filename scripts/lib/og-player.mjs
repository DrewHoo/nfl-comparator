// A player page's social card: his name, the career line, and the faces of
// his best families with their values, in the page's own look, inside the
// safe column. Drawn by scripts/prerender.mjs for every player page, to
// dist/player/<id>/og.png.
import { CREAM, FAINT, INK, RUST, dashed, fit, footer, frame, masthead, safeL, safeR, text, width } from './og.mjs'
import { placeWords, recordWords, POS_WORDS } from '../../src/lib/words.ts'

const KIND = { held: 'LEADS', set: 'SET IT' }

/** the card's SVG for a player file and his page's families (records.ts `page`) */
export function playerCard(file, fams, { W = 1200, H = 630, seasons } = {}) {
  const L = safeL(W), R = safeR(W)
  const top = 206, rowH = 66
  const faces = fams.slice(0, Math.floor((H - 60 - top) / rowH)).map((f) => f.best)
  const pos = POS_WORDS[file.pos]
  const years = file.from === file.to ? String(file.from) : `${file.from}–${file.to}`
  const sub = `${pos.replace(/s$/, '')} · ${years} · ${file.teams.join(', ')} · ${file.games} games${file.active ? ' · active' : ''}`
  const parts = masthead(W, { heading: file.name, sub })
  if (!faces.length) parts.push(text('Nothing he leads at any point.', { x: W / 2, y: top + 30, font: 'Serif', size: 22, fill: FAINT, anchor: 'middle' }))
  let y = top
  for (const r of faces) {
    const kind = r.live ? 'LIVE' : KIND[r.kind]
    const value = r.value.toLocaleString('en-US')
    parts.push(text(value, { x: L + 64, y: y + 30, font: 'Graduate', size: 28, fill: r.live ? RUST : CREAM, anchor: 'end' }))
    const tx = L + 84
    parts.push(text(fit(recordWords(r), 'Serif', 22, R - tx), { x: tx, y: y + 21, font: 'Serif', size: 22, fill: INK }))
    const sub = `${kind} · ${placeWords(r)}`
    parts.push(text(fit(sub.toUpperCase(), 'Mono', 12, R - tx, 1), { x: tx, y: y + 44, font: 'Mono', size: 12, spacing: 1, fill: FAINT }))
    y += rowH
    if (r !== faces[faces.length - 1]) parts.push(dashed(L, y - 14, R))
  }
  parts.push(...footer(W, H, `${seasons} · drewhoover.com/nfl-comparator`))
  return frame(W, H, parts)
}
