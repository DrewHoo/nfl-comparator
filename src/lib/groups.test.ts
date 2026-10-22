// The team pages against the ledger: the franchise leaders a fan knows,
// regular season only, since 1999.
import { describe, expect, it } from 'vitest'
import { decodeLedger, type LedgerFile } from './ledger.ts'
import { groupData, groupH1, groupPath, posFromSlug, teamFromSlug, TEAMS, MIN_GAMES, CURVES } from './groups.ts'
import qbFile from '../data/QB.json'
import wrFile from '../data/WR.json'

const QB = decodeLedger(qbFile as unknown as LedgerFile)
const WR = decodeLedger(wrFile as unknown as LedgerFile)

describe('team pages', () => {
  it('has a name for every franchise the ledger carries', () => {
    for (const t of Object.keys(QB.teamGames)) expect(TEAMS[t], t).toBeTruthy()
    expect(Object.keys(TEAMS)).toHaveLength(32)
  })

  it('ranks the Patriots quarterbacks by passing yards, Brady first, his wins as a starter', () => {
    const d = groupData(QB, 'NE')
    expect(d.rows[0].name).toBe('Tom Brady')
    expect(d.metrics).toEqual(['payds', 'patd', 'win'])
    // Brady's regular-season record as the Patriots' starter is 219-64 (2000-2019)
    expect(d.rows[0].totals[2]).toBe(219)
    expect(d.rows.every((r) => r.games >= MIN_GAMES)).toBe(true)
    expect(d.rows.filter((r) => r.curves).length).toBe(Math.min(CURVES, d.rows.length))
    expect(d.rows[0].curves![0].at(-1)).toBe(d.rows[0].totals[0])
  })

  it('starts the Texans in 2002 and carries the Rams through St. Louis', () => {
    expect(groupData(QB, 'HOU').since).toBe(2002)
    expect(groupData(WR, 'LA').rows.some((r) => r.name === 'Torry Holt')).toBe(true)
  })

  it('says the page and its address', () => {
    const d = groupData(QB, 'KC')
    expect(groupH1(d)).toBe("The Kansas City Chiefs' best quarterbacks since 1999")
    expect(groupPath('KC', 'QB')).toBe('/team/kc/quarterbacks/')
    expect(teamFromSlug('kc')).toBe('KC')
    expect(posFromSlug('tight-ends')).toBe('TE')
  })
})
