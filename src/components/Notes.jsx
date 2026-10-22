// What to read next, the citing ask, and the Method notes: where the games
// come from and the rulings the words rest on. The page's static copy.
import { track } from '../lib/analytics.ts'

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom'

export function Notes({ ledger }) {
  return (
    <>
      <section className="notes" aria-label="What to read next">
        <h2>What to read next</h2>
        <p>
          <a href="https://drewhoover.com/nba-comparator/">NBA Comparator</a> — the same comparator over every NBA
          career since 1946-47, Wilt and Jordan included, with a page for every player and what he leads.
        </p>
        <p>
          <a href="https://drewhoover.com/wnba-comparator/">WNBA Comparator</a> — the same comparator over every WNBA
          career since 1997.
        </p>
        <p>
          <a href="https://drewhoover.com/nhl-comparator/">NHL Comparator</a> — the same comparator over every NHL
          career since 1917-18, Gretzky and Howe included.
        </p>
        <p>
          <a href="https://drewhoover.com/cfb-comparator/">College Football Comparator</a> — every coach, team and player
          at the same point in their careers, since 1869, with the best players of each position at every school and
          conference.
        </p>
        <p>
          <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a> — the longest active and
          all-time winning and losing streaks in college football, under any definition, every FBS game since 1936.
        </p>
        <p>
          <a href="https://drewhoover.com/hostile-territory/">Hostile Territory</a> — every head coach's true road record
          against AP top-10 teams since 1936.
        </p>
        <p>
          <a href="https://drewhoover.com/how-many-rings/">How Many Rings?</a> — every person on a national-championship
          staff since 1990, ranked by the number of rings they can claim.
        </p>
        <p>
          <a href="https://drewhoover.com/collegiate-championships/">Collegiate Championships</a> — which schools have won
          the most NCAA championships, across 33 sports.
        </p>
        <p>
          <a href="https://drewhoover.com/cfb-all-time-records/">CFB All-Time Records</a> — all-time win-loss, bowl and
          national-title records for every FBS program.
        </p>
      </section>

      <section className="notes" aria-label="Using a comparison from here">
        <h2>Using a comparison from here</h2>
        <p>
          If a comparison from this page ends up in your article, broadcast, podcast or thread, please cite it: name the
          site and link to the board; the url encodes the comparison.
        </p>
        <p>
          The site is free and serves no ads. If you enjoyed using it, consider{' '}
          <a href={KOFI_URL} onClick={() => track('kofi', { from: 'notes' })}>buying me some server compute</a> or donating
          to The Internet Archive's <a href="https://archive.org/donate">Wayback Machine</a> (I am a monthly donor, FTR).
        </p>
      </section>

      <section className="notes" aria-label="Method" id="method">
        <h2>Method</h2>
        <p>
          Every row is a player's games in order, with the box-score line and the result, from the{' '}
          <a href="https://github.com/nflverse/nflverse-data/releases">nflverse</a> weekly player stats and schedule
          (CC BY 4.0), {ledger.firstSeason} to {ledger.currentSeason}, rebuilt from the files of {String(ledger.builtAt).slice(0, 10)}. Nothing free goes
          earlier, so every claim here reads "since {ledger.firstSeason}" even when it would hold further back.
        </p>
        <p>
          A <b>start</b> is the quarterback the schedule names for the game, which is the one who played most of it; Pro Football
          Reference counts a starter who was pulled early (Brady in the 2005 finale), and this doesn't, so a start count can
          run one or two off theirs. A <b>game</b> is one the player recorded a stat in, so a lineman's or a defender's games
          are not here yet, and only quarterbacks have starts. A <b>win</b> is the result of a game in the sequence.
          "Team games of a season" count the team's schedule, so a player who sat one has a gap the window still counts.
          The regular season is the default; the word beside it switches the playoffs in.
        </p>
        <p>
          Ranks are competition ranks, ties included. "Still inside the window" lists the players who haven't played the
          whole window yet, with their total so far. The panel reads a row against a peer: where their curves met, and
          what the player needs over the next five games to match the peer there.
        </p>
        <p>
          A player's page (from his name in the panel) lists every comparison he leads: the stretch of N where he is first
          under a sentence, and the records he set that were later broken. The rows are scored in bits (how many could have held it, how deep the window, how
          long the lead held, by how much, how plainly it reads) and folded to one row per claim.
        </p>
        <p>
          A sibling of <a href="https://drewhoover.com/nhl-comparator/">NHL Comparator</a>, <a href="https://drewhoover.com/nba-comparator/">NBA Comparator</a>, <a href="https://drewhoover.com/wnba-comparator/">WNBA Comparator</a> and{' '}
          <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a>.
        </p>
      </section>
    </>
  )
}
