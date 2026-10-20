// Method notes: where the games come from and the rulings the words rest on.
export function Notes({ ledger }) {
  return (
    <section className="notes" aria-label="Method" id="method">
      <h2>Method</h2>
      <p>
        Every row is a player's games in order, with the box-score line and the result, from the{' '}
        <a href="https://github.com/nflverse/nflverse-data/releases">nflverse</a> weekly player stats and schedule
        (CC BY 4.0), 1999 to {ledger.currentSeason}, rebuilt from the files of {String(ledger.builtAt).slice(0, 10)}. Nothing free goes
        earlier, so every claim here reads "since 1999" even when it would hold further back.
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
        under a sentence, the records he set that were later broken, and the points where he is ahead of one of the ten
        biggest careers in the stat. The rows are scored in bits (how many could have held it, how deep the window, how
        long the lead held, by how much, how plainly it reads) and folded to one row per claim.
      </p>
      <p>
        A sibling of <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a>.
      </p>
    </section>
  )
}
