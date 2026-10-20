# NFL Comparator

Compare NFL players at the same point in their careers. Set the sentence (who · did what · how much · over which games · against whom) and the board ranks every career, or every player-season, by its value at that window: wins through the first 150 starts, touchdowns through 120 games, 280-yard games in a season's first five, the fewest games to 250 receptions. Open a row to read it against a peer: where their curves met, and what the player needs over the next five games to match.

The data is the nflverse weekly player stats and schedule (CC BY 4.0), 1999 on. Nothing free goes earlier, so every claim reads "since 1999". The planning spec and the research behind it are in the [cfb-streak-king](https://github.com/DrewHoo/cfb-streak-king) repo under `specs/`.

```bash
npm install
npm run fetch     # nflverse files into data/raw/
npm run ledger    # src/data/<POS>.json
npm test          # the known-answer gate
npm run dev
```

A sibling of [College Football Streak King](https://drewhoover.com/cfb-streak-king/).
