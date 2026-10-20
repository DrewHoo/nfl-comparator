// The stat catalog: what a game can be counted by. Each stat reads one row
// of the ledger. `noun` is how a sum reads ("115 wins"), `test` how a
// per-game threshold reads ("300+ passing yards"), `pos` which position
// groups offer it. A win is the result of a game the player started, so it
// is a QB stat and needs the starts sequence (src/lib/query.ts enforces it).

import type { Game, Pos } from './ledger.ts'

export type StatKey =
  | 'win' | 'loss'
  | 'payds' | 'patd' | 'int' | 'cmp' | 'att' | 'sacked' | 'giveaways' | 'offtd'
  | 'car' | 'ruyds' | 'rutd'
  | 'rec' | 'tgt' | 'reyds' | 'retd'
  | 'scrtd' | 'scrimyds' | 'alltd' | 'fumlost'

export interface Stat {
  key: StatKey
  /** plural noun for a total: "passing yards" */
  noun: string
  /** singular for a count of 1: "passing yard" */
  one: string
  pos: Pos[]
  read: (g: Game) => number
  /** a result stat only counts in a game the player started */
  startsOnly?: boolean
  /** the per-game thresholds the test picker offers */
  thresholds: number[]
}

const S = (key: StatKey, noun: string, one: string, pos: Pos[], read: (g: Game) => number, thresholds: number[], startsOnly = false): Stat =>
  ({ key, noun, one, pos, read, thresholds, startsOnly })

export const STATS: Stat[] = [
  S('win', 'wins', 'win', ['QB'], (g) => (g.result === 2 ? 1 : 0), [1], true),
  S('loss', 'losses', 'loss', ['QB'], (g) => (g.result === 0 ? 1 : 0), [1], true),
  S('payds', 'passing yards', 'passing yard', ['QB'], (g) => g.payds, [200, 250, 280, 300, 350, 400]),
  S('patd', 'passing TDs', 'passing TD', ['QB'], (g) => g.patd, [1, 2, 3, 4, 5]),
  S('int', 'interceptions thrown', 'interception thrown', ['QB'], (g) => g.int, [0, 1, 2]),
  S('cmp', 'completions', 'completion', ['QB'], (g) => g.cmp, [20, 25, 30]),
  S('att', 'pass attempts', 'pass attempt', ['QB'], (g) => g.att, [30, 40, 50]),
  S('sacked', 'sacks taken', 'sack taken', ['QB'], (g) => g.sacked, [0, 1, 3, 5]),
  S('giveaways', 'giveaways', 'giveaway', ['QB', 'RB', 'WR', 'TE'], (g) => g.int + g.fumlost, [0, 1, 2]),
  S('offtd', 'passing + rushing TDs', 'passing or rushing TD', ['QB'], (g) => g.patd + g.rutd, [1, 2, 3, 4]),
  S('car', 'carries', 'carry', ['RB', 'QB', 'WR'], (g) => g.car, [10, 15, 20, 25]),
  S('ruyds', 'rushing yards', 'rushing yard', ['RB', 'QB', 'WR'], (g) => g.ruyds, [50, 100, 150, 200]),
  S('rutd', 'rushing TDs', 'rushing TD', ['RB', 'QB', 'WR'], (g) => g.rutd, [1, 2, 3]),
  S('rec', 'receptions', 'reception', ['WR', 'TE', 'RB'], (g) => g.rec, [5, 8, 10]),
  S('tgt', 'targets', 'target', ['WR', 'TE', 'RB'], (g) => g.tgt, [8, 10, 12]),
  S('reyds', 'receiving yards', 'receiving yard', ['WR', 'TE', 'RB'], (g) => g.reyds, [50, 75, 100, 150]),
  S('retd', 'receiving TDs', 'receiving TD', ['WR', 'TE', 'RB'], (g) => g.retd, [1, 2, 3]),
  S('scrtd', 'rushing + receiving TDs', 'rushing or receiving TD', ['RB', 'WR', 'TE'], (g) => g.rutd + g.retd, [1, 2, 3]),
  S('scrimyds', 'scrimmage yards', 'scrimmage yard', ['RB', 'WR', 'TE'], (g) => g.ruyds + g.reyds, [50, 100, 150, 200]),
  S('alltd', 'total TDs', 'total TD', ['QB', 'RB', 'WR', 'TE'], (g) => g.patd + g.rutd + g.retd, [1, 2, 3, 4]),
  S('fumlost', 'fumbles lost', 'fumble lost', ['QB', 'RB', 'WR', 'TE'], (g) => g.fumlost, [0, 1]),
]

export const statByKey = (key: StatKey): Stat => {
  const s = STATS.find((x) => x.key === key)
  if (!s) throw new Error(`no stat ${key}`)
  return s
}

export const statsFor = (pos: Pos): Stat[] => STATS.filter((s) => s.pos.includes(pos))

/** the words of a count: "1 win", "115 wins", "3,000 passing yards" */
export function countWords(n: number, stat: Stat): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? stat.one : stat.noun}`
}
