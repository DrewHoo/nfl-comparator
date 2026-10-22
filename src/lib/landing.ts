// The named boards: a curated set of queries, each at its own path
// (/most-wins-through-150-starts/), prerendered with an h1 and a title worded
// the way people search for it (words.ts h1Words). The board is the same
// board; the path is the query's canonical address, so a board that arrives
// at one of these queries by any route writes the path (url.ts toHref), the
// share worker words it from here, and a player page's row links the path
// when its claim is one of these.
//
// Pure: the table and its lookups, no ledger, so the worker and the IndexNow
// script can import it. Every query here is written out in full and
// normalized as written (landing.test pins it); the default query is the
// root page and must not appear here. The slug carries the position only
// where two positions share a stat and a window (the title always says it).
import type { Query } from './query.ts'
import { h1Words } from './words.ts'

export interface Landing {
  slug: string
  query: Query
}

const Q = (q: Partial<Query> & Pick<Query, 'pos' | 'stat' | 'n'>): Query =>
  ({ tests: [], how: 'sum', seq: 'games', scope: 'reg', since: null, dir: 'most', ...q })

export const LANDINGS: Landing[] = [
  // quarterbacks: the viral shape, the round numbers, the futility
  { slug: 'most-wins-through-150-starts-including-playoffs', query: Q({ pos: 'QB', stat: 'win', n: 150, seq: 'starts', scope: 'all' }) },
  { slug: 'most-wins-through-100-starts', query: Q({ pos: 'QB', stat: 'win', n: 100, seq: 'starts' }) },
  { slug: 'most-wins-through-50-starts', query: Q({ pos: 'QB', stat: 'win', n: 50, seq: 'starts' }) },
  { slug: 'most-losses-through-50-starts', query: Q({ pos: 'QB', stat: 'loss', n: 50, seq: 'starts' }) },
  { slug: 'most-passing-touchdowns-through-100-games', query: Q({ pos: 'QB', stat: 'patd', n: 100 }) },
  { slug: 'most-passing-touchdowns-through-3-seasons', query: Q({ pos: 'QB', stat: 'patd', n: 3, seq: 'seasons' }) },
  { slug: 'most-passing-yards-through-50-starts', query: Q({ pos: 'QB', stat: 'payds', n: 50, seq: 'starts' }) },
  { slug: 'fewest-interceptions-through-100-starts', query: Q({ pos: 'QB', stat: 'int', n: 100, seq: 'starts', dir: 'fewest' }) },
  { slug: 'fastest-to-100-passing-touchdowns', query: Q({ pos: 'QB', stat: 'patd', n: 100, how: 'reach', dir: 'fewest' }) },
  { slug: '300-passing-yards-in-each-of-first-5-games', query: Q({ pos: 'QB', stat: 'payds', n: 5, how: 'every', seq: 'teamGames', tests: [{ stat: 'payds', min: 300 }] }) },
  // running backs
  { slug: 'most-rushing-yards-through-50-games', query: Q({ pos: 'RB', stat: 'ruyds', n: 50 }) },
  { slug: 'most-rushing-touchdowns-through-50-games', query: Q({ pos: 'RB', stat: 'rutd', n: 50 }) },
  { slug: 'most-rushing-yards-through-3-seasons', query: Q({ pos: 'RB', stat: 'ruyds', n: 3, seq: 'seasons' }) },
  { slug: 'fastest-to-5000-rushing-yards', query: Q({ pos: 'RB', stat: 'ruyds', n: 5000, how: 'reach', dir: 'fewest' }) },
  { slug: 'most-100-yard-rushing-games-in-first-50-games', query: Q({ pos: 'RB', stat: 'ruyds', n: 50, how: 'count', tests: [{ stat: 'ruyds', min: 100 }] }) },
  // receivers
  { slug: 'most-receptions-through-50-games', query: Q({ pos: 'WR', stat: 'rec', n: 50 }) },
  { slug: 'most-receiving-yards-through-50-games', query: Q({ pos: 'WR', stat: 'reyds', n: 50 }) },
  { slug: 'most-receiving-touchdowns-through-50-games', query: Q({ pos: 'WR', stat: 'retd', n: 50 }) },
  { slug: 'fastest-to-250-receptions', query: Q({ pos: 'WR', stat: 'rec', n: 250, how: 'reach', dir: 'fewest' }) },
  { slug: 'most-100-yard-receiving-games-in-first-50-games', query: Q({ pos: 'WR', stat: 'reyds', n: 50, how: 'count', tests: [{ stat: 'reyds', min: 100 }] }) },
  // tight ends
  { slug: 'tight-ends-most-receptions-through-50-games', query: Q({ pos: 'TE', stat: 'rec', n: 50 }) },
  { slug: 'tight-ends-most-receiving-yards-through-50-games', query: Q({ pos: 'TE', stat: 'reyds', n: 50 }) },
  { slug: 'tight-ends-most-receiving-touchdowns-through-50-games', query: Q({ pos: 'TE', stat: 'retd', n: 50 }) },
]

export const landingBySlug: ReadonlyMap<string, Landing> = new Map(LANDINGS.map((l) => [l.slug, l]))

/** the landing at a path like /nfl-comparator/most-wins-through-100-starts/ (any base); null elsewhere, and for player/<id>/ */
export function landingFromPath(pathname: string): Landing | null {
  const m = /(?:^|\/)([a-z0-9-]+)\/?$/.exec(pathname)
  return (m && landingBySlug.get(m[1])) ?? null
}

/** two normalized queries ask the same thing */
export function sameQuery(a: Query, b: Query): boolean {
  return a.pos === b.pos && a.stat === b.stat && a.how === b.how && a.n === b.n && a.seq === b.seq && a.scope === b.scope && a.since === b.since && a.dir === b.dir
    && a.tests.length === b.tests.length && a.tests.every((t, i) => t.stat === b.tests[i].stat && t.min === b.tests[i].min && t.max === b.tests[i].max)
}

/** the landing whose query this is (normalized); null when the board has no named page */
export const landingOf = (q: Query): Landing | null => LANDINGS.find((l) => sameQuery(l.query, q)) ?? null

/** the page's h1: "Most wins through the first 100 starts in the NFL" */
export const landingH1 = (l: Landing): string => h1Words(l.query)

/** the <title> before the site's name: the h1 and the era the data starts, unless the query names its own */
export const landingTitle = (l: Landing, since: number): string => `${landingH1(l)}${l.query.since ? '' : `, since ${since}`}`
