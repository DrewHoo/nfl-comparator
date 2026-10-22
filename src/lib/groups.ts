// The team pages: the best players of one position for one franchise ("the
// Kansas City Chiefs' best quarterbacks since 1999"), from the position's
// ledger. A page is the position's metrics, every player's totals over his
// regular-season games for that franchise, ranked by the first metric, and
// the cumulative curve of each metric for the top few, one line per player.
// Pure: the prerender computes it once and embeds the result in the page, so
// the client needs no ledger. A franchise is its current code (the Rams'
// St. Louis games are LA's; build-ledger.mjs maps them).
import type { Game, Ledger, Pos } from './ledger.ts'
import { statByKey, type StatKey } from './stats.ts'
import { POS_WORDS } from './words.ts'

/** the 32 franchises by their current code */
export const TEAMS: Record<string, string> = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LA: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
}
/** where a franchise played under another name inside the ledger, said once on its page */
export const FORMERLY: Record<string, string> = { LA: 'St. Louis through 2015', LAC: 'San Diego through 2016', LV: 'Oakland through 2019', WAS: 'Washington Redskins through 2019, Football Team 2020-21' }

/** the position's metrics, the first the one the page ranks by */
export const GROUP_METRICS: Record<Pos, StatKey[]> = {
  QB: ['payds', 'patd', 'win'],
  RB: ['ruyds', 'rutd', 'scrimyds'],
  WR: ['reyds', 'rec', 'retd'],
  TE: ['reyds', 'rec', 'retd'],
}

/** the position's slug in a page's address */
export const POS_SLUG: Record<Pos, string> = { QB: 'quarterbacks', RB: 'running-backs', WR: 'receivers', TE: 'tight-ends' }
export const posFromSlug = (slug: string): Pos | null => (Object.entries(POS_SLUG).find(([, s]) => s === slug)?.[0] as Pos | undefined) ?? null
export const teamSlug = (code: string): string => code.toLowerCase()
export const teamFromSlug = (slug: string): string | null => Object.keys(TEAMS).find((c) => teamSlug(c) === slug) ?? null

/** how many curves a chart draws */
export const CURVES = 8
/** games a player needs for the franchise to be listed */
export const MIN_GAMES = 5

export interface GroupRow {
  id: string
  name: string
  from: number
  to: number
  games: number
  /** per metric, the total over his games for the franchise */
  totals: number[]
  /** per metric, the cumulative value after each game, for the top rows only */
  curves?: number[][]
}

export interface GroupData {
  team: string
  name: string
  pos: Pos
  metrics: StatKey[]
  since: number
  currentSeason: number
  /** every qualifying player, ranked by the first metric */
  rows: GroupRow[]
}

/** a metric's value in one game; a QB's win is a win he started */
const reader = (k: StatKey) => {
  const s = statByKey(k)
  return s.startsOnly ? (g: Game) => (g.started ? s.read(g) : 0) : s.read
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** the page's data for one franchise and position, from that position's ledger */
export function groupData(L: Ledger, team: string, { top = CURVES, minGames = MIN_GAMES } = {}): GroupData {
  const pos = L.pos
  const metrics = GROUP_METRICS[pos]
  const reads = metrics.map(reader)
  const rows: (GroupRow & { gs: Game[] })[] = []
  for (const p of L.players) {
    const gs = p.games.filter((g) => g.team === team && !g.post)
    if (gs.length < minGames) continue
    const totals = reads.map((read) => gs.reduce((s, g) => s + read(g), 0))
    rows.push({ id: p.id, name: p.name, from: gs[0].season, to: gs[gs.length - 1].season, games: gs.length, totals, gs })
  }
  rows.sort((a, b) => b.totals[0] - a.totals[0] || b.games - a.games || a.name.localeCompare(b.name))
  for (const r of rows.slice(0, top)) {
    r.curves = reads.map((read) => { let cum = 0; return r.gs.map((g) => (cum += Math.max(0, read(g)))) })
  }
  // the franchise's first season in the ledger (the Texans began in 2002)
  const since = Math.min(...Object.keys(L.teamGames[team] ?? {}).map(Number).filter((s) => s >= L.firstSeason), L.currentSeason)
  return { team, name: TEAMS[team] ?? team, pos, metrics, since, currentSeason: L.currentSeason, rows: rows.map(({ gs, ...r }) => r) }
}

export const groupPath = (team: string, pos: Pos): string => `/team/${teamSlug(team)}/${POS_SLUG[pos]}/`

const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`)

/** "The Kansas City Chiefs' best quarterbacks since 1999" */
export const groupH1 = (d: Pick<GroupData, 'name' | 'pos' | 'since'>): string => `The ${possessive(d.name)} best ${POS_WORDS[d.pos]} since ${d.since}`
/** "Best Kansas City Chiefs quarterbacks since 1999 · NFL Comparator" */
export const groupTitle = (d: Pick<GroupData, 'name' | 'pos' | 'since'>, site: string): string => `Best ${d.name} ${POS_WORDS[d.pos]} since ${d.since} · ${site}`

/** "Patrick Mahomes leads with 32,352 passing yards in 128 games for the Chiefs; Alex Smith had 17,608." */
export function groupLead(d: GroupData): string {
  const stat = statByKey(d.metrics[0])
  const [a, b] = d.rows
  if (!a) return ''
  return `${a.name} leads with ${fmt(a.totals[0])} ${stat.noun} in ${a.games} games for the ${d.name}${b ? `; ${b.name} had ${fmt(b.totals[0])}` : ''}.`
}

export function groupDescription(d: GroupData): string {
  const stat = statByKey(d.metrics[0])
  return `${groupLead(d)} Every one of the ${possessive(d.name)} ${POS_WORDS[d.pos]} with ${MIN_GAMES} or more regular-season games since ${d.since}, ranked by ${stat.noun}, with each player's ${stat.noun} drawn game by game.`
    .replace(/\s+/g, ' ').trim()
}
