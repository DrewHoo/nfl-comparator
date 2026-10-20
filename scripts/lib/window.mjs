// The seasons the ledger covers. nflverse's per-game player stats start in
// 1999 (the research in the CFB repo's specs/research/nfl-data-sources.md);
// nflfastR stopped supporting 1999 and 2000, so the files stay but carry
// known gaps. The running season is the one whose files change nightly.
export const FIRST_SEASON = 1999
export const CURRENT_SEASON = 2026
