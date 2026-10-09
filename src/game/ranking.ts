import type { Team } from './state';

export interface RankedTeam {
  team: number;
  rank: number;
}

/** Sorts by total score. Tied teams share the same rank (1, 1, 3). */
export function rankTeams(teams: readonly Team[]): RankedTeam[] {
  const sorted = teams
    .map((team, index) => ({ index, score: team.totalScore }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
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
