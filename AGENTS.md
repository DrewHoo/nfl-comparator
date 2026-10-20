# Idiosyncrasies of the data and the logic

What building the first version turned up that isn't obvious from the code or the
nflverse docs. CLAUDE.md has the layout; this is the list of places where the numbers
can surprise you. Add to it whenever a gate or a reader's correction teaches us one.

## The data

- **Team codes disagree between the two files.** The weekly stat rows carry a
  franchise's current code (LA, LAC, LV) in every season; the schedule carries the code
  of the day (STL, SD, OAK). Before `build-ledger.mjs` normalized the schedule to the
  current codes, 10,050 rows failed to join. The ledger uses the current code
  everywhere, so a 1999 Rams game reads "LA".
- **A row is a stat line, not an appearance.** nflverse's weekly stats have a row only
  when the player touched a play stat. KC's 2024 week 1 has 32 rows against 46 in the
  snap counts. So "games" here undercounts anyone who dressed and did nothing: Josh
  Allen's 2024 has 16 rows, not 17 (week 18 he played a series and recorded nothing),
  and ESPN's "281 TDs in his first 120 regular-season games" lands on our game 118 with
  280. Mahomes matched ESPN exactly, which is how we know the method is right and the
  appearance count is what differs. Linemen and defenders are not in the ledger for the
  same reason; defense would also need pbp-derived tackles, which won't match the
  gamebook.
- **The start flag is "the game's main QB", not "took the first snap".** The schedule's
  `home_qb_id`/`away_qb_id` is the only start flag in nflverse, and it names the QB who
  played most of the game. Pro Football Reference counts a starter who was pulled
  early. Brady's 2005 week 17 (8 attempts, Cassel the rest), 2014 week 17 and 2022 week
  18 are starts on PFR and not here, so he has 378 starts to PFR's 381 while his 383
  games match. That is why Brady is 116 at 150 starts here and 115 in the post: our
  150th start is PFR's 151st.
- **Both viral Brady/Mahomes posts counted PFR starts with the playoffs included.**
  "115 wins through their first 150 starts" and "116-35 through their first 151 career
  games" are the same sequence read one start apart, and the second post said "games"
  while counting starts. Mahomes matches both here because every game of his is a start;
  Brady's relief appearances (2000 week 13, 2001 week 2) make his "games" sequence two
  longer than his starts. Drew's own memory of the post, 100 wins in the 131st start,
  is exact for the regular season. The scope and the ordinal unit each move the number,
  so the words always carry both.
- **1999 and 2000 are unsupported upstream.** nflfastR dropped them for inconsistent
  sources; the files stay. Brady's season records 2000–2010 all matched the record books,
  so the gaps are elsewhere. A 1999 Steve Bono row with a blank team code is the one
  row the builder drops.
- **A career the ledger joins in progress has no first N.** Favre showed 89 wins
  "1999–2010" on the first board. `players.csv` has `rookie_season`, which the ledger
  carries as `debut`; a career that began before 1999 sits out career fields and counts
  only in player-season fields. A player with no rookie season falls back to the season
  of his first row.
- **Publishers disagree with each other on ordinals.** NFL Research had Mahomes'
  35,000th passing yard in his 122nd game; Wikipedia says 116. A gate pins one
  publisher's number and names the publisher.
- **Week numbers run on through the playoffs** (18–22 since 2021, 17–21 before), so a
  postseason row sorts after the regular season by week as well as by date. The `post`
  flag is `game_type !== 'REG'`.
- **Dates are YYYYMMDD integers**; age is birth date against game date, whole years.

## The logic

- **Sequences are four different things.** `games` is every stat-line game, `starts`
  only the flagged ones (QBs only; the picker hides it elsewhere), `seasons` groups games
  by season, `teamGames` counts the team's schedule. A win is the result of whatever
  game is in the sequence; nothing forces wins onto starts any more (that rule turned the
  "151 games" post into a starts query without saying so).
- **"Team games of a season" measures the team's first N, not the player's.** A player
  who missed game 3 fails "each of" and has a gap in a streak; a traded player's
  season uses his first team's schedule only. A player-season is complete when the team
  has played N games (regular or including the playoffs, by scope).
- **A seasons window is complete only when the Nth season is over.** "Through 10
  seasons" with 14 games left is still inside the window here; NFL Research counted it
  anyway. The row shows the total so far.
- **`reach` reuses `n` as the target.** "Fastest to 250 receptions" is `how: reach, n:
  250`, the value is the ordinal, and `dir: fewest` ranks it. An entity that never gets
  there has a null value and sits with the ones still inside the window.
- **`every` ranks by the count.** The value is the number of games that passed the
  test, so the qualifiers (count = N) lead and the near misses follow. An earlier version
  ranked the two groups separately and the near misses restarted at T1.
- **Ranks are competition ranks with ties**, the same as Streak King's. The `tied` flag
  is what draws the T.
- **Crossings are entries into a tie or a lead**, read on both curves at the same
  ordinal; the list in the panel shows the last six up to the longer of the window and
  the subject's own length, so a crossing past the window still shows.
- **`toMatch` is arithmetic, not a forecast**: the peer's total at N+5 less the
  subject's at N. It says nothing about pace.
- **Normalize runs before every evaluate and in `parseUrl`.** A stat the position
  doesn't have falls back to wins / rushing TDs / receptions; a test query with no tests
  gets the stat's second threshold; `starts` on a non-QB becomes `games`.

## Working here

- `rtk` rewrites `vitest` output and its parser fails on it; run
  `rtk proxy npx vitest run --reporter=verbose` to see which test failed and why.
- Node 22 strips types, so `scripts/*.mjs` import `src/lib/*.ts` directly; no build
  step for a script.
- Text in the OG card is glyph outlines through opentype.js pinned to 1.3.4 (2.x emits
  NaN paths) with the TTFs committed under `scripts/fonts/`, because sharp's librsvg
  never finds Google fonts. The favicon is the index site's, copied by `gen-favicon`.
- Vite 8 is rolldown: the per-position chunk is `build.rolldownOptions.output.codeSplitting`
  (`advancedChunks` is deprecated and warns).
- The dev-server preview config is `.claude/launch.json` (port 5175, gitignored).
- The deploy workflow refetches and rebuilds the ledger on the Tuesday schedule and on a
  manual run, never on a push; the ledgers in `src/data/` are what a push deploys, so
  commit them after a local `npm run ledger` when a code change should ship with fresh
  data.
