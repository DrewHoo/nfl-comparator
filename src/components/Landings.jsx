// The named boards (src/lib/landing.ts), listed under the board by position:
// one real link per page, so a crawler reaches every one from the root, and
// a tap opens the query in place (the URL then writes the page's path).
import { LANDINGS, landingOf } from '../lib/landing.ts'
import { toHref } from '../lib/url.ts'
import { POS_WORDS, searchWords } from '../lib/words.ts'
import { POSITIONS } from '../lib/ledger.ts'

const BASE = import.meta.env.BASE_URL
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function Landings({ query, onOpen }) {
  const current = landingOf(query)
  return (
    <nav className="landings" aria-label="Named boards">
      <h2>Named boards</h2>
      <p className="landings-lede">The comparisons people look up, each at its own address. Any other sentence the pickers can make is a board too; these are the ones with a name.</p>
      {POSITIONS.map((pos) => (
        <div className="landings-group" key={pos}>
          <div className="fam-h"><span>{POS_WORDS[pos]}</span></div>
          <ul>
            {LANDINGS.filter((l) => l.query.pos === pos).map((l) => (
              <li key={l.slug}>
                <a href={`${BASE}${toHref({ query: l.query, open: null })}`} aria-current={current?.slug === l.slug ? 'page' : undefined} onClick={(e) => { e.preventDefault(); onOpen(l) }}>
                  {cap(searchWords(l.query))}{l.query.scope === 'all' ? ', playoffs included' : ''}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="landings-group">
        <div className="fam-h"><span>teams</span></div>
        <ul>
          <li><a href={`${BASE}team/`}>Every NFL team's best players by position</a></li>
        </ul>
      </div>
    </nav>
  )
}
