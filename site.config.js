// The one file to edit when you start a project from this template.
// The URL slug is NOT here: it is the "name" in package.json, and it has to
// equal the GitHub repo name, because the site serves at https://<domain>/<repo>/.
import { FIRST_SEASON } from './scripts/lib/window.mjs'

export default {
  domain: 'drewhoover.com',
  title: 'NFL Comparator',
  description:
    `Compare NFL players at the same point in their careers: wins through the first 150 starts, touchdowns through 120 games, 300-yard games in a season's first five. Build the comparison, see who stacks up, since ${FIRST_SEASON}.`,
  ogSubtitle: 'Same point in the career. Who stacks up.',
  ogImageAlt: 'A ranked list of NFL players compared at the same point in their careers, on a dark background.',
  accent: '#c36c36',
}
