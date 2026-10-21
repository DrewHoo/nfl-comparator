import { useEffect, useMemo, useRef, useState } from 'react'
import { Sentence } from './components/Sentence.jsx'
import { Board } from './components/Board.jsx'
import { Panel } from './components/Panel.jsx'
import { Notes, KOFI_URL } from './components/Notes.jsx'
import { PlayerPage } from './components/PlayerPage.jsx'
import { CoffeeIcon, ShareIcon } from './components/Icons.jsx'
import { PlayerFinder, loadIndex } from './components/PlayerFinder.jsx'
import { useShare } from './hooks/useShare.ts'
import { decodeLedger } from './lib/ledger.ts'
import { evaluate, normalize, DEFAULT_QUERY } from './lib/query.ts'
import { parseUrl, toUrl } from './lib/url.ts'
import { queryWords } from './lib/words.ts'
import { peerOf } from './lib/compare.ts'
import { boardText, compareText, shareText } from './lib/share.ts'
import { track } from './lib/analytics.ts'
import { writeUrl } from './urlState.js'
import qbFile from './data/QB.json'

// the QB ledger ships with the page (the default board is quarterbacks);
// the other positions load when picked
const QB = decodeLedger(qbFile)
const files = import.meta.glob('./data/*.json')
const cache = { QB }
async function loadLedger(pos) {
  if (cache[pos]) return cache[pos]
  const mod = await files[`./data/${pos}.json`]()
  cache[pos] = decodeLedger(mod.default)
  return cache[pos]
}

/** the route from a pathname: the board, or a player's page at player/<id>/ */
export function parseRoute(path) {
  const base = import.meta.env.BASE_URL
  const rel = (path ?? '').startsWith(base) ? path.slice(base.length) : (path ?? '').replace(/^\//, '')
  const m = /^player\/([^/]+)\/?$/.exec(rel)
  return m ? { kind: 'player', id: decodeURIComponent(m[1]) } : { kind: 'board' }
}

/** `path` and `preload` come from the prerender or main.jsx, never from window during render */
export default function App({ path = '', preload = null }) {
  const route = parseRoute(path)
  if (route.kind === 'player') return <PlayerPage id={route.id} preload={preload} firstSeason={QB.firstSeason} />
  return <BoardApp />
}

function BoardApp() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [open, setOpen] = useState(null)
  const [vs, setVs] = useState(null)
  const [ledger, setLedger] = useState(QB)
  const [pages, setPages] = useState(null)
  const booted = useRef(false)
  const rootTitle = useRef(null)
  const { copied, share: send } = useShare()

  // who has a page, so the panel links only where one exists; after mount, the prerender has no fetch
  useEffect(() => { let live = true; loadIndex().then((list) => { if (live) setPages(new Set(list.map((p) => p.id))) }); return () => { live = false } }, [])

  // URL state after mount, never during render: the prerender has no window
  useEffect(() => {
    const s = parseUrl(window.location.search)
    setQuery(s.query)
    setOpen(s.open)
    setVs(s.vs)
    rootTitle.current = document.title
    booted.current = true
    track('query', { words: queryWords(s.query) })
  }, [])

  // the position's ledger
  useEffect(() => {
    let live = true
    if (cache[query.pos]) { setLedger(cache[query.pos]); return }
    setLedger(null)
    loadLedger(query.pos).then((l) => { if (live) setLedger(l) })
    return () => { live = false }
  }, [query.pos])

  const board = useMemo(() => (ledger && ledger.pos === query.pos ? evaluate(ledger, query) : null), [ledger, query])
  const row = useMemo(() => (board && open ? [...board.ranked, ...board.onTheWay].find((r) => r.key === open) ?? null : null), [board, open])

  // the tab's title says what the share worker would write for this address,
  // so it never lags a picker change; the root address keeps the page's own
  useEffect(() => {
    if (!booted.current || !board) return
    const shared = toUrl({ query, open: row?.key ?? null, vs })
    document.title = !shared ? rootTitle.current : row ? compareText(query, board, row, peerOf(board, row, vs)).title : boardText(query, board).title
  }, [board, query, row, vs])

  const change = (q) => {
    const next = normalize(q)
    setQuery(next)
    if (next.pos !== query.pos) { setOpen(null); setVs(null) }
    writeUrl(toUrl({ query: next, open: next.pos !== query.pos ? null : open, vs: next.pos !== query.pos ? null : vs }), 'replace')
    track('query', { words: queryWords(next) })
  }
  const openRow = (key) => {
    const next = open === key ? null : key
    setOpen(next)
    setVs(null)
    writeUrl(toUrl({ query, open: next }), 'replace')
    if (next) track('open', { player: next })
  }
  // the peer the panel reads against, in the URL so a shared link opens the same comparison
  const setPeer = (key) => {
    setVs(key)
    writeUrl(toUrl({ query, open, vs: key }), 'replace')
    track('peer', { player: open, vs: key })
  }
  // the share sheet, or "text url" on the clipboard: the open row's claim, else the sentence
  const share = () => {
    send(shareText(query, board, row), window.location.href)
    track('share', { words: queryWords(query), player: open ?? undefined })
  }

  return (
    <main>
      <div className="dateline">
        <span>{`drewhoover.com · ${QB.firstSeason}–${QB.currentSeason}`}<span className="dateline-upd"> · updated {String(QB.builtAt).slice(0, 10)}</span></span>
        <span className="dateline-acts">
          <PlayerFinder />
          <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: 'icons board' })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
          <button className="ico" onClick={share} aria-label="Share this board"><ShareIcon /></button>
          {copied && <span className="toast">copied</span>}
        </span>
      </div>
      <h1>NFL Comparator</h1>
      <Sentence query={query} onChange={change} firstSeason={QB.firstSeason} />
      <p className="baserate">
        <span className="sr-only">{queryWords(query)}. </span>
        {`Same point in the career, every ${query.seq === 'teamGames' ? 'season' : 'career'} since ${query.since ?? QB.firstSeason}.`}
        {board && board.ranked[0] && board.ranked[0].value != null && <> The leader: <b>{board.ranked[0].player.name}</b>, {board.ranked[0].value.toLocaleString('en-US')}.</>}
      </p>
      {board ? <Board board={board} query={query} open={open} onOpen={openRow} panel={row && <Panel key={row.key} row={row} board={board} query={query} ledger={ledger} peerKey={vs} onPeer={setPeer} hasPage={pages?.has(row.player.id) ?? false} onClose={() => openRow(row.key)} onOpen={openRow} />} /> : <p className="loading">loading {query.pos}s…</p>}
      <Notes ledger={QB} />
      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> · data rebuilt weekly in season ·{' '}
        <a href="https://github.com/DrewHoo/nfl-comparator">source & receipts</a> ·{' '}
        <a href={KOFI_URL} onClick={() => track('kofi', { from: 'footer' })}>buy me a coffee</a>
      </footer>
    </main>
  )
}
