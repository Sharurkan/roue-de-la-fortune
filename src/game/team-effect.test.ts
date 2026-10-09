import { describe, expect, it } from 'vitest';
import type { GameDeps, ReduceResult } from './common';
import type { Phrase } from './phrases';
import { reduce } from './reducer';
import type { GameAction, GameState, PlayingState } from './state';

// Consonants: L R N. Vowels: E O I.
const PHRASE: Phrase = { theme: 'Film', text: 'Le Roi lion' };
const TOSS_UP: Phrase = { theme: 'Lieu', text: 'La tour Eiffel' };
const SWAP_SLOT = 5;
const DIVIDE_SLOT = 10;

function deps(): GameDeps {
  return {
    random: () => 0,
    phrases: [PHRASE],
    finalPhrases: [PHRASE],
    tossUpPhrases: [TOSS_UP],
  };
}

function apply(state: GameState, actions: GameAction[]): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const action of actions) result = reduce(result.state, action, deps());
  return result;
}

function playing(state: GameState): PlayingState {
  if (state.phase !== 'playing') throw new Error(`Expected playing, got ${state.phase}`);
  return state;
}

/** Round 4 (all totals at stake): A has 1 000 €, B 3 000 €, C 501 €. A plays. */
function round4(): PlayingState {
  const state = playing(
    apply({ phase: 'setup' }, [
      { type: 'startGame', teamNames: ['A', 'B', 'C'], firstRound: 4 },
      { type: 'buzz', team: 0 },
      { type: 'submitSolution', answer: TOSS_UP.text },
    ]).state,
  );
  const scores = [1000, 3000, 501];
  return { ...state, teams: state.teams.map((t, i) => ({ ...t, roundScore: scores[i] ?? 0 })) };
}

function landOn(slot: number, letter: string): ReduceResult {
  return apply(round4(), [
    { type: 'spin', segmentIndex: slot },
    { type: 'spinEnded' },
    { type: 'guessConsonant', letter },
  ]);
}

describe('swap and divide slots', () => {
  it('landing asks for a consonant worth nothing', () => {
    const result = apply(round4(), [
      { type: 'spin', segmentIndex: SWAP_SLOT },
      { type: 'spinEnded' },
    ]);
    expect(playing(result.state).step).toEqual({
      kind: 'guessingConsonant',
      amount: 0,
      perLetter: false,
      effect: 'swap',
    });
    expect(result.events).toEqual([{ type: 'effectLanded', team: 0, effect: 'swap' }]);
  });

  it('a right consonant gives nothing, then the team must choose another team', () => {
    const state = playing(landOn(SWAP_SLOT, 'L').state);
    expect(state.teams[0]?.roundScore).toBe(1000);
    expect(state.step).toEqual({ kind: 'choosingTeam', effect: 'swap' });
  });

  it('an absent consonant passes the turn, with no effect', () => {
    const state = playing(landOn(SWAP_SLOT, 'T').state);
    expect(state.round.activeTeam).toBe(1);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(state.teams.map((t) => t.roundScore)).toEqual([1000, 3000, 501]);
  });

  it('swap exchanges the round scores, then the team plays again', () => {
    const result = reduce(landOn(SWAP_SLOT, 'L').state, { type: 'chooseTeam', team: 1 }, deps());
    const state = playing(result.state);
    expect(state.teams.map((t) => t.roundScore)).toEqual([3000, 1000, 501]);
    expect(state.round.activeTeam).toBe(0);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(result.events).toEqual([{ type: 'effectApplied', team: 0, target: 1, effect: 'swap' }]);
  });

  it('divide halves the round score of the chosen team, rounded down', () => {
    const result = reduce(landOn(DIVIDE_SLOT, 'N').state, { type: 'chooseTeam', team: 2 }, deps());
    expect(playing(result.state).teams.map((t) => t.roundScore)).toEqual([1000, 3000, 250]);
  });

  it.each([0, 3, -1, 1.5])('refuses to choose team %d', (team) => {
    const result = reduce(landOn(SWAP_SLOT, 'L').state, { type: 'chooseTeam', team }, deps());
    expect(result.events).toEqual([{ type: 'actionRejected', reason: 'invalidTeam' }]);
  });

  it('refuses any other action while choosing the team', () => {
    const choosing = landOn(SWAP_SLOT, 'L').state;
    for (const action of [
      { type: 'spin' },
      { type: 'buyVowel' },
      { type: 'startSolving' },
    ] satisfies GameAction[]) {
      expect(reduce(choosing, action, deps()).events).toEqual([
        { type: 'actionRejected', reason: 'wrongPhase' },
      ]);
    }
  });

  it('cannot choose a team outside of these slots', () => {
    const result = reduce(round4(), { type: 'chooseTeam', team: 1 }, deps());
    expect(result.events).toEqual([{ type: 'actionRejected', reason: 'wrongPhase' }]);
  });
});
