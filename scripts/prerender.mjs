// Runs after `vite build`. Bakes the rendered app into dist/index.html and
// writes the <head> from site.config.js, then a page per named board
// (src/lib/landing.ts: dist/<slug>/index.html and its card), a page per
// player with a records file (dist/player/<id>/index.html, the file embedded
// so the hydrate matches, and dist/player/<id>/og.png, his own social card),
// llms.txt and the sitemap.
//
// Without this the deployed page is `<div id="root"></div>` and every word on
// it exists only after React runs. Google usually renders JS in a deferred
// second pass; Bing, DuckDuckGo, social unfurlers, and the LLM crawlers
// largely don't. Prerendering makes the content plain HTML.
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../site.config.js'
import pkg from '../package.json' with { type: 'json' }
import { decodePlayer, page } from '../src/lib/records.ts'
import { placeWords, recordWords, rowName, rowWords } from '../src/lib/words.ts'
import { boardText, playerText, rootTitle } from '../src/lib/share.ts'
import { LANDINGS, landingH1, landingOf, landingTitle } from '../src/lib/landing.ts'
import { evaluate, DEFAULT_QUERY } from '../src/lib/query.ts'
import { toUrl } from '../src/lib/url.ts'
import { POSITIONS } from '../src/lib/ledger.ts'
import { toPng } from './lib/og.mjs'
import { playerCard } from './lib/og-player.mjs'
import { boardCard } from './lib/og-board.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = pkg.name
const ORIGIN = `https://${config.domain}`
const SITE = `${ORIGIN}/${SLUG}/`
const OUT = path.join(ROOT, 'dist/index.html')
const DATA = path.join(ROOT, 'src/data')

// the ledgers as files, for the share worker (workers/share), which runs the
// engine at the edge on the same JSON the page bundles
fs.mkdirSync(path.join(ROOT, 'dist/data'), { recursive: true })
for (const f of fs.readdirSync(DATA).filter((f) => /^[A-Z]+\.json$/.test(f))) fs.copyFileSync(path.join(DATA, f), path.join(ROOT, 'dist/data', f))
const { firstSeason, currentSeason } = JSON.parse(fs.readFileSync(path.join(DATA, 'QB.json'), 'utf8'))
const SEASONS = `${firstSeason}–${currentSeason}`

if (config.domain === 'example.com') {
  console.warn('prerender: site.config.js still says example.com; the canonical and OG URLs will be wrong until you set your domain')
}

const vite = await createServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
})
const { default: App, loadLedger } = await vite.ssrLoadModule('/src/App.jsx')
// every position's ledger in the app's cache, so a named board on any position renders as the board, not "loading"
const ledgers = Object.fromEntries(await Promise.all(POSITIONS.map(async (pos) => [pos, await loadLedger(pos)])))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** the head for one page: its title, description, canonical and OG (the board's card unless the page has its own), the embeds, its JSON-LD */
function headFor({ url, title, description, jsonLd, image = { url: `${SITE}og.png`, alt: config.ogImageAlt } }) {
  return `
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(config.domain)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image.url}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(image.alt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${image.url}" />

    <!-- Cross-site chrome served by the index site: back bar, comments, analytics. -->
    <script src="${ORIGIN}/embed/back-bar.js" async></script>
    <script src="${ORIGIN}/embed/giscus.js" async></script>
    <script src="${ORIGIN}/embed/analytics.js" async></script>

    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`
}

const breadcrumb = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) })
const webPage = (url, name, description, extra = {}) => ({ '@type': 'WebPage', '@id': url, url, name, description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain }, ...extra })
/** a ranked list for a leaderboard page: [name, url?][] in order */
const itemList = (name, items) => ({
  '@type': 'ItemList', name, itemListOrder: 'https://schema.org/ItemListOrderAscending', numberOfItems: items.length,
  itemListElement: items.map(([item, url], i) => ({ '@type': 'ListItem', position: i + 1, name: item, ...(url ? { url } : {}) })),
})

// who has a page (scripts/build-records.mjs), so a list item links to it
const playersDir = path.join(ROOT, 'dist/players')
const index = fs.existsSync(path.join(playersDir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(playersDir, 'index.json'), 'utf8')) : []
const pageOf = new Map(index.map((e) => [e.id, `${SITE}player/${e.id}/`]))
/** a board's top ten as list items: "Patrick Mahomes: 115 wins through his first 150 starts", linked to his page when he has one */
const boardItems = (q, board) => board.ranked.slice(0, 10).map((r) => [`${rowName(r)}: ${rowWords(r, q)}`, pageOf.get(r.player.id) ?? null])

const template = fs.readFileSync(OUT, 'utf8')
// Throw rather than no-op: a Vite change that renames the marker would
// otherwise quietly ship an empty page again.
if (!template.includes('<div id="root"></div>')) throw new Error('prerender: could not find an empty #root in dist/index.html')
if (!/<title>[^<]*<\/title>/.test(template)) throw new Error('prerender: could not find <title> in dist/index.html')

/** the template with a page's title, head, markup and (for a player) its embedded file */
function pageHtml({ title, head, appHtml, embed }) {
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = html.replace('</head>', head)
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  if (embed) html = html.replace('<script type="module"', `<script id="player-data" type="application/json">${JSON.stringify(embed).replace(/</g, '\\u003c')}</script>\n    <script type="module"`)
  return html
}

// the board: the root's title carries the default board's head term (share.ts rootTitle), its list is the default board's top ten
const appHtml = renderToString(React.createElement(App))
const rootBoard = evaluate(ledgers.QB, DEFAULT_QUERY)
const title = rootTitle(config.title)
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    webPage(SITE, title, config.description),
    breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE]]),
    itemList(`${landingH1({ query: DEFAULT_QUERY })}, since ${rootBoard.since}`, boardItems(DEFAULT_QUERY, rootBoard)),
  ],
}
fs.writeFileSync(OUT, pageHtml({ title, head: headFor({ url: SITE, title, description: config.description, jsonLd }), appHtml }))
const words = appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(`prerendered ${(appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words); head written for ${SITE}`)

const urls = [SITE]
const pending = new Set()
const draw = async (svg, file) => {
  const p = toPng(svg, file).finally(() => pending.delete(p))
  pending.add(p)
  if (pending.size >= 8) await Promise.race(pending)
}

// a page per named board (src/lib/landing.ts): the board on its query at its
// own path, titled the way it's searched, its top ten as the list, its own
// card (the board card, scripts/lib/og-board.mjs)
const llmsBoards = [] // each page's h1, address and lead, for llms.txt below
for (const l of LANDINGS) {
  const board = evaluate(ledgers[l.query.pos], l.query)
  const url = `${SITE}${l.slug}/`
  const h1 = landingH1(l)
  const title = `${landingTitle(l, board.since)} · ${config.title}`
  const { description } = boardText(l.query, board, config.title)
  const html = renderToString(React.createElement(App, { path: `/${SLUG}/${l.slug}/` }))
  // (React writes an apostrophe as &#x27;)
  if (!html.includes(esc(h1).replace(/'/g, '&#x27;'))) throw new Error(`prerender: ${l.slug} rendered without its h1`)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      webPage(url, title, description),
      breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], [h1, url]]),
      itemList(`${h1}, since ${board.since}`, boardItems(l.query, board)),
    ],
  }
  const dir = path.join(ROOT, 'dist', l.slug)
  fs.mkdirSync(dir, { recursive: true })
  const image = { url: `${url}og.png`, alt: `${h1}: the top of the board, on a dark background.` }
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ title, head: headFor({ url, title, description, jsonLd: ld, image }), appHtml: html }))
  await draw(boardCard(l.query, board, { seasons: SEASONS, site: `${config.domain}/${SLUG}` }), path.join(dir, 'og.png'))
  urls.push(url)
  llmsBoards.push({ h1, url, lead: description })
}
console.log(`prerendered ${LANDINGS.length} named boards, each with its card`)

// a page per player with a records file (scripts/build-records.mjs), and his
// card; the PNGs draw a few at a time, sharp's threads do the work
const llmsPlayers = [] // each page's name, address and lead line, for llms.txt below
const t0 = Date.now()
for (const entry of index) {
  const file = JSON.parse(fs.readFileSync(path.join(playersDir, `${entry.id}.json`), 'utf8'))
  const url = `${SITE}player/${entry.id}/`
  const html = renderToString(React.createElement(App, { path: `/${SLUG}/player/${entry.id}/`, preload: file }))
  const fams = page(decodePlayer(file), file.id, file.pos)
  const face = fams[0]?.best
  const { title, description } = playerText(file.name, file.pos, face, firstSeason, config.title)
  // the faces of his families as the list; a face links its named board when its claim is one
  const faceUrl = (r) => { const l = landingOf({ ...r.shape, n: r.at }); return l ? `${SITE}${l.slug}/` : null }
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      webPage(url, title, description, { about: { '@type': 'Person', name: file.name } }),
      breadcrumb([[config.domain, `${ORIGIN}/`], [config.title, SITE], [file.name, url]]),
      itemList(`What ${file.name} leads at the same point in a career, since ${firstSeason}`, fams.slice(0, 10).map((f) => [`${recordWords(f.best)}, ${placeWords(f.best)}`, faceUrl(f.best)])),
    ],
  }
  const dir = path.join(ROOT, 'dist/player', entry.id)
  fs.mkdirSync(dir, { recursive: true })
  const image = { url: `${url}og.png`, alt: face ? `${file.name}: ${recordWords(face)}, ${placeWords(face)}. His page on ${config.title}, on a dark background.` : `${file.name}'s page on ${config.title}, on a dark background.` }
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ title, head: headFor({ url, title, description, jsonLd: ld, image }), appHtml: html, embed: file }))
  await draw(playerCard(file, fams, { seasons: SEASONS }), path.join(dir, 'og.png'))
  urls.push(url)
  llmsPlayers.push({ name: file.name, url, lead: face ? `${recordWords(face)}, ${placeWords(face)}.` : '' })
}
await Promise.all(pending)
await vite.close()
console.log(`prerendered ${index.length} player pages, each with its card, in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

// the sitemap: what Search Console wants submitted, and it carries lastmod
const lastmod = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(ROOT, 'dist/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`,
)

// llms.txt (llmstxt.org): the site in plain markdown for a language model
// that reads it, the way a person reads the board: what it is, then one line
// per named board with its lead, then the player pages, then the data. Said
// the way the pages say it, nothing more.
{
  const txt = `# ${config.title}

> ${config.description}

A board ranks every career (or every player-season) by one stat at the same point: the first N starts, games or seasons, or a team's first N games of a season. The sentence at ${SITE} has five slots (who, which stat, how it adds up, over which games, regular season or playoffs included) and any sentence it can make is a board with its own address; the pages below are the ones people search for, each at a named address. A start is the quarterback the schedule names; a game is one the player recorded a stat in; a career that began before ${firstSeason} sits out career boards, because its first N is unknowable. Ranks are competition ranks with ties. The data is nflverse's (CC BY 4.0), ${firstSeason}–${currentSeason}, rebuilt weekly in season. Credit as "per NFL Comparator" with the page's link.

## Named boards

${llmsBoards.map((b) => `- [${b.h1}](${b.url}): ${b.lead}`).join('\n')}

## Player pages

One page per player who leads a comparison at some point: every claim he holds (the stretch of N where he is first under a sentence) and the records he set that were later broken, each linked to its board. The line is his best claim.

${llmsPlayers.map((p) => `- [${p.name}](${p.url})${p.lead ? `: ${p.lead}` : ''}`).join('\n')}

## Data

- The ledgers the site reads, one JSON per position group, at ${SITE}data/QB.json, RB.json, WR.json and TE.json: every game a player recorded a stat in since ${firstSeason}, with the result, the start flag and the stat line. Built from nflverse's weekly player stats and schedule by [the source repository](https://github.com/DrewHoo/nfl-comparator), which documents the layout. CC BY 4.0.
`
  fs.writeFileSync(path.join(ROOT, 'dist', 'llms.txt'), txt)
  console.log(`llms.txt: ${llmsBoards.length} named boards, ${llmsPlayers.length} player pages`)
}
