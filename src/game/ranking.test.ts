import { describe, expect, it } from 'vitest';
import { rankTeams } from './ranking';

const team = (totalScore: number) => ({ name: 'x', roundScore: 0, totalScore });

describe('rankTeams', () => {
  it('sorts teams by total score', () => {
    expect(rankTeams([team(100), team(300), team(200)])).toEqual([
      { team: 1, rank: 1 },
      { team: 2, rank: 2 },
      { team: 0, rank: 3 },
    ]);
  });

  it('gives tied teams the same rank', () => {
    expect(rankTeams([team(300), team(100), team(300)])).toEqual([
      { team: 0, rank: 1 },
      { team: 2, rank: 1 },
      { team: 1, rank: 3 },
    ]);
  });
});
