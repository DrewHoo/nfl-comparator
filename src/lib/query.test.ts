// The known-answer gate: published factoids the ledger has to reproduce.
// Each pin says where the data's definition differs from the publisher's.
import { describe, expect, it } from 'vitest'
import { decodeLedger, type LedgerFile } from './ledger.ts'
import { crossings, curve, evaluate, toMatch, DEFAULT_QUERY, type Board } from './query.ts'
import qbFile from '../data/QB.json'
import wrFile from '../data/WR.json'

const QB = decodeLedger(qbFile as unknown as LedgerFile)
const WR = decodeLedger(wrFile as unknown as LedgerFile)
const row = (b: Board, name: string, season?: number) => [...b.ranked, ...b.onTheWay].find((r) => r.player.name === name && (season == null || r.season === season))
const player = (name: string) => QB.players.find((p) => p.name === name)!

describe('the gate', () => {
  it('Mahomes has 115 wins through his first 150 starts, playoffs included (r/NFLv2, Oct 2026)', () => {
    const b = evaluate(QB, { ...DEFAULT_QUERY, n: 150, scope: 'all' })
    const m = row(b, 'Patrick Mahomes')!
    expect(m.value).toBe(115)
    expect(m.reached).toBe(150)
    expect(m.complete).toBe(true)
    // the post has Brady at 115 too. PFR counts Brady's 2005 week 17 (started, pulled,
    // a loss) as a start; nflverse names Cassel that game's QB, so here Brady's 150th
    // start is PFR's 151st and he is one win up
    expect(row(b, 'Tom Brady')!.value).toBe(116)
  })

  it('Mahomes has 100 wins through his first 131 regular-season starts (Drew\'s memory of the post)', () => {
    const b = evaluate(QB, { ...DEFAULT_QUERY, n: 131, scope: 'reg' })
    expect(row(b, 'Patrick Mahomes')!.value).toBe(100)
  })

  it('Mahomes is 116-35 through his first 151 games, playoffs included (r/nfl, Oct 2026)', () => {
    const w = evaluate(QB, { ...DEFAULT_QUERY, seq: 'games', n: 151, scope: 'all' })
    const l = evaluate(QB, { ...DEFAULT_QUERY, stat: 'loss', seq: 'games', n: 151, scope: 'all' })
    expect(row(w, 'Patrick Mahomes')!.value).toBe(116)
    expect(row(l, 'Patrick Mahomes')!.value).toBe(35)
    // the post has Brady at 116-35 too, which is his record through 151 PFR starts;
    // by games played he has two relief appearances first (2000 wk 13, 2001 wk 2)
    expect(row(w, 'Tom Brady')!.value).toBe(114)
    expect(row(l, 'Tom Brady')!.value).toBe(37)
  })

  it('Bryce Young is one of four QBs since 2011 with 280+ yards and a TD in each of his team\'s first five games (PFF)', () => {
    const b = evaluate(QB, { ...DEFAULT_QUERY, how: 'every', tests: [{ stat: 'payds', min: 280 }, { stat: 'patd', min: 1 }], n: 5, seq: 'teamGames', since: 2011 })
    const all = b.ranked.filter((r) => r.all).map((r) => `${r.player.name} ${r.season}`).sort()
    expect(all).toEqual(['Aaron Rodgers 2011', 'Bryce Young 2026', 'Drew Brees 2013', 'Peyton Manning 2013'])
  })

  it('Josh Allen has the most passing + rushing TDs through 120 regular-season games since 1999, Mahomes had 280 (ESPN, Nov 2025)', () => {
    const b = evaluate(QB, { ...DEFAULT_QUERY, stat: 'offtd', seq: 'games', n: 120 })
    expect(b.ranked[0].player.name).toBe('Josh Allen')
    expect(row(b, 'Patrick Mahomes')!.value).toBe(280)
  })

  it('Puka Nacua reached 250 receptions in his 36th game, the fastest since 1999 (Rams PR)', () => {
    const b = evaluate(WR, { ...DEFAULT_QUERY, pos: 'WR', stat: 'rec', how: 'reach', n: 250, seq: 'games', dir: 'fewest' })
    expect(b.ranked[0].player.name).toBe('Puka Nacua')
    expect(b.ranked[0].value).toBe(36)
  })
})

describe('peer readings', () => {
  it('Mahomes ties and passes Brady on wins by start, playoffs included', () => {
    const q = { ...DEFAULT_QUERY, scope: 'all' as const }
    const m = curve(player('Patrick Mahomes'), q)
    const b = curve(player('Tom Brady'), q)
    const x = crossings(m, b)
    expect(x.length).toBeGreaterThan(0)
    expect(x.some((c) => c.kind === 'tied')).toBe(true)
    expect(x.map((c) => c.n)).toEqual([...x.map((c) => c.n)].sort((a, b) => a - b))
  })

  it('toMatch says what the subject needs over its next k games', () => {
    expect(toMatch([1, 2, 3], [2, 4, 6, 8, 10], 2)).toEqual({ need: 7, at: 5 })
    expect(toMatch([1, 2, 3], [2, 4], 2)).toBeNull()
  })
})
