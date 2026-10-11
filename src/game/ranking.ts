import type { Team } from './state';

export interface RankedTeam {
  team: number;
  rank: number;
}

/**
 * Sorts by total score. Tied teams share the same rank (1, 1, 3).
 * Teams with nothing are left out (after round 4 only the winner keeps money),
 * unless no team has anything.
 */
export function rankTeams(teams: readonly Team[]): RankedTeam[] {
  const scored = teams.map((team, index) => ({ index, score: team.totalScore }));
  const withMoney = scored.filter((entry) => entry.score > 0);
  const sorted = (withMoney.length > 0 ? withMoney : scored).sort(
    (a, b) => b.score - a.score || a.index - b.index,
  );
  return sorted.map((entry) => ({
    team: entry.index,
    rank: 1 + sorted.filter((other) => other.score > entry.score).length,
  }));
}

/** Team indexes by round score, highest first. Ties keep the playing order. */
export function orderByRoundScore(teams: readonly Team[]): number[] {
  return teams
    .map((team, index) => ({ index, score: team.roundScore }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.index);
}
