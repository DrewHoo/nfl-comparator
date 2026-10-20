// The records gate: golden lines written as the complaints they guard
// against, over the committed ledgers (the QB and WR mines run once per
// file, ~15s), plus the file round trip and the nesting of a page in the mine.
import { describe, expect, it } from 'vitest'
import { decodeLedger, type LedgerFile } from './ledger.ts'
import { RECORDS, decodePlayer, encodePlayer, milestones, mine, page, statOf, type RecordRow } from './records.ts'
import qbFile from '../data/QB.json'
import wrFile from '../data/WR.json'

const QB = decodeLedger(qbFile as unknown as LedgerFile)
const WR = decodeLedger(wrFile as unknown as LedgerFile)
const qbRows = mine(QB)
const wrRows = mine(WR)
const qb = (name: string) => QB.players.find((p) => p.name === name)!
const wr = (name: string) => WR.players.find((p) => p.name === name)!
const pageOf = (rows: RecordRow[], id: string, pos: 'QB' | 'WR') => page(rows, id, pos)
const allRows = (fams: ReturnType<typeof page>) => fams.flatMap((f) => [f.best, ...f.rest])

describe('golden pages', () => {
  it("Newton's page has a rushing-TD row in its top three families", () => {
    const fams = pageOf(qbRows, qb('Cam Newton').id, 'QB')
    expect(fams.slice(0, 3).map((f) => statOf(f.best))).toContain('rutd')
  })

  it("Landry's 194 receptions through two seasons is a set row, broken by Michael Thomas", () => {
    const rows = allRows(pageOf(wrRows, wr('Jarvis Landry').id, 'WR'))
    const r = rows.find((x) => x.kind === 'set' && x.shape.how === 'sum' && x.shape.stat === 'rec' && x.shape.seq === 'seasons' && x.at === 2)
    expect(r?.value).toBe(194)
    expect(r?.breaker?.name).toBe('Michael Thomas')
  })

  it("Brady's 10 straight 3+ TD games is one row, not one per TD stat", () => {
    const rows = allRows(pageOf(qbRows, qb('Tom Brady').id, 'QB'))
    const tens = rows.filter((x) => x.kind === 'held' && x.shape.how === 'streak' && x.value === 10 && x.shape.tests[0]?.min === 3 && x.shape.seq === 'starts' && x.shape.scope === 'reg' && x.season == null)
    expect(tens.map((x) => statOf(x))).toEqual(['patd'])
  })

  it("Newton's 14-0 start of 2015 is one row under wins, not one per verb", () => {
    const rows = allRows(pageOf(qbRows, qb('Cam Newton').id, 'QB'))
    const fourteen = rows.filter((x) => x.season === 2015 && statOf(x) === 'win' && x.value === 14)
    expect(fourteen).toHaveLength(1)
  })

  it("Mahomes' wins family has a live row at his current N", () => {
    const fams = pageOf(qbRows, qb('Patrick Mahomes').id, 'QB')
    const wins = fams.find((f) => f.key === 'win|career')!
    expect([wins.best, ...wins.rest].some((r) => r.live && r.shape.how === 'sum')).toBe(true)
  })

  it('no row starts under the noise floor', () => {
    for (const r of qbRows) if (r.shape.how !== 'reach') expect(r.lo).toBeGreaterThanOrEqual(RECORDS.minN[r.shape.seq])
  })

  it("Garoppolo's relief appearances make no clean-game row", () => {
    const rows = qbRows.filter((r) => r.player.name === 'Jimmy Garoppolo' && r.shape.tests[0]?.max === 0 && r.shape.how === 'streak' && r.value >= 16)
    expect(rows).toHaveLength(0)
  })

  it('a reach row is worded at a milestone on the grid', () => {
    for (const r of qbRows) if (r.shape.how === 'reach') expect(milestones(r.shape.stat, r.at)).toContain(r.at)
  })
})

describe('the file and the page', () => {
  it('a player file round-trips to the same scores', () => {
    const p = qb('Cam Newton')
    const mineRows = qbRows.filter((r) => r.player.id === p.id)
    const back = decodePlayer(JSON.parse(JSON.stringify(encodePlayer(p, mineRows, QB.currentSeason))))
    expect(back.map((r) => Math.round(r.score * 1000))).toEqual(mineRows.map((r) => Math.round(r.score * 1000)))
    expect(back.map((r) => r.breaker?.name ?? '')).toEqual(mineRows.map((r) => r.breaker?.name ?? ''))
  })

  it("a page's rows nest in the mine: every mined row is shown or folded, nothing is added", () => {
    const p = qb('Patrick Mahomes')
    const mineRows = qbRows.filter((r) => r.player.id === p.id)
    const fams = pageOf(qbRows, p.id, 'QB')
    const seen = new Set<RecordRow>()
    const walk = (r: RecordRow) => { seen.add(r); r.folded.forEach(walk) }
    allRows(fams).forEach(walk)
    expect(seen.size).toBe(mineRows.length)
    for (const r of seen) expect(mineRows).toContain(r)
    for (const f of fams) for (const r of f.rest) expect(r.score).toBeLessThanOrEqual(f.best.score)
  })
})
