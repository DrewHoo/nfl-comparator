// The ledger: per player, every game with a stat line, in order. One file
// per position group, written by scripts/build-ledger.mjs in a compact array
// form; this decodes it into rows the engine reads.

export type Pos = 'QB' | 'RB' | 'WR' | 'TE'
export const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE']

export interface Game {
  season: number
  week: number
  post: boolean
  /** YYYYMMDD */
  date: number
  team: string
  opp: string
  /** true when the schedule names the player as the game's starting QB; null for every other position (the data has no start flag for them) */
  started: boolean | null
  /** 2 won, 1 tied, 0 lost */
  result: number
  /** the team's game number that season, regular season then postseason */
  tgn: number
  att: number
  cmp: number
  payds: number
  patd: number
  int: number
  sacked: number
  car: number
  ruyds: number
  rutd: number
  rec: number
  tgt: number
  reyds: number
  retd: number
  fumlost: number
}

export interface Player {
  id: string
  name: string
  /** YYYY-MM-DD or null */
  born: string | null
  /** the season the career began; before `firstSeason` for a career the ledger joins in progress */
  debut: number
  pos: Pos
  games: Game[]
}

export interface Ledger {
  builtAt: string
  firstSeason: number
  currentSeason: number
  pos: Pos
  players: Player[]
  /** team -> season -> [regular-season games played, all games played] */
  teamGames: Record<string, Record<string, [number, number]>>
}

export interface LedgerFile {
  v: number
  builtAt: string
  firstSeason: number
  currentSeason: number
  pos: Pos
  cols: string[]
  teams: string[]
  teamGames: Record<string, Record<string, [number, number]>>
  players: { id: string; name: string; born: string | null; debut: number; rows: number[][] }[]
}

export function decodeLedger(file: LedgerFile): Ledger {
  const c = Object.fromEntries(file.cols.map((k, i) => [k, i])) as Record<string, number>
  const need = ['season', 'week', 'post', 'date', 'team', 'opp', 'started', 'result', 'tgn', 'att', 'cmp', 'payds', 'patd', 'int', 'sacked', 'car', 'ruyds', 'rutd', 'rec', 'tgt', 'reyds', 'retd', 'fumlost']
  for (const k of need) if (!(k in c)) throw new Error(`ledger: column ${k} missing`)
  const players = file.players.map((p) => ({
    id: p.id,
    name: p.name,
    born: p.born,
    debut: p.debut,
    pos: file.pos,
    games: p.rows.map((r) => ({
      season: r[c.season], week: r[c.week], post: r[c.post] === 1, date: r[c.date],
      team: file.teams[r[c.team]] ?? '?', opp: file.teams[r[c.opp]] ?? '?',
      started: r[c.started] < 0 ? null : r[c.started] === 1, result: r[c.result], tgn: r[c.tgn],
      att: r[c.att], cmp: r[c.cmp], payds: r[c.payds], patd: r[c.patd], int: r[c.int], sacked: r[c.sacked],
      car: r[c.car], ruyds: r[c.ruyds], rutd: r[c.rutd], rec: r[c.rec], tgt: r[c.tgt], reyds: r[c.reyds], retd: r[c.retd],
      fumlost: r[c.fumlost],
    })),
  }))
  return { builtAt: file.builtAt, firstSeason: file.firstSeason, currentSeason: file.currentSeason, pos: file.pos, players, teamGames: file.teamGames }
}

/** whole years between a birth date and a YYYYMMDD game date; null without a birth date */
export function ageAt(born: string | null, date: number): number | null {
  if (!born) return null
  const by = Number(born.slice(0, 4)), bm = Number(born.slice(5, 7)), bd = Number(born.slice(8, 10))
  const y = Math.floor(date / 10000), m = Math.floor(date / 100) % 100, d = date % 100
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age--
  return age
}

/** "Sep 7, 2017" from a YYYYMMDD */
export function fmtDate(date: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Math.floor(date / 100) % 100 - 1]} ${date % 100}, ${Math.floor(date / 10000)}`
}
