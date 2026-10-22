// A team page: the best players of one position for one franchise
// (src/lib/groups.ts), ranked by the position's first metric, with one
// cumulative line per player for each metric and the table of every
// qualifying player. The data is computed by the prerender and embedded in
// the page (#player-data), so the client needs no ledger.
import { useEffect, useState } from 'react'
import { CoffeeIcon, ShareIcon } from './Icons.jsx'
import { PlayerFinder } from './PlayerFinder.jsx'
import { KOFI_URL } from './Notes.jsx'
import { useShare } from '../hooks/useShare.ts'
import { track } from '../lib/analytics.ts'
import { statByKey } from '../lib/stats.ts'
import { POS_WORDS } from '../lib/words.ts'
import { POSITIONS } from '../lib/ledger.ts'
import { groupH1, groupLead, groupTitle, groupPath, CURVES, FORMERLY, MIN_GAMES, TEAMS } from '../lib/groups.ts'
import { SITE } from '../lib/share.ts'

const BASE = import.meta.env.BASE_URL
const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const short = (name) => { const parts = name.split(' '); return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name }
const span = (a, b) => (a === b ? String(a) : `${a}–${b}`)
const at = (path) => `${BASE}${path.slice(1)}`

/** one cumulative line per player, the leader in cream, the rest faint; a hover lifts a line */
function Curves({ rows, m, stat }) {
  const lines = rows.filter((r) => r.curves?.[m]).slice(0, CURVES)
  if (!lines.length) return null
  const len = Math.max(...lines.map((r) => r.curves[m].length))
  const top = Math.max(1, ...lines.map((r) => r.curves[m][r.curves[m].length - 1]))
  const W = 560, H = 220, L = 42, R = 110, T = 12, B = 24
  const x = (i) => L + (i / Math.max(1, len - 1)) * (W - L - R)
  const y = (v) => T + (1 - v / top) * (H - T - B)
  const path = (c) => c.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [0, Math.round(top / 2), top]
  // the names in a column at the right edge, in the order the lines end, nudged apart
  const ends = lines.map((r, k) => ({ k, y: y(r.curves[m][r.curves[m].length - 1]) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11
  for (let i = ends.length - 1; i >= 0; i--) if (ends[i].y > H - B) ends[i].y = H - B - (ends.length - 1 - i) * 11
  const labelY = new Map(ends.map((e) => [e.k, e.y]))
  return (
    <figure className="gchart">
      <figcaption>{stat.noun} · by game</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stat.noun}, cumulative by game, ${lines.map((r) => r.name).join(', ')}`}>
        <line className="axis" x1={L} y1={y(0)} x2={W - R} y2={y(0)} />
        {ticks.map((t) => <text key={t} className="tick" x={L - 6} y={y(t) + 3} textAnchor="end">{fmt(t)}</text>)}
        <text className="tick" x={x(0)} y={H - 6} textAnchor="start">1</text>
        <text className="tick" x={x(len - 1)} y={H - 6} textAnchor="end">{len}</text>
        {lines.map((r, k) => (
          <g key={r.id} className={'gl' + (k === 0 ? ' lead' : '')}>
            <path d={path(r.curves[m])} />
            <line className="lead-line" x1={x(r.curves[m].length - 1)} y1={y(r.curves[m][r.curves[m].length - 1])} x2={W - R + 4} y2={labelY.get(k)} />
            <text x={W - R + 7} y={labelY.get(k) + 3}>{short(r.name)}</text>
          </g>
        )).reverse()}
      </svg>
    </figure>
  )
}

export function GroupPage({ team, pos, preload }) {
  const [data] = useState(preload ?? null)
  const { copied, share: send } = useShare()
  useEffect(() => { track('team page', { team, pos }) }, [team, pos])
  useEffect(() => { if (data) document.title = groupTitle(data, SITE) }, [data])
  const share = () => {
    send(data ? groupLead(data) || groupH1(data) : window.location.href, window.location.href)
    track('share team', { team, pos })
  }
  if (!data) return <main><h1>No page here</h1><p className="baserate">No page for {POS_WORDS[pos] ?? pos} of <code>{team}</code>.</p></main>
  const metrics = data.metrics.map((k) => statByKey(k))
  const others = POSITIONS.filter((p) => p !== data.pos)
  return (
    <main>
      <div className="dateline">
        <span><a href={BASE}>← the board</a> · drewhoover.com · {span(data.since, data.currentSeason)}</span>
        <span className="dateline-acts">
          <PlayerFinder />
          <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: 'icons team' })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
          <button className="ico" onClick={share} aria-label="Share this page"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1><span className="h1-site">{SITE}</span><span className="h1-words">{groupH1(data)}</span></h1>
      <p className="glead">{groupLead(data)}</p>
      <p className="baserate">
        Every one of the {data.name}' {POS_WORDS[data.pos]} with {MIN_GAMES} or more regular-season games since {data.since}, ranked by {metrics[0].noun}; the lines are each player's totals game by game, the top {Math.min(CURVES, data.rows.length)} drawn.
        {data.pos === 'QB' && <> A win is a game he started and won.</>}
        {FORMERLY[data.team] && <> The franchise was {FORMERLY[data.team]}.</>}
      </p>
      <div className="gcharts">
        {metrics.map((s, m) => <Curves key={s.key} rows={data.rows} m={m} stat={s} />)}
      </div>
      <section className="board" aria-label="The ranking">
        <div className="board-h"><span>{data.rows.length} {POS_WORDS[data.pos]} with {MIN_GAMES}+ games</span><span>{metrics[0].noun}</span></div>
        <table className="gtable">
          <thead><tr><th>#</th><th>player</th><th>seasons</th><th>games</th>{metrics.map((s) => <th key={s.key} className="num">{s.noun}</th>)}</tr></thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="xn">{i + 1}</td>
                <td className="gname">{r.page ? <a href={`${BASE}player/${encodeURIComponent(r.id)}/`}>{r.name}</a> : r.name}</td>
                <td className="xd">{span(r.from, r.to)}</td>
                <td className="num xd">{r.games}</td>
                {r.totals.map((v, m) => <td key={m} className={'num' + (m === 0 ? ' lead' : '')}>{fmt(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="notes" style={{ marginTop: 24 }}>
        Also for the {data.name}: {others.map((p, i) => <span key={p}>{i > 0 && ', '}<a href={at(groupPath(data.team, p))}>{POS_WORDS[p]}</a></span>)}. Every franchise: <a href={`${BASE}team/`}>the team pages</a>.
        The games are nflverse's weekly player stats since {data.since}, regular season only (the <a href={`${BASE}#method`}>Method</a> says where they fall short). A name links to the player's page where he has one.
      </p>
    </main>
  )
}

/** the index of every team page: the 32 franchises with a line of positions each */
export function GroupIndex({ since }) {
  return (
    <main>
      <div className="dateline"><span><a href={BASE}>← the board</a> · drewhoover.com</span></div>
      <h1><span className="h1-site">{SITE}</span><span className="h1-words">Every NFL team's best players by position</span></h1>
      <p className="baserate">The best quarterbacks, running backs, receivers and tight ends of all 32 franchises since {since}, each with the players' numbers drawn game by game.</p>
      <ul className="gindex">
        {Object.entries(TEAMS).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
          <li key={code}><b>{name}</b> {POSITIONS.map((p) => <a key={p} href={at(groupPath(code, p))}>{POS_WORDS[p]}</a>)}</li>
        ))}
      </ul>
    </main>
  )
}
