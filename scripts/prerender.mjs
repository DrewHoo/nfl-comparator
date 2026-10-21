// Runs after `vite build`. Bakes the rendered app into dist/index.html and
// writes the <head> from site.config.js, then a page per player with a
// records file (dist/player/<id>/index.html, the file embedded so the
// hydrate matches, and dist/player/<id>/og.png, his own social card), and
// the sitemap.
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
import { placeWords, recordWords } from '../src/lib/words.ts'
import { playerText } from '../src/lib/share.ts'
import { toPng } from './lib/og.mjs'
import { playerCard } from './lib/og-player.mjs'

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
const { default: App } = await vite.ssrLoadModule('/src/App.jsx')

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

// the board
const appHtml = renderToString(React.createElement(App))
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebPage', '@id': SITE, url: SITE, name: config.title, description: config.description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: config.domain, item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: config.title, item: SITE },
    ] },
  ],
}
fs.writeFileSync(OUT, pageHtml({ title: config.title, head: headFor({ url: SITE, title: config.title, description: config.description, jsonLd }), appHtml }))
const words = appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(`prerendered ${(appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words); head written for ${SITE}`)

// a page per player with a records file (scripts/build-records.mjs), and his
// card; the PNGs draw a few at a time, sharp's threads do the work
const urls = [SITE]
const pending = new Set()
const draw = async (svg, file) => {
  const p = toPng(svg, file).finally(() => pending.delete(p))
  pending.add(p)
  if (pending.size >= 8) await Promise.race(pending)
}
const playersDir = path.join(ROOT, 'dist/players')
const index = fs.existsSync(path.join(playersDir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(playersDir, 'index.json'), 'utf8')) : []
const t0 = Date.now()
for (const entry of index) {
  const file = JSON.parse(fs.readFileSync(path.join(playersDir, `${entry.id}.json`), 'utf8'))
  const url = `${SITE}player/${entry.id}/`
  const html = renderToString(React.createElement(App, { path: `/${SLUG}/player/${entry.id}/`, preload: file }))
  const fams = page(decodePlayer(file), file.id, file.pos)
  const face = fams[0]?.best
  const { title, description } = playerText(file.name, file.pos, face, firstSeason, config.title)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: title, description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: config.domain }, about: { '@type': 'Person', name: file.name } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: config.domain, item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: config.title, item: SITE },
        { '@type': 'ListItem', position: 3, name: file.name, item: url },
      ] },
    ],
  }
  const dir = path.join(ROOT, 'dist/player', entry.id)
  fs.mkdirSync(dir, { recursive: true })
  const image = { url: `${url}og.png`, alt: face ? `${file.name}: ${recordWords(face)}, ${placeWords(face)}. His page on ${config.title}, on a dark background.` : `${file.name}'s page on ${config.title}, on a dark background.` }
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ title, head: headFor({ url, title, description, jsonLd: ld, image }), appHtml: html, embed: file }))
  await draw(playerCard(file, fams, { seasons: SEASONS }), path.join(dir, 'og.png'))
  urls.push(url)
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
