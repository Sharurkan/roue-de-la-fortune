import { describe, expect, it } from 'vitest';
import type { GameDeps, ReduceResult } from './common';
import { POCKET_AMOUNTS, WHEELS } from './config';
import type { Phrase } from './phrases';
import { reduce } from './reducer';
import type { GameAction, GameState, PlayingState } from './state';

const PHRASE: Phrase = { theme: 'Film', text: 'Le Roi lion' };
const TOSS_UP: Phrase = { theme: 'Lieu', text: 'La tour Eiffel' };
const POCKET_SLOT = 0;

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

/** Round 3, team 0 to play with 200 € in its round score. */
function round3(): PlayingState {
  const start: GameAction = { type: 'startGame', teamNames: ['A', 'B'], firstRound: 3 };
  const state = playing(
    apply({ phase: 'setup' }, [
      start,
      { type: 'buzz', team: 0 },
      { type: 'submitSolution', answer: TOSS_UP.text },
    ]).state,
  );
  return { ...state, teams: state.teams.map((t, i) => (i === 0 ? { ...t, roundScore: 200 } : t)) };
}

const slotRandom = (POCKET_SLOT + 0.5) / 24;
/** Randoms: the slot, its part, the winning envelope (< 0.5: red), then the amount. */
const amountRandom = (index: number) => (index + 0.5) / POCKET_AMOUNTS.length;

function landOnPocket(winningRandom: number, amountIndex: number): ReduceResult {
  return apply(
    round3(),
    [{ type: 'spin' }, { type: 'spinEnded' }],
    deps([slotRandom, 0.5, winningRandom, amountRandom(amountIndex)]),
  );
}

describe('La Bonne Poche', () => {
  it('is on the round 3 wheel', () => {
    expect(WHEELS[2]?.[POCKET_SLOT]).toEqual({ kind: 'pocket' });
  });

  it('offers two envelopes, one of them holding a drawn amount', () => {
    const result = landOnPocket(0.2, 2);
    expect(playing(result.state).step).toEqual({
      kind: 'choosingPocket',
      winning: 'red',
      amount: POCKET_AMOUNTS[2],
    });
    expect(result.events).toEqual([{ type: 'pocketOffered', team: 0 }]);
  });

  it('the right envelope adds its amount and the team plays again', () => {
    const result = reduce(
      landOnPocket(0.2, 1).state,
      { type: 'choosePocket', color: 'red' },
      deps(),
    );
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(200 + (POCKET_AMOUNTS[1] ?? 0));
    expect(state.round.activeTeam).toBe(0);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(result.events).toEqual([
      { type: 'pocketOpened', team: 0, chosen: 'red', winning: 'red', amount: POCKET_AMOUNTS[1] },
    ]);
  });

  it('the empty envelope gives nothing and the turn passes', () => {
    const result = reduce(
      landOnPocket(0.7, 0).state,
      { type: 'choosePocket', color: 'red' },
      deps(),
    );
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(200);
    expect(state.round.activeTeam).toBe(1);
    expect(result.events).toContainEqual({ type: 'turnPassed', team: 1 });
  });

  it('refuses any other action while the envelopes are offered', () => {
    const offered = landOnPocket(0.2, 0).state;
    for (const action of [
      { type: 'spin' },
      { type: 'startSolving' },
      { type: 'guessConsonant', letter: 'L' },
    ] satisfies GameAction[]) {
      expect(reduce(offered, action, deps()).events).toEqual([
        { type: 'actionRejected', reason: 'wrongPhase' },
      ]);
    }
  });

  it('refuses an envelope when none is offered', () => {
    expect(reduce(round3(), { type: 'choosePocket', color: 'blue' }, deps()).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});
