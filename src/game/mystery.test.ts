import { describe, expect, it } from 'vitest';
import type { GameDeps, ReduceResult } from './common';
import { MYSTERY_BONUS, MYSTERY_EFFECTS, WHEELS, type MysteryEffect } from './config';
import type { Phrase } from './phrases';
import { reduce } from './reducer';
import type { GameAction, GameState, PlayingState } from './state';

const PHRASE: Phrase = { theme: 'Film', text: 'Le Roi lion' };
const TOSS_UP: Phrase = { theme: 'Lieu', text: 'La tour Eiffel' };
const MYSTERY_SLOT = 12;
const LAND_ON_MYSTERY: GameAction[] = [
  { type: 'spin', segmentIndex: MYSTERY_SLOT },
  { type: 'spinEnded' },
];

function deps(randoms: number[] = []): GameDeps {
  let call = 0;
  return {
    random: () => randoms[call++] ?? 0,
    phrases: [PHRASE],
    finalPhrases: [PHRASE],
    tossUpPhrases: [TOSS_UP],
  };
}

function apply(state: GameState, actions: GameAction[], gameDeps = deps()): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const action of actions) result = reduce(result.state, action, gameDeps);
  return result;
}

function playing(state: GameState): PlayingState {
  if (state.phase !== 'playing') throw new Error(`Expected playing, got ${state.phase}`);
  return state;
}

/** Round 3, team 0 to play with 600 € in its round score. */
function round3(): PlayingState {
  const start: GameAction = { type: 'startGame', teamNames: ['A', 'B'], firstRound: 3 };
  const state = playing(
    apply({ phase: 'setup' }, [
      start,
      { type: 'buzz', team: 0 },
      { type: 'submitSolution', answer: TOSS_UP.text },
    ]).state,
  );
  return { ...state, teams: state.teams.map((t, i) => (i === 0 ? { ...t, roundScore: 600 } : t)) };
}

/** Randoms: the panel (< 0.5: effect), then the effect. */
function landOnMystery(panelRandom: number, effect?: MysteryEffect): ReduceResult {
  const effectRandom =
    effect === undefined ? 0 : (MYSTERY_EFFECTS.indexOf(effect) + 0.5) / MYSTERY_EFFECTS.length;
  return apply(round3(), LAND_ON_MYSTERY, deps([panelRandom, effectRandom]));
}

describe('mystery panel', () => {
  it('is on the round 3 wheel', () => {
    expect(WHEELS[2]?.[MYSTERY_SLOT]).toEqual({ kind: 'mystery', amount: 500 });
  });

  it('half of the time, it is just 500 € per consonant', () => {
    const result = landOnMystery(0.7);
    expect(playing(result.state).step).toEqual({
      kind: 'guessingConsonant',
      amount: 500,
      perLetter: true,
    });
    expect(result.events).toEqual([{ type: 'mysteryRevealed', team: 0, outcome: 'money' }]);
  });

  it.each([
    ['bonus', 600 + MYSTERY_BONUS],
    ['double', 1200],
  ] as const)('the %s bonus raises the round score and the team plays again', (effect, score) => {
    const result = landOnMystery(0.2, effect);
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(score);
    expect(state.round.activeTeam).toBe(0);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(result.events).toEqual([{ type: 'mysteryRevealed', team: 0, outcome: effect }]);
  });

  it.each([
    ['bankrupt', 0],
    ['half', 300],
  ] as const)('the %s penalty lowers the round score and the turn passes', (effect, score) => {
    const result = landOnMystery(0.2, effect);
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(score);
    expect(state.round.activeTeam).toBe(1);
    expect(result.events).toEqual([
      { type: 'mysteryRevealed', team: 0, outcome: effect },
      { type: 'turnPassed', team: 1 },
    ]);
  });

  it('its bankrupt wipes out the total too, like the wheel one', () => {
    const start = round3();
    const withTotal = { ...start, teams: start.teams.map((t) => ({ ...t, totalScore: 900 })) };
    const result = apply(withTotal, LAND_ON_MYSTERY, deps([0.2, 0.6]));
    expect(playing(result.state).teams.map((t) => t.totalScore)).toEqual([0, 900]);
  });

  it('the other effects never touch the total', () => {
    const start = round3();
    const withTotal = { ...start, teams: start.teams.map((t) => ({ ...t, totalScore: 900 })) };
    const result = apply(withTotal, LAND_ON_MYSTERY, deps([0.2, 0.9]));
    expect(playing(result.state).teams[0]?.totalScore).toBe(900);
  });
});
