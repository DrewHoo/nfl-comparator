import { describe, expect, it } from 'vitest'
import { parseUrl, toHref, toUrl } from './url.ts'
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
    expect(parseUrl(url)).toEqual({ query, open: '00-0039150', vs: null })
  })
  it('the peer rides with the open player, never alone', () => {
    expect(toUrl({ query: DEFAULT_QUERY, open: '00-0033873', vs: '00-0019596' })).toBe('?t=00-0033873&vs=00-0019596')
    expect(toUrl({ query: DEFAULT_QUERY, open: null, vs: '00-0019596' })).toBe('')
    expect(parseUrl('?t=00-0033873&vs=00-0019596').vs).toBe('00-0019596')
    expect(parseUrl('?vs=00-0019596').vs).toBe(null)
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
  it('a named board writes its path, with the open player and the peer riding along', () => {
    const query = { ...DEFAULT_QUERY, n: 100 }
    expect(toHref({ query, open: null })).toBe('most-wins-through-100-starts/')
    expect(toHref({ query, open: '00-0033873', vs: '00-0019596' })).toBe('most-wins-through-100-starts/?t=00-0033873&vs=00-0019596')
    expect(toUrl({ query, open: null })).toBe('?n=100')
    expect(toHref({ query: DEFAULT_QUERY, open: null })).toBe('')
    expect(toHref({ query: { ...query, scope: 'all' as const }, open: null })).toBe('?n=100&scope=all')
  })
  it("a landing page's params read over its query", () => {
    const base = { ...DEFAULT_QUERY, n: 100 }
    expect(parseUrl('', base).query).toEqual(base)
    expect(parseUrl('?t=00-0033873', base)).toEqual({ query: base, open: '00-0033873', vs: null })
    expect(parseUrl('?scope=all', base).query).toEqual({ ...base, scope: 'all' })
  })
})
