// The share card: a board or a comparison drawn as a 1200x630 PNG through
// workers-og (satori + resvg wired for workerd, wasm included). The layout
// follows scripts/lib/og.mjs: the dark room, the site's name in rust, a
// Graduate heading, serif names, mono small print, every meaningful glyph
// inside the centered 720px column (Reddit's compact feed center-crops the
// card to a near-square thumbnail). Fonts ride in the bundle (OFL; the same
// four the site uses, from scripts/fonts/).

import { ImageResponse } from 'workers-og';
// wrangler's Data rule hands these over as ArrayBuffers
import graduate from '../../scripts/fonts/Graduate-Regular.ttf';
import mono from '../../scripts/fonts/IBMPlexMono-Regular.ttf';
import monoBold from '../../scripts/fonts/IBMPlexMono-SemiBold.ttf';
import serif from '../../scripts/fonts/SourceSerif4-Regular.ttf';

const BG = '#282127';
const INK = '#efe6d9';
const MUTED = '#bfb2a6';
const FAINT = '#857a75';
const LINE = '#453a42';
const CREAM = '#f3e2bc';
const RUST = '#c36c36';

/** the safe column: every meaningful glyph sits in the centered 720px (scripts/lib/og.mjs has the same) */
const SAFE = 720;
/** a comparison side: half the column less the gap between the two */
const SIDE = SAFE / 2 - 10;

export interface BoardCardRow {
  rank: string;
  name: string;
  /** "2017–2026" */
  span: string;
  value: string;
  /** still inside the window: the value in rust */
  live?: boolean;
}

export interface Side {
  name: string;
  value: string;
  /** the unit under the value: "wins", "starts" */
  unit: string;
  /** the claim in small print: "through his first 150 starts" */
  claim: string;
}

export interface Chart {
  me: number[];
  them: number[];
  n: number;
  /** "start" or "game", for the labels */
  unit: string;
}

export interface Card {
  heading: string;
  sub: string;
  /** a board: its top rows */
  rows?: BoardCardRow[];
  /** a comparison: the two sides, the lines under them, the curves */
  sides?: [Side, Side];
  lines?: string[];
  chart?: Chart | null;
  footer: string;
}

// satori reads the text as-is, entities included, so only the characters
// that would open a tag or close an attribute are escaped
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/"/g, '&quot;');
const nowrap = 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';

/** the two curves as an SVG, embedded as an image: the panel's chart in the card's colors (its labels are HTML under it; resvg draws no text inside a nested image) */
function chartSvg(c: Chart, W: number, H: number): { svg: string; len: number; top: number } {
  const len = Math.max(c.me.length, c.them.length, c.n);
  const top = Math.max(1, ...c.me.slice(0, len), ...c.them.slice(0, len));
  const L = 2, R = 2, T = 6, B = 2;
  const x = (i: number) => L + (i / Math.max(1, len - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const path = (s: number[]) => s.slice(0, len).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const parts = [`<line x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}" stroke="${LINE}"/>`];
  if (c.n <= len) parts.push(`<line x1="${x(c.n - 1)}" y1="${T}" x2="${x(c.n - 1)}" y2="${y(0)}" stroke="${LINE}" stroke-dasharray="2 3"/>`);
  parts.push(`<path d="${path(c.them)}" fill="none" stroke="${MUTED}" stroke-width="2"/>`);
  parts.push(`<path d="${path(c.me)}" fill="none" stroke="${CREAM}" stroke-width="2.5"/>`);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`, len, top };
}

/** the chart and its labels: the unit's first and last ordinal under it, the top value at its left */
function chart(c: Chart): string {
  const { svg, len, top } = chartSvg(c, SAFE, 130);
  const lab = `font-family:'IBM Plex Mono'; font-size:11px; letter-spacing:1px; color:${FAINT};`;
  return `
    <div style="display:flex; flex-direction:row; justify-content:space-between; width:${SAFE}px; margin-top:12px;">
      <div style="display:flex; ${lab}">${esc(c.unit.toUpperCase())} 1</div>
      <div style="display:flex; ${lab}">TOP ${top.toLocaleString('en-US')}</div>
      <div style="display:flex; ${lab}">${esc(c.unit.toUpperCase())} ${len}</div>
    </div>
    <img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" width="${SAFE}" height="130" style="margin-top:2px;" />`;
}

export function renderCard(card: Card): Response {
  const body = card.sides
    ? `
    <div style="display:flex; flex-direction:row; justify-content:space-between; width:${SAFE}px; margin-top:6px;">
      ${card.sides.map((s, i) => `
      <div style="display:flex; flex-direction:column; width:${SIDE}px; align-items:${i ? 'flex-end' : 'flex-start'};">
        <div style="display:flex; font-family:'Source Serif 4'; font-size:24px; color:${INK}; ${nowrap} max-width:${SIDE}px;">${esc(s.name)}</div>
        <div style="display:flex; flex-direction:row; align-items:baseline; gap:10px;">
          <div style="display:flex; font-family:'Graduate'; font-size:46px; color:${i ? MUTED : CREAM};">${esc(s.value)}</div>
          <div style="display:flex; font-family:'IBM Plex Mono'; font-size:12px; letter-spacing:1px; color:${FAINT};">${esc(s.unit.toUpperCase())}</div>
        </div>
        <div style="display:flex; font-family:'IBM Plex Mono'; font-size:11px; letter-spacing:1px; color:${FAINT}; ${nowrap} max-width:${SIDE}px;">${esc(s.claim.toUpperCase())}</div>
      </div>`).join('')}
    </div>
    ${card.chart ? chart(card.chart) : ''}
    ${(card.lines ?? []).map((l, i) => `<div style="display:flex; font-family:'Source Serif 4'; font-size:18px; line-height:1.3; color:${i ? MUTED : INK}; margin-top:${i ? 2 : 8}px; width:${SAFE}px;">${esc(l)}</div>`).join('')}`
    : (card.rows ?? []).map((r, i, all) => `
    <div style="display:flex; flex-direction:row; align-items:center; gap:14px; height:42px; ${i < all.length - 1 ? `border-bottom:1px dashed ${LINE};` : ''}">
      <div style="display:flex; width:30px; font-family:'IBM Plex Mono'; font-size:12px; color:${r.rank === '1' ? CREAM : FAINT};">${esc(r.rank)}</div>
      <div style="display:flex; font-family:'Source Serif 4'; font-size:22px; color:${INK}; ${nowrap} max-width:520px;">${esc(r.name)}</div>
      <div style="display:flex; font-family:'IBM Plex Mono'; font-size:10.5px; letter-spacing:0.8px; color:${FAINT};">${esc(r.span)}</div>
      <div style="display:flex; flex-grow:1;"></div>
      <div style="display:flex; font-family:'Graduate'; font-size:26px; color:${r.live ? RUST : CREAM};">${esc(r.value)}</div>
    </div>`).join('');

  const html = `
  <div style="display:flex; flex-direction:column; align-items:center; width:1200px; height:630px; background-color:${BG}; padding:40px 0 22px;
              background-image: radial-gradient(circle at 600px -126px, rgba(243,226,188,0.13) 0%, rgba(243,226,188,0) 65%);">
    <div style="display:flex; font-family:'IBM Plex Mono'; font-weight:600; font-size:16px; letter-spacing:4px; color:${RUST};">NFL COMPARATOR</div>
    <div style="display:flex; font-family:'Graduate'; font-size:${card.heading.length > 34 ? 28 : 36}px; color:${CREAM}; margin-top:14px; ${nowrap} max-width:${SAFE}px;">${esc(card.heading.toUpperCase())}</div>
    <div style="display:flex; font-family:'IBM Plex Mono'; font-size:14px; letter-spacing:2px; color:${FAINT}; margin-top:6px; ${nowrap} max-width:${SAFE}px;">${esc(card.sub.toUpperCase())}</div>
    <div style="display:flex; flex-direction:column; margin-top:14px; flex-grow:1; width:${SAFE}px;">${body}</div>
    <div style="display:flex; font-family:'IBM Plex Mono'; font-size:14px; letter-spacing:2px; color:${FAINT}; margin-top:10px;">${esc(card.footer.toUpperCase())}</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Graduate', data: graduate as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: mono as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: monoBold as ArrayBuffer, weight: 600, style: 'normal' },
      { name: 'Source Serif 4', data: serif as ArrayBuffer, weight: 400, style: 'normal' },
    ],
  });
}
