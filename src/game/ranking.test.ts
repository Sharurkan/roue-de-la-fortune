import { describe, expect, it } from 'vitest';
import { orderByRoundScore, rankTeams } from './ranking';

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

describe('orderByRoundScore', () => {
  const withRound = (roundScore: number) => ({ name: 'x', roundScore, totalScore: 0 });

  it('puts the best round score first', () => {
    expect(orderByRoundScore([withRound(100), withRound(900), withRound(400)])).toEqual([1, 2, 0]);
  });

  it('keeps the playing order on a tie', () => {
    expect(orderByRoundScore([withRound(0), withRound(0), withRound(0)])).toEqual([0, 1, 2]);
  });
});
