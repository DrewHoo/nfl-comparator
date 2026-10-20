// Runs after `vite build`. Bakes the rendered app into dist/index.html and
// writes the <head> from site.config.js, then a page per player with a
// records file (dist/player/<id>/index.html, the file embedded so the
// hydrate matches), and the sitemap.
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
import { placeWords, recordWords, POS_WORDS } from '../src/lib/words.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = pkg.name
const ORIGIN = `https://${config.domain}`
const SITE = `${ORIGIN}/${SLUG}/`
const OUT = path.join(ROOT, 'dist/index.html')

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

/** the head for one page: its title, description, canonical and OG, the embeds, its JSON-LD */
function headFor({ url, title, description, jsonLd }) {
  return `
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(config.domain)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(config.ogImageAlt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE}og.png" />

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

// a page per player with a records file (scripts/build-records.mjs)
const urls = [SITE]
const playersDir = path.join(ROOT, 'dist/players')
const index = fs.existsSync(path.join(playersDir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(playersDir, 'index.json'), 'utf8')) : []
const t0 = Date.now()
for (const entry of index) {
  const file = JSON.parse(fs.readFileSync(path.join(playersDir, `${entry.id}.json`), 'utf8'))
  const url = `${SITE}player/${entry.id}/`
  const html = renderToString(React.createElement(App, { path: `/${SLUG}/player/${entry.id}/`, preload: file }))
  const fams = page(decodePlayer(file), file.id, file.pos)
  const face = fams[0]?.best
  const title = `${file.name} · ${config.title}`
  const description = face
    ? `${file.name}: ${recordWords(face)}, ${placeWords(face)}. Every comparison he leads among ${POS_WORDS[file.pos]} at the same point in the career, since 1999.`
    : `Every comparison ${file.name} leads among ${POS_WORDS[file.pos]} at the same point in the career, since 1999.`
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
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml({ title, head: headFor({ url, title, description, jsonLd: ld }), appHtml: html, embed: file }))
  urls.push(url)
}
await vite.close()
console.log(`prerendered ${index.length} player pages in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

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
