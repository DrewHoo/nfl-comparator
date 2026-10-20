// A player page's social card: his name, the career line, and the faces of
// his best families with their values, in the page's own look. Drawn by
// scripts/prerender.mjs for every player page, to dist/player/<id>/og.png.
import { CREAM, FAINT, INK, RUST, dashed, fit, footer, frame, sizeToFit, text, width } from './og.mjs'
import { statByKey } from '../../src/lib/stats.ts'
import { placeWords, recordWords, POS_WORDS } from '../../src/lib/words.ts'

const KIND = { held: 'LEADS', set: 'SET IT' }
const unitOf = (r) => (r.shape.how === 'reach' ? (r.shape.seq === 'starts' ? 'starts' : 'games') : r.shape.how === 'sum' ? statByKey(r.shape.stat).noun : 'games')

/** the card's SVG for a player file and his page's families (records.ts `page`) */
export function playerCard(file, fams, { W = 1200, H = 630, title, domain, slug } = {}) {
  const L = 100, R = W - 100
  const top = 262, rowH = 60, footerY = H - 36
  const faces = fams.slice(0, Math.floor((footerY - 30 - top) / rowH)).map((f) => f.best)
  const claims = fams.reduce((s, f) => s + 1 + f.rest.length, 0)
  const pos = POS_WORDS[file.pos]
  const years = file.from === file.to ? String(file.from) : `${file.from}–${file.to}`
  const meta = `${pos.replace(/s$/, '')} · ${years} · ${file.teams.join(', ')} · ${file.games} games${file.active ? ' · active' : ''}`
  const parts = []
  parts.push(text(`${title.toUpperCase()} · ${domain.toUpperCase()}`, { x: W / 2, y: 58, font: 'Mono', size: 15, fill: FAINT, anchor: 'middle', spacing: 2.4 }))
  const nameSize = sizeToFit(file.name, 'Graduate', 66, R - L, 2)
  parts.push(text(file.name, { x: W / 2, y: 132, font: 'Graduate', size: nameSize, fill: CREAM, anchor: 'middle', spacing: 2 }))
  parts.push(text(fit(meta, 'Serif', 24, R - L), { x: W / 2, y: 180, font: 'Serif', size: 24, fill: INK, anchor: 'middle' }))
  parts.push(text(`Every comparison he leads among ${pos} since 1999: ${claims} ${claims === 1 ? 'claim' : 'claims'} in ${fams.length} ${fams.length === 1 ? 'family' : 'families'}.`, { x: W / 2, y: 212, font: 'Serif', size: 18, fill: FAINT, anchor: 'middle' }))
  parts.push(dashed(L, top - 22, R))
  parts.push(text(`WHAT HE LEADS · THE BEST OF EACH FAMILY`, { x: L, y: top - 4, font: 'Mono', size: 10.5, fill: FAINT, spacing: 1.4 }))
  if (!faces.length) parts.push(text('Nothing he leads at any point.', { x: L, y: top + 30, font: 'Serif', size: 22, fill: FAINT }))
  faces.forEach((r, i) => {
    const y0 = top + rowH * i
    const kind = r.live ? 'LIVE' : KIND[r.kind]
    const value = r.value.toLocaleString('en-US')
    const valueW = width(value, 'Graduate', 26)
    const unit = unitOf(r)
    const rightW = Math.max(valueW, width(unit, 'Mono', 10.5, 0.8)) + 24
    parts.push(text(kind, { x: L, y: y0 + 24, font: 'MonoBold', size: 10.5, fill: r.live ? RUST : r.kind === 'set' ? FAINT : CREAM, spacing: 1.4 }))
    parts.push(text(fit(recordWords(r), 'Serif', 22, R - rightW - (L + 72)), { x: L + 72, y: y0 + 26, font: 'Serif', size: 22, fill: INK }))
    parts.push(text(fit(placeWords(r), 'Mono', 10.5, R - rightW - (L + 72), 0.8), { x: L + 72, y: y0 + 45, font: 'Mono', size: 10.5, fill: FAINT, spacing: 0.8 }))
    parts.push(text(value, { x: R, y: y0 + 27, font: 'Graduate', size: 26, fill: r.live ? RUST : CREAM, anchor: 'end' }))
    parts.push(text(unit, { x: R, y: y0 + 45, font: 'Mono', size: 10.5, fill: FAINT, anchor: 'end', spacing: 0.8 }))
    parts.push(dashed(L, y0 + 54, R))
  })
  parts.push(...footer(W, H, `${domain}/${slug}/player/`))
  return frame(W, H, parts)
}
