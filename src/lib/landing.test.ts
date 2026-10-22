import { describe, expect, it } from 'vitest'
import { LANDINGS, landingBySlug, landingFromPath, landingH1, landingOf, landingTitle, sameQuery } from './landing.ts'
import { DEFAULT_QUERY, normalize } from './query.ts'
import { h1Words, searchWords } from './words.ts'

describe('landing', () => {
  it('every slug is kebab-case and unique, every query normalized as written, none the root', () => {
    const slugs = LANDINGS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const l of LANDINGS) {
      expect(l.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(normalize(l.query)).toEqual(l.query)
      expect(sameQuery(l.query, DEFAULT_QUERY)).toBe(false)
    }
    expect(landingOf(DEFAULT_QUERY)).toBeNull()
  })
  it('a landing is found by its path and by its query', () => {
    const l = landingBySlug.get('most-wins-through-100-starts')!
    expect(landingFromPath('/nfl-comparator/most-wins-through-100-starts/')).toBe(l)
    expect(landingFromPath('/nfl-comparator/most-wins-through-100-starts')).toBe(l)
    expect(landingFromPath('most-wins-through-100-starts/')).toBe(l)
    expect(landingFromPath('/nfl-comparator/')).toBeNull()
    expect(landingFromPath('/nfl-comparator/player/00-0033873/')).toBeNull()
    expect(landingOf({ ...DEFAULT_QUERY, n: 100 })).toBe(l)
    expect(landingOf({ ...DEFAULT_QUERY, n: 100, scope: 'all' })).toBeNull()
  })
  it('the words are the search, then who, then the scope and the era', () => {
    expect(searchWords(DEFAULT_QUERY)).toBe('most wins through the first 150 starts')
    expect(h1Words(DEFAULT_QUERY)).toBe('Most wins through the first 150 starts in the NFL')
    expect(landingH1(landingBySlug.get('most-wins-through-150-starts-including-playoffs')!)).toBe('Most wins through the first 150 starts in the NFL, playoffs included')
    expect(landingH1(landingBySlug.get('most-rushing-yards-through-50-games')!)).toBe('Most rushing yards through the first 50 games by an NFL running back')
    expect(landingH1(landingBySlug.get('tight-ends-most-receptions-through-50-games')!)).toBe('Most receptions through the first 50 games by an NFL tight end')
    expect(landingH1(landingBySlug.get('fastest-to-250-receptions')!)).toBe('Fastest to 250 receptions by an NFL wide receiver')
    expect(landingH1(landingBySlug.get('300-passing-yards-in-each-of-first-5-games')!)).toBe("300+ passing yards in each of a team's first 5 games in the NFL")
    expect(landingH1(landingBySlug.get('most-100-yard-receiving-games-in-first-50-games')!)).toBe('Most games with 100+ receiving yards in the first 50 games by an NFL wide receiver')
    expect(landingTitle(landingBySlug.get('most-wins-through-100-starts')!, 1999)).toBe('Most wins through the first 100 starts in the NFL, since 1999')
    expect(h1Words({ ...DEFAULT_QUERY, since: 2011 })).toBe('Most wins through the first 150 starts in the NFL since 2011')
  })
})
