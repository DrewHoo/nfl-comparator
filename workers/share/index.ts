// The share worker: sits on drewhoover.com/nfl-comparator/* in front of
// GitHub Pages and makes a shared URL unfurl as itself. GitHub Pages serves
// one HTML for every query string; this is the piece that makes a board
// (?stat=…&n=…) or a comparison (…&t=<player>&vs=<peer>) read as its own
// page.
//
//   <head> rewrite  a board URL gets a title and description from its
//                   query and its leader (src/lib/share.ts boardText); a
//                   comparison gets both names, the claim and where the
//                   curves met (compareText). og:image points at the card.
//   /share/og.png   the board's top rows, or the comparison's two sides
//                   with the panel's chart, drawn on demand (card.ts): the
//                   worker fetches the ledger the prerender publishes at
//                   /data/<POS>.json, runs the site's own evaluate, and
//                   draws. Cached at the edge under CARD_VERSION.
//   analytics       one Mixpanel event per link preview (`share unfurl`,
//                   crawlers only) and per card (`share card`), sent
//                   server-side to the index site's project.
//
// Anything else, and anything that goes wrong, passes through untouched:
// this worker must never be the reason the site is down. The player pages
// are prerendered with their own card and pass through.

import { parseUrl, toUrl } from '../../src/lib/url.ts';
import { decodeLedger, type Ledger, type LedgerFile, type Pos } from '../../src/lib/ledger.ts';
import { evaluate, type Board, type Query, type Row } from '../../src/lib/query.ts';
import { compare, peerOf } from '../../src/lib/compare.ts';
import { boardText, compareText } from '../../src/lib/share.ts';
import { headWords, POS_WORDS, rowWords, seqWords } from '../../src/lib/words.ts';
import { countWords, statByKey } from '../../src/lib/stats.ts';
import { renderCard, type BoardCardRow, type Card } from './card.ts';

interface Env { ORIGIN?: string }

const BASE = '/nfl-comparator';
/** Bump on any change to what the card draws or how a URL reads; it keys the edge cache. */
const CARD_VERSION = '2026-10-21a';

// Analytics: one Mixpanel event per link preview, sent server-side to the
// index site's project (the public token its embed carries; a project token
// only writes). The client embed never sees an unfurl, because the bot that
// fetches a shared link runs no script, so this is the only place a share
// can be counted. Nothing personal goes: the crawler's name, its user agent
// only when it is a crawler (a person's browser string never goes, and
// neither does an IP: ip=0 tells Mixpanel not to geolocate), the country
// Cloudflare saw, the URL itself and its slots. A browser's visit is the
// embed's to count, so the head rewrite reports crawlers only; the card is
// reported whoever asked for it. A local origin (wrangler dev) reports nothing.
const MIXPANEL_TOKEN = '1c6a0f45b8a5768185a8d9a2f4d65452';
const AGENTS: [RegExp, string][] = [
  [/Slackbot|Slack-ImgProxy/i, 'slack'],
  [/Discordbot/i, 'discord'],
  [/TelegramBot/i, 'telegram'],
  [/WhatsApp/i, 'whatsapp'],
  [/LinkedInBot/i, 'linkedin'],
  [/redditbot/i, 'reddit'],
  [/Bluesky/i, 'bluesky'],
  [/Mastodon/i, 'mastodon'],
  [/Facebot.*Twitterbot|Twitterbot.*Facebot/i, 'imessage'],
  [/Twitterbot/i, 'twitter'],
  [/facebookexternalhit|Facebot/i, 'facebook'],
  [/Googlebot/i, 'google'],
  [/bingbot/i, 'bing'],
  [/Applebot/i, 'apple'],
  [/bot|crawler|spider|preview|fetch|embed|scraper/i, 'other-bot'],
];
const agentOf = (ua: string | null): string => AGENTS.find(([re]) => re.test(ua ?? ''))?.[1] ?? 'browser';

function report(ctx: ExecutionContext, request: Request, env: Env, event: string, props: Record<string, unknown>) {
  if (env.ORIGIN) return;
  try {
    const ua = request.headers.get('user-agent');
    const agent = agentOf(ua);
    const body = [{
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: `unfurl:${agent}`,
        $insert_id: crypto.randomUUID(),
        time: Math.floor(Date.now() / 1000),
        site: 'nfl-comparator',
        agent,
        // the crawler's own string, so an unrecognized one ('other-bot') can
        // be named and added to AGENTS; a browser's string stays private
        crawler: agent === 'browser' ? null : (ua ?? '').slice(0, 200),
        country: (request as Request & { cf?: { country?: string } }).cf?.country ?? null,
        ...props,
      },
    }];
    ctx.waitUntil(fetch('https://api.mixpanel.com/track?ip=0', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/plain' },
      body: JSON.stringify(body),
    }).then((r) => r.body?.cancel()).catch(() => {}));
  } catch {}
}
/** The URL itself and its slots, for an event: the query's five, the open player, the peer. */
const urlProps = (url: URL) => {
  const q = url.searchParams;
  const { query } = parseUrl(url.search);
  return {
    // the shared link as one string, and under Mixpanel's own name so its UI
    // treats it as the event's URL
    url: url.href,
    $current_url: url.href,
    path: url.pathname.replace(BASE, '') || '/',
    pos: query.pos, stat: query.stat, how: query.how, n: query.n, seq: query.seq, scope: query.scope, dir: query.dir,
    tests: q.get('tests'), since: query.since, t: q.get('t'), vs: q.get('vs'),
  };
};

const edge = (ttl: number) => ({ cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '400-599': 30 } } }) as RequestInit;
// a fresh cache key each UTC day: GitHub Pages ignores query strings, and the
// Tuesday refresh rewrites the ledgers without a worker deploy
const dayKey = () => new Date().toISOString().slice(0, 10);

// the ledgers, one per position, cached per isolate per day; a failed load
// falls back and retries on the next request rather than poisoning the cache
const ledgers = new Map<Pos, { day: string; data: Promise<Ledger> }>();
function loadLedger(origin: string, pos: Pos): Promise<Ledger> {
  const day = dayKey();
  const got = ledgers.get(pos);
  if (got?.day === day) return got.data;
  const data = (async () => {
    const res = await fetch(`${origin}${BASE}/data/${pos}.json?d=${day}`, edge(3600));
    if (!res.ok) { await res.body?.cancel(); throw new Error(`ledger ${pos} ${res.status}`); }
    return decodeLedger((await res.json()) as LedgerFile);
  })().catch((e) => { ledgers.delete(pos); throw e; });
  ledgers.set(pos, { day, data });
  return data;
}

const fmtN = (v: number) => v.toLocaleString('en-US');
const span = (r: Row) => (r.season != null ? `${r.season} ${r.team}` : r.from === r.to ? String(r.from) : `${r.from}–${r.to}`);
const unitOf = (q: Query) => (q.how === 'reach' ? seqWords(q.seq, 2) : q.how === 'sum' ? statByKey(q.stat).noun : 'games');
const scopeWords = (q: Query) => (q.scope === 'all' ? 'playoffs included' : 'regular season');

/** the board's card: the query as the heading, its top rows */
function boardCard(q: Query, board: Board, ledger: Ledger): Card {
  const rows: BoardCardRow[] = board.ranked.slice(0, 8).map((r) => ({
    rank: `${r.tied ? 'T' : ''}${r.rank}`, name: r.season != null ? `${r.player.name}` : r.player.name, span: span(r), value: fmtN(r.value ?? 0),
  }));
  if (!rows.length) for (const r of board.onTheWay.slice(0, 8)) rows.push({ rank: '·', name: r.player.name, span: `${r.reached} ${seqWords(q.seq, r.reached)} so far`, value: r.value == null ? '—' : fmtN(r.value), live: true });
  const who = q.seq === 'teamGames' ? 'player-seasons' : 'careers';
  return {
    heading: headWords(q),
    sub: `${POS_WORDS[q.pos]} · ${scopeWords(q)} · ${fmtN(board.ranked.length)} ${who}${q.since ? ` since ${q.since}` : ''}`,
    rows,
    footer: `${ledger.firstSeason}–${ledger.currentSeason} · drewhoover.com/nfl-comparator`,
  };
}

/** the comparison's card: both sides, the panel's lines, its chart */
function compareCard(q: Query, board: Board, row: Row, peer: Row, ledger: Ledger): Card {
  const stat = statByKey(q.stat);
  const value = (r: Row) => (r.value == null ? '—' : fmtN(r.value));
  const claim = (r: Row) => (r.value == null ? `${r.reached} ${seqWords(q.seq, r.reached)} so far` : r.season != null ? `${r.team}'s first ${q.n} games of ${r.season}` : q.how === 'reach' ? `to ${countWords(q.n, stat)}` : `through his first ${r.reached} ${seqWords(q.seq, r.reached)}`);
  const cmp = compare(row, peer, q);
  const lines: string[] = [];
  if (cmp) {
    const x = cmp.xs[0];
    lines.push(x ? `${row.player.name} ${x.kind} ${peer.player.name} at ${seqWords(q.seq, 1)} ${x.n}, ${countWords(x.value, stat)}.` : 'Their curves never met.');
    if (cmp.match) lines.push(`To match ${peer.player.name}'s ${countWords(cmp.them[cmp.match.at - 1], stat)} at ${seqWords(q.seq, 1)} ${cmp.match.at}, ${row.player.name} needs ${countWords(Math.max(0, cmp.match.need), stat)} over his next 5 ${seqWords(q.seq, 5)}.`);
  } else {
    lines.push(`${row.player.name}: ${rowWords(row, q)}.`);
    if (peer.value != null) lines.push(`${peer.player.name}: ${rowWords(peer, q)}.`);
  }
  const field = board.ranked.length;
  const place = (r: Row) => (r.complete && r.value != null ? `${r.tied ? 'T-' : ''}${r.rank} of ${fmtN(field)}` : 'inside the window');
  return {
    heading: `${row.player.name} vs ${peer.player.name}`,
    sub: `${headWords(q)} · ${scopeWords(q)}`,
    sides: [
      { name: row.player.name, value: value(row), unit: unitOf(q), claim: `${place(row)} · ${claim(row)}` },
      { name: peer.player.name, value: value(peer), unit: unitOf(q), claim: `${place(peer)} · ${claim(peer)}` },
    ],
    lines,
    chart: cmp ? { me: cmp.me, them: cmp.them, n: cmp.n, unit: seqWords(q.seq, 1) } : null,
    footer: `${ledger.firstSeason}–${ledger.currentSeason} · drewhoover.com/nfl-comparator`,
  };
}

/** the query, the open row and its peer for a URL; null when the URL says nothing the root doesn't */
async function readUrl(origin: string, search: string): Promise<{ q: Query; board: Board; ledger: Ledger; row: Row | null; peer: Row | null } | null> {
  const state = parseUrl(search);
  if (!toUrl(state)) return null;
  const ledger = await loadLedger(origin, state.query.pos);
  const board = evaluate(ledger, state.query);
  const row = state.open ? [...board.ranked, ...board.onTheWay].find((r) => r.key === state.open) ?? null : null;
  const peer = row ? peerOf(board, row, state.vs) : null;
  return { q: state.query, board, ledger, row, peer };
}

const content = (text: string) => ({ element(e: Element) { e.setAttribute('content', text); } });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = env.ORIGIN ?? 'https://drewhoover.com';

    // the dynamic card, cached at the edge under this deploy's version
    if (url.pathname === `${BASE}/share/og.png`) {
      try {
        const key = new Request(`${url.origin}${url.pathname}?v=${CARD_VERSION}&${url.searchParams}`, { method: 'GET' });
        const cached = await caches.default.match(key);
        const read = cached ? null : await readUrl(origin, url.search);
        report(ctx, request, env, 'share card', { ...urlProps(url), cached: !!cached, kind: url.searchParams.has('t') ? 'comparison' : 'board' });
        if (cached) return cached;
        if (!read) return Response.redirect(`${origin}${BASE}/og.png`, 302);
        const card = read.row && read.peer ? compareCard(read.q, read.board, read.row, read.peer, read.ledger) : boardCard(read.q, read.board, read.ledger);
        const png = await renderCard(card).arrayBuffer();
        if (!png.byteLength) throw new Error('empty render');
        const res = new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
        ctx.waitUntil(caches.default.put(key, res.clone()));
        return res;
      } catch (e) {
        console.log(JSON.stringify({ event: 'og_render_failed', url: url.search, error: String((e as Error)?.stack ?? e) }));
        // the committed board image, so a share still carries something
        return Response.redirect(`${origin}${BASE}/og.png`, 302);
      }
    }

    // everything else: origin, with <head> rewritten where the URL says more
    // than the prerendered page could. A same-zone subrequest skips the
    // worker and lands on GitHub Pages (and lets `wrangler dev` hit a local origin).
    // the origin's body has to arrive plain for HTMLRewriter to read it, so the
    // subrequest asks for no encoding (a local origin would gzip it)
    const headers = new Headers(request.headers);
    headers.delete('accept-encoding');
    const res = await fetch(new Request(`${origin}${url.pathname}${url.search}`, { method: request.method, headers }));
    try {
      if (request.method !== 'GET' || url.pathname !== `${BASE}/` || !url.search) return res;
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
      const read = await readUrl(origin, url.search);
      if (!read) return res;
      if (agentOf(request.headers.get('user-agent')) !== 'browser') report(ctx, request, env, 'share unfurl', urlProps(url));
      const text = read.row ? compareText(read.q, read.board, read.row, read.peer) : boardText(read.q, read.board);
      const canonical = toUrl({ query: read.q, open: read.row?.key ?? null, vs: read.peer?.key ?? null });
      const img = `${origin}${BASE}/share/og.png${canonical}`;
      const pageUrl = `${origin}${BASE}/${canonical}`;
      return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(text.title); } })
        .on('meta[name="description"]', content(text.description))
        .on('meta[property="og:title"]', content(text.title))
        .on('meta[property="og:description"]', content(text.description))
        .on('meta[property="og:url"]', content(pageUrl))
        .on('meta[property="og:image"]', content(img))
        .on('meta[property="og:image:alt"]', content(text.title))
        .on('meta[name="twitter:image"]', content(img))
        .on('meta[name="twitter:title"]', content(text.title))
        .on('meta[name="twitter:description"]', content(text.description))
        .transform(res);
    } catch (e) {
      console.log(JSON.stringify({ event: 'head_rewrite_failed', url: url.search, error: String((e as Error)?.stack ?? e) }));
      return res;
    }
  },
};
