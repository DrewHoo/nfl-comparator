// One call for every custom event: the index site's embed, optional-chained,
// so a page without it (the dev server, the prerender) loses nothing.
type Analytics = { dhAnalytics?: { track: (name: string, props?: Record<string, unknown>) => void } }
export const track = (name: string, props?: Record<string, unknown>) => {
  try { (globalThis as Analytics).dhAnalytics?.track(name, props) } catch {}
}
