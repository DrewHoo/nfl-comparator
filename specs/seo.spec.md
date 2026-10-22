# Search traffic

Status: items 1, 2 and 4 built 2026-10-21; 3 and 5 open. Written 2026-10-20 from reading
`cfb-streak-king/specs/seo.spec.md`, its prerender and its deploy against this site's.

## Where we stand

The prerender writes 643 real HTML pages: the board and one page per player with a
records file. Each has its own title, description, self-canonical, OG tags and JSON-LD
(WebPage + BreadcrumbList, a player page `about` a Person), and since PR #2 each player
page has its own card. `dist/sitemap.xml` lists them all, and the index site's
`sitemap-index.xml`, the one robots.txt names and Search Console has, lists our sitemap
through the `sitemapUrl` field on the project card there. The live site serves the
player pages as 200s. So the plumbing Streak King needed a PR for is already here. The
site went live today, so nothing is indexed yet.

The gap is what the pages say and which pages exist. Streak King's three kinds of search
page are named definition pages, weekly posts, and every past season's weeks. We have
none of those. Every board here is a query string, and GitHub Pages serves one HTML for
every query string, so a shared board indexes and unfurls as the root.

## What Streak King does that we don't

1. The root's title carries the head term ("College Football Streak King: longest
   winning and losing streaks"). Ours is "NFL Comparator". The board's h1 is the site
   name too, and the query words are `.sr-only` text under it.
2. Named definition pages (`landing.ts`): 24 curated definitions, each at its own path,
   prerendered as the board on that definition with an h1 and a title worded the way
   people search, a lead sentence with the leader, and an ItemList of the top ten. The
   path is the definition's canonical address, so `toUrl` writes it whenever the board
   is on that definition. `Landings.jsx` lists them under the board as real links, which
   is how a crawler finds them.
3. Team page titles are the fact people type ("Alabama win streaks and losing streaks:
   active and all-time, since 1936"). Ours is "Cam Newton · NFL Comparator".
4. ItemList JSON-LD on every leaderboard, SportsTeam on team pages.
5. `dist/llms.txt`: the site as markdown, one line per definition page with its leader.
6. An IndexNow job after the deploy (`scripts/indexnow.mjs`, a key file under
   `public/`): the board and the definition pages on a push, the whole sitemap on the
   scheduled refresh. Bing is what ChatGPT search, Copilot and DuckDuckGo read.
7. The share worker on `drewhoover.com/cfb-streak-king/*`: a query URL gets its own
   head and a card drawn on demand. Our player pages link to thousands of query boards
   and every one unfurls as the root.
8. Weekly posts with Article JSON-LD and RSS, and a `/data/` page with Dataset JSON-LD.

## What people type

Guesses from the factoid research and from who publishes; Search Console replaces them
once we have impressions.

- The viral shape: "most wins through first 150 starts", "mahomes wins first 150 starts".
  Reactive, the current ordinal, and the ordinal moves every week.
- The stat-desk round numbers: "most passing touchdowns through first 100 games",
  "fastest to 250 receptions", "most rushing yards through first 50 games".
- "[player] records": PFR and ESPN own "cam newton stats", but "what records does cam
  newton hold" has no good answer page. The player page is that page once its title
  says so.
- Futility: the research found the futility posts outscored the rest on r/nfl, and
  `dir=fewest` already exists.
- Pairs: "mahomes vs brady first 150 starts". That's the panel's peer view, a `?t=` URL,
  and it can't have its own page without the worker.

## The plan, in order

### 1. Wording and small structure (built 2026-10-21)

Rulings taken: the root title leads with the head term, the spec's wording. The h1 is
one element, the site name as a mono eyebrow and the board's subject as the title, worded
the way it's searched (`h1Words` in `words.ts`: "Most wins through the first 150 starts in
the NFL"; a stat two positions share says the position, "by an NFL running back"), and it
follows the pickers, so the sentence under it is the control and the h1 the headline.

- The root title carries the default board the way Streak King's root carries its head
  term: something like "Most wins through the first 150 starts, and every NFL player at
  the same point in his career · NFL Comparator". The h1 names the subject: the site
  name as an eyebrow span, the query words as the title span, one `h1`. The prerendered
  root then says the default query; in the browser the h1 follows the sentence.
- Player titles become the fact: "Cam Newton: every record he holds at the same point
  in a career, since 1999 · NFL Comparator". The description already leads with the face
  row.
- ItemList JSON-LD: the board's top ten (a row links to the player page when he has
  one), a player page's family faces.
- `dist/llms.txt`: what the site is, one line per definition page with its leader (once
  2 lands), then the player pages and the data.
- IndexNow: copy `scripts/indexnow.mjs` and the deploy job, with our own key file. The
  index repo's job maps its own push's changed files onto URLs; its `--all` mode walks
  the sitemap index into the siblings' sitemaps but only runs by hand. So a deploy here
  never pings unless we do it, same as Streak King.

### 2. Named definition pages (built 2026-10-21)

Built as `src/lib/landing.ts`: 23 slugs, the position in the slug only where two
positions share a stat and a window (the tight ends), in the title always. `toHref` in
`url.ts` writes the path for a landing's query, `parseRoute` in `App.jsx` reads it, the
prerender writes each page with its own card, `Landings.jsx` lists them under the board,
a player page's row links the path when its claim is one, and the worker gives a root URL
whose query is a landing's that page as its canonical. No leader beside each link yet:
the list would have to evaluate every landing on every position's ledger in the browser.

A `src/lib/landing.ts` table, slug to `Query`, 15 to 25 to start, taken from what the
research says repeats: wins through 150 starts (regular season, and playoffs included),
wins through 100 starts, passing TDs through 100 games, passing yards through 50 starts,
fewest interceptions through 100 starts, rushing yards and rushing TDs through 50 games,
receptions and receiving yards through 50 games, fastest to 250 receptions, 300-yard
games in a season's first five, and a seasons shape or two (TDs through three seasons).
Every position gets a few.

Each page is the board seeded with that query, prerendered with an h1 and a title worded
like the search ("Most wins through the first 150 starts in the NFL, since 1999"), a lead
sentence with the leader and the runner-up, an ItemList, and the sitemap entry. The
mechanics follow Streak King's: `parseRoute` reads the slug, `toUrl` writes the path when
the query equals a landing's (`t` rides along), `url.test` cases, a list of them under the
board as real links. A player page row whose shape and N match a landing links to the
path instead of the query string.

The slug wants the position when the stat is ambiguous ("most rushing yards through 50
games" is a running back query to a reader and a quarterback query to the engine's
default). "/quarterbacks-most-rushing-yards-through-50-games/" reads worse than
"/most-rushing-yards-through-50-games/" with the position in the title. WDYT?

### 3. The weekly digest (the product spec's next item anyway)

The records set this week and the ones within reach next week, at a dated address per
week with an ItemList. Streak King's experience is that a data page titled for navigation
doesn't pull; the posts with prose did. So the digest earns a page for the product, and
its search value is the dated URL that accumulates. Whether it gets a post wrapper is the
same question as over there: who writes the prose.

### 4. The share worker (built 2026-10-20)

`workers/share/` is Streak King's worker ported: a board or comparison URL gets its head
from `compare.ts` and a card drawn on demand from the published ledger. It's a sharing
thing, not a search thing: unnamed query URLs keep canonicalizing to the root, as they
do over there. It needs the `CLOUDFLARE_API_TOKEN` secret on the repo before the deploy
job can run.

### 5. A `/data/` page

The ledgers and the player files, documented, with Dataset JSON-LD. nflverse is CC BY
4.0 and so are the derived files. Cheap, and Streak King's is the template.

## Measurement

Search Console has drewhoover.com; filter by the `/nfl-comparator/` path. Check
`site:drewhoover.com/nfl-comparator` in a week. The analytics embed already counts
visits and the `share` and `record` events.

## What we don't do

- No prerendering the query space. The named slugs are the only boards with paths;
  everything else canonicalizes to the root.
- No thin pages. A landing is the real board on a real query, and a digest is the real
  week.

## Open questions

- (Settled with item 1: the root title leads with the head term; the h1 is the query's
  search wording under a site-name eyebrow.)
- (Settled with item 2: the position is in the slug only where two positions share a
  stat and a window; the title always says it.)
- Whether a landing's link in the list under the board should carry its leader, which
  Streak King's does; it costs an evaluate per landing per ledger in the browser.
