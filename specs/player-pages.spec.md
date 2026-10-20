# Player pages: what a player leads

Status: built locally 2026-10-20, uncommitted, for Drew's review in the browser
(`npm run records`, then `npm run dev` and `/player/00-0027939/` is Newton; `?tune=1`
opens the tuner). "What was built" at the end says what the code does and what it cost;
the sections before it are the method as planned that morning, and the rows they quote
still print.

Streak King's team page lists the streaks a team leads, active and all-time, under one
list rule with knobs. This is the same thing for a player: the comparisons he leads,
scored, deduplicated, plainest wording first. The brief that shaped it: a Cam Newton
fan has to find the places Newton stands out past Brady even though Brady's career is
the bigger one, and "most wins through the first 150 games" must not be followed by
"...the first 151 games".

## The unit is an interval, not a point

A query here is five slots with N free (CLAUDE.md). Fix everything but N (a *shape*:
QBs · wins · sum · starts · regular season · most) and the leader at each N is a function
of N. A player's rank-1 stretch is a set of N, and it comes in runs. Mahomes leads wins
through N starts from N=32 to N=123. That run is one claim, and 150 vs 151 is the same
row by construction, so the "round numbers" rule stops being a filter and becomes a
wording choice: the row is worded at the N inside its run where it scores best (a round
N is free, 151 costs 3 bits, a live lead is worded at its current N because that is the
post). The run's length is also the noise test the brief asked for. A lead that holds
from start 112 to start 144 is not a cherry-pick; one that holds at 14 only is worth the
little it scores, and one that starts before `minN` (8 games, 1 season, 3 team games)
is dropped.

Two readings of a shape make two kinds of row, both intervals (a third, peer rows, was
built and dropped; see "What was built"):

- **held**: rank 1 now, ties included, when the tie group is `admitTies` (4) or
  smaller. "One of four" is a held row with ties=4. A held row whose run reaches the
  player's current N while he is active is **live**: the claim grows each week, and it
  is what the digests will move.
- **set**: he was rank 1 when he got there. At each N the field is walked in the order
  the entities reached N and the running best is the record; the holders form a lineage
  with dates, and the next holder is the breaker. A set row is a run of N where he is in
  the lineage and not the current holder. This is the NFL record book's shape (set,
  held, broken by), and it is where a Newton page comes from: "35 passing + rushing
  TDs through his first season, 1st of 154 at the time, broken by Justin Herbert (36,
  Jan 3, 2021)"; "194 receptions through his first 2 seasons, broken by Michael Thomas"
  on Landry's.
Held ⊆ set up to ties, so the two never both show for the same N: the set row skips
the N the held row has.

## The score

Bits, the way `crownScore` is, so the terms add and a reader can see which one won.
`RECORDS` in `records.ts` holds the weights; nothing in a file depends on them, so a
tuner turns them without re-mining.

| term | formula | what it says |
|---|---|---|
| field | log2(field at N) | how many had the whole window (at the time, for a set row) |
| depth | depthW · log2(games in the window) | 150 starts is a bigger claim than 8; a season counts 17 |
| hold | holdW · log2(run length) | how many N the lead spans (a reach row: the games between its first and last milestone) |
| dominance | domW · log2(1 + (value − median) ÷ (q90 − median)) | how far above the field, in top-decile units |
| lead | leadW · log2(1 + (value − second) ÷ (q90 − median)) | how far above second |
| size | sizeW · log2(value), count and streak rows only | 39 games with 10+ carries beats 2 straight with a rushing TD |
| tier | −tiers[tier(stat, pos)] | headline 0, secondary 2, trivia 6: how a stat site ranks the stat |
| words | −(scope 1 · since 3 · a count 1, each of 1, streak 3 · a test 1 · roundness of N 0–3) | what the claim costs to say |
| live | +liveW (3) | still growing |
| set | setW (−3) | since broken |

Defaults: depthW 1, holdW 1.5, domW 2, leadW 2, sizeW 1. The top-decile unit
makes yards and wins and games comparable without a per-stat scale, and the log keeps
a 70-to-31 rushing-TD lead (Newton, through 140 starts) from swamping everything; the
first cut capped linear z-scores and every row hit the cap. A floor of 1 unit (50 for
yards) keeps a field of near-ties from dividing by zero.

Nothing here is "impressiveness"; it is a proxy, and the brief said so. The terms are
the things a stat desk cites (how many, how long, by how much, how plainly) and the
tuner is where they get weighed.

## One row per claim

Four folds, in order, all in `records.ts`:

1. **Interval**: one row per (shape, kind, run of N), above. Gaps of `gapTol` (2) N are
   bridged and counted as holes, so a one-start blip doesn't split a 90-start lead.
2. **Plainness** (`collapse`): the same claim under games vs starts and with or without
   the playoffs is one group. The plainest wording stands (the position's default
   sequence, regular season) and a fancier one folds under it when its run is inside
   the plain run's, with 10% slack. When the fancier run reaches further (Mahomes'
   wins lead holds to 152 with the playoffs and to 123 without) both stand, and the
   page shows them in one family.
3. **Same number** (`page`): the same value over the same stretch under another verb
   or a derived stat folds. 14 wins through 14 games, a win in each of 14, 14 straight
   wins: one row. 10 straight 3+ passing-TD games and 10 straight 3+ pass+rush-TD games:
   one row, under passing TDs (`COMPONENTS`: pass+rush TDs, total TDs, scrimmage yards,
   scrimmage TDs, giveaways fold under their parts when they add nothing).
4. **Family**: the page groups rows by stat and entity kind (career or season); the
   family's best row is its face and the rest fold under it, the way sub-streaks fold
   under a run. Newton's page has 15 families; the rushing-TD family's face is "10
   games with 2+ rushing TDs in his first 140 starts, 1st of 23, next 3" with 54 rows
   under it.

Different thresholds of a test stay separate rows (most 300-yard games and most
400-yard games are different claims a desk publishes) and sit in one family.

## Rulings the prototype forced

- **A player-season is in a field only when he played the window.** A field of every
  QB with a stat line that season had 2,077 player-seasons at N=7 and a median of 0, so
  every row hit the dominance cap and the field term was 11 bits. Now a QB-season is in
  the field at N when he started half of the team's first N games, and a back or
  receiver when he averaged `touches` (5) carries + targets over them. QB fields at
  N=7 are ~900, WR ~1,200.
- **A clean game needs a played floor.** "No interceptions" held for Garoppolo's
  one-attempt relief games, giving him 16 straight. A test with max 0 only passes a
  game the player played (`played`: QB 10+ attempts, RB 5+ carries + targets, WR/TE 3+
  targets). `query.ts` doesn't have this guard yet; the board and the page have to
  agree, so it moves into `holds` there in the shipping pass.
- **Fewest of a bad thing is a starts claim.** Fewest fumbles through N games was won
  by whoever played least. The mine walks a fewest-sum only over starts (QB); the other
  positions have no start flag and no such row for now.
- **No tests over the seasons sequence.** "5 straight seasons with a 4+ TD game" read
  as "5 straight with 4+ TDs"; a season item passing a per-game test means one game of
  it did. Seasons take sums only.
- **No playoffs on a season window.** "Through the team's first 19 games of a season,
  playoffs included" is a claim nobody makes; the scope switch applies to career
  sequences only.
- **"Each of" is a claim only when the count is the window.** `every` ranks by count,
  so rank 1 at N can be a count short of N; the mine admits an every row only when the
  leader's count is N, and the row is worded at the largest N of its run.
- **Count tests on a 0/1 stat are the sum.** Games with a win = wins; the mine skips
  them (every and streak on wins stay: "a win in each of his first 14", "21 straight").
- **N=17 of a season is a 2021-on field** (165 seasons), as the words say. The field
  term keeps it small; nothing pads 16-game seasons.
- **A set row's field is the field at the time.** Brady's "90 games with 2+ TDs in his
  first 150 starts" was 1st of 2 in 2010 because two careers had reached 150 starts; the
  field term says 1 bit, which is right.
- **Milestones are a grid**, 1 · 2.5 · 5 · 7.5 × a tick then every 5 ticks (wins 10,
  yards 1,000, TDs 10, receptions 50), so "fastest to 35,000" exists and "fastest to
  34,000" doesn't. A reach row's run is the milestones it is fastest to; it is worded at
  the largest.

## What the prototype found

Cost: all four positions mine in 25 s on this Mac (QB 728 shapes, 7.7 s), 72,000 rows
kept over the keep floor (4 bits), a page 5–11 KB gzipped for the longest careers
(Brady 23 families, 452 rows after collapse), median 43 rows for a QB with any row, 10
for a back. 235 of 415 QBs have a row; the rest led nothing at any N.

Pages, the top of each as it prints today. The score and its terms are on every row.

Newton: 39 games with 10+ carries in his first 140 starts (1st of 23, next 15; 31.6) ·
10 games with 2+ rushing TDs in his first 140 starts (28.3) · 46 games with 50+
rushing yards (26.5) · set: 90 games with a passing or rushing TD in his first 100
games, broken by Mahomes in 2024 (23.8) · 4 games with 2+ rushing TDs in NE's first
15 of 2020, one of 4 (22.7) · 14 straight wins to open 2015, one of 3 (18.6) · set: 2
straight 400-yard games as a rookie, broken by Prescott in 2023 (16.7) · peer: ahead of
Brady on passing yards through each of their first 105 games (14.9). Also in the TDs
family: 35 pass+rush TDs in his first season, broken by Herbert.

Mahomes: 73 games with 2+ passing TDs in his first 100 games, playoffs included (26.4)
· 135 pass+rush TDs through his first 50 starts, leads from the start to 96 (25.8) ·
wins: 94 through 120 starts, leads 32 to 123 with 5 holes, and live, 117 through his
first 152 games with the playoffs, leads 36 to 152 (24.7) · 8 straight 300-yard games
to open 2018, one of 2 (24.4) · 14 straight 250-yard games in his first 100 starts
(23.9) · fewest fumbles lost through 152 starts with the playoffs, live (21.4).

Brady: 10 straight 3+ TD games in his first 110 starts, leads 98 to 200 (31.2) · 10
straight to open 2007 (28.6) · 21 straight wins, playoffs included, leads 51 to 216
(28.1), with 116 wins through 150 starts under it (26.6; PFR's 115, the start-flag
ruling) · set: 90 games with 2+ TDs in 150 starts, broken by Rodgers (24.5) · 16-0 in
2007 (22.4).

Fitzpatrick: one held row (3 straight 400-yard games, 2018) and, before they were
dropped, peer rows at 7–11 bits. A journeyman's page is thin and low, which is right.

Nacua: 9 games with 150+ scrimmage yards in his first 48, live (29.9) · 12 games with
10+ receptions, live · fastest to every milestone from 50 to 250 receptions (36 games;
the gate's row) · 4 games with 10+ receptions in LA's first 7 of 2025, 1st of 1,232.

Landry: set, 12 straight 5+ reception games in his first 25, broken by Beckham (24.4);
set, 194 receptions through 2 seasons, broken by Thomas; peer, ahead of Reggie Wayne
on receiving yards through 94 games.

Henry: 34 straight 50-yard games in his first 158, 1st of 11, live (27.0) · 104
straight games with 10+ carries, live · 11 straight games with a TD to open 2024, one
of 4. Gibbs: 5 games with 3+ TDs in his first 54, one of 2, live; 49 scrimmage TDs
through 3 seasons, 1st of 618.

What this says about the score, for the tuner:

- Count and streak rows outscore the sum rows of the same family almost everywhere,
  because their top-decile unit is a game or two and the size term is new. Newton's
  face is 10+ carry games, a trivia stat at −6, over 70 rushing TDs through 140 starts
  (22.8, in the same family). That might be right for Newton. For Brady it puts "10
  straight 3+ TD games" over "116 wins through 150 starts". `sizeW`, `tiers.trivia`
  and the words costs are the levers; or the family face could be the plainest verb
  within a few bits of the best, Streak King's `pick: fewest`.
- Season rows and career rows land in the same range (Brady 28.6 for 2007's streak,
  28.1 for the 21), with the season's bigger field (~10 bits) against the career's
  depth and hold. That balance is accidental and should be a knob (`seasonW`).
- The streak verb over a career window ("longest streak within his first N games") is
  mostly a device for giving a streak a window; the real claim is the streak. It costs
  3 words-bits now. Dropping it from career sequences and keeping it for season windows
  ("8 straight 300-yard games to open 2018") is the simpler product.
- Every row carries its run ("leads from 112 to 144"), which is the receipt for the
  noise test. The page should print it.

## What we don't do

- No `since` era bound in the mine. It is the classic cherry-pick ("since 2011" makes
  four) and the board still offers it; the mine walks the whole ledger and the words
  say "since 1999". `words.since` (3 bits) is there for when it's added.
- No rookie field slot. "Among rookie seasons" is a real category and where Newton's
  2011 lives; it is a field filter on player-seasons (season = debut), one word, and a
  slot `query.ts` doesn't have. Next.
- No futility list. The brief's Cam fan doesn't want "most interceptions through 20
  starts"; the mine walks each stat in its good direction only. Streak King's curses
  list is the shape if we want one.
- No rate stats (yards per route run, QBR), no age windows, no coaches or teams: the
  spec's backlog, unchanged.
- No historical comparators: the field is careers that began 1999 or later and every
  claim says so. Manning, Favre and Brees's early years are not peers.

## Shipping it

- The build mines each position after the ledger and writes one file per player with a
  row (`dist/players/<id>.json`: shape, kind, run, value, second, field, ties, live,
  breaker, peer; no score), the way `crowns/<id>.json` works, plus an index of who has
  a page. A page scores and folds at load with `RECORDS`, so `?tune=1` can turn the
  knobs live, with the term table on each row and "copy as RECORDS".
- `/player/<id>/`, prerendered: name, position, seasons, teams; the families, each
  face expanded with its claim, place, run and terms, the rest behind "N more"; every
  row a link to its board (`url.ts` already carries the query and `t`, the open
  player). Held, live, set and peer are badges, not sections; a kind switch like the
  team page's active / all-time if the mixed list reads badly.
- The board gets a link to the open player's page, and the panel's claim links back.
- Golden lines, pinned the way Streak King's are, as complaints: Newton's page has a
  rushing-TD row in its top three; Landry's 194 through two seasons is a set row broken
  by Michael Thomas; Brady's 21 straight is one row, not three; Mahomes' wins family
  has a live row at his current N; no page shows a run that starts under `minN`; no
  clean-game row from a relief appearance. Plus the nesting test: a page's rows are
  the mine's rows for that player, folded and ordered, nothing added.
- The weekly digest follows from the same rows: a lineage that gains a holder this week
  is a record broken; a live row whose N+1 the player can take next week is within
  reach (`toMatch` does the arithmetic).

## Open questions

- The face of a family: the best score, or the plainest verb within a few bits of it?
  The first puts "39 games with 10+ carries" on top of Newton's page and I think that's
  fine; it puts a streak on top of Brady's and I'm less sure. WDYT? The tuner can show
  both.
- `admitTies` at 4 means "one of four" is a lead and "one of five" isn't. The PFF post
  was four. Streak King's medal rule (`admit.rank` 3) is the other way to let a #2 on
  the page; here a #2 at N isn't a record, so I'd rather widen the tie group than admit
  rank 2, maybe?
- `set` at −3 bits puts a broken record a little under a held one of the same size.
  The alternative is Streak King's two lists. One list with a badge reads better to me
  until the tuner says otherwise.

## What was built (2026-10-20)

Everything under "Shipping it", with these calls:

- `scripts/build-records.mjs` mines the four positions after the ledger (20 s on this
  Mac, now that the milestone grid stops at the ledger's biggest total; the first cut
  built a 20-million-entry grid per reach shape and took twice as long) and writes
  `public/players/<id>.json` for every player with a row above the keep floor (2,191
  files, 19 MB raw) and `public/players/index.json`. `public/players/` is gitignored;
  `npm run build` runs it first, `npm run records` runs it alone for the dev server.
- A file carries the rows' inputs (`FileRow`: shape, kind, interval, worded N, value,
  second, field, ties, median, top decile, live, breaker, peer) and no score;
  `decodePlayer` scores them with whatever knobs it gets, so the tuner re-scores and
  re-folds without a rebuild. It never re-words: the build picked each row's N under the
  shipped knobs, and `at` is in the file.
- `/player/<id>/` (`PlayerPage.jsx`, routed by `parseRoute` in `App.jsx` from the
  pathname the prerender or `main.jsx` passes in). The prerender writes one HTML per
  player (2,191 in 1.3 s, 37 MB) with the file embedded in a `player-data` script so the
  hydrate matches, a title and description from the page's face row, breadcrumb and
  Person JSON-LD, and every URL in the sitemap. The dev server serves the route through
  Vite's SPA fallback and the page fetches its file.
- The page: name, position, seasons, teams, games; the families, each face expanded with
  its claim, place, run and breaker, the rest behind "N more"; a kind badge per row
  (leads, live, set it, vs a great); every claim a link to its board with the player
  open. The panel on the board links to the page ("what he leads →"), the notes have a
  paragraph on it.
- The tuner (`?tune=1`, remembered in localStorage with its overrides, `?tune=0` off): a
  field per weight (`KNOB_PATHS`), the term table under every row, the family's score in
  its header, reset, and "copy as RECORDS", which puts the changed knobs on the clipboard.
- The `played` guard moved into `query.ts`'s `holds`, so the board and the page agree on
  clean-game tests; the panel's ledger reads the same function.
- `records.test.ts` pins the golden lines from "Shipping it" (Newton's rushing TDs in
  the top three, Landry's 194 broken by Thomas, Brady's 10 straight once not three times,
  Newton's 14-0 once not four times, a live wins row for Mahomes, the noise floor, no
  clean-game row from Garoppolo's relief games, reach rows on the grid), the file round
  trip, and the nesting of a page in the mine. The two mines in the file take ~12 s.

Dropped after Drew read the pages (2026-10-20): **peer rows**. The third kind of row was
"ahead of one of the stat's ten biggest careers at the same N over a run of at least
four" (Newton ahead of Brady on passing yards through each of their first 105 games,
24,355 to 24,252), scored by the peer's rank among the greats and the run's length.
On a page they read as filler: Russell Wilson ahead of someone on passing yards
through 100 starts is true and unimpressive, and a journeyman's page was mostly them.
The viral Mahomes/Brady post is a crossing, an event with a date, and that belongs to
the digest, not to a page's standing list. The mine, the file (v2) and the words no
longer carry them.

Also after that read: the board's panel opens under its row instead of above the list,
so opening a row far down shows the detail where the reader is looking, and a row past
the page's cut is shown when it is the open one; and a player finder (`PlayerFinder.jsx`,
the team picker's shape: a filter box over `players/index.json`, fetched on first open)
sits in the dateline of the board and of every player page.

Not done: the weekly digest (records broken, within reach), a rookie field slot,
`since`, a per-player OG image, and the `seasonW` knob. The open questions above stand; the tuner
is where they get answered.
