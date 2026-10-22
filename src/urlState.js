// One write per change. A query change is a replaceState so the back stack
// doesn't grow; the analytics embed counts each write as a pageview. `href`
// is the address under the site's base (src/lib/url.ts toHref): a named
// board's path, or the query string at the root.
const BASE = import.meta.env.BASE_URL
export function writeUrl(href, mode = 'replace') {
  try {
    const url = new URL(window.location.href)
    const at = href.indexOf('?')
    url.pathname = `${BASE}${at < 0 ? href : href.slice(0, at)}`
    url.search = at < 0 ? '' : href.slice(at)
    if (mode === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  } catch {}
}
