import { describe, expect, it } from 'vitest'
import { parseUrl, toUrl } from './url.ts'
import { DEFAULT_QUERY } from './query.ts'

describe('url', () => {
  it('the default query is the bare address', () => {
    expect(toUrl({ query: DEFAULT_QUERY, open: null })).toBe('')
    expect(parseUrl('').query).toEqual(DEFAULT_QUERY)
  })
  it('round-trips a test query', () => {
    const query = { ...DEFAULT_QUERY, how: 'every' as const, tests: [{ stat: 'payds' as const, min: 280 }, { stat: 'patd' as const, min: 1 }], n: 5, seq: 'teamGames' as const, since: 2011 }
    const url = toUrl({ query, open: '00-0039150' })
    expect(url).toBe('?how=every&n=5&seq=teamGames&since=2011&tests=payds%3A280%2Cpatd%3A1&t=00-0039150')
    expect(parseUrl(url)).toEqual({ query, open: '00-0039150' })
  })
  it('drops what it cannot read', () => {
    const { query } = parseUrl('?pos=K&stat=nope&n=-3&tests=payds:x,patd:2')
    expect(query.pos).toBe('QB')
    expect(query.n).toBe(150)
    expect(query.tests).toEqual([{ stat: 'patd', min: 2 }])
  })
  it('a position without starts falls back to games', () => {
    expect(parseUrl('?pos=WR&stat=rec&seq=starts').query.seq).toBe('games')
  })
})
