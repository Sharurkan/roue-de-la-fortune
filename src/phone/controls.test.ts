import { describe, expect, it } from 'vitest';
import { PHRASES } from '../game/phrases';
import { reduce, type GameDeps } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import { toPublicView } from '../protocol/view';
import { describeScreen, letterKeys, teamNamesFor } from './controls';

const DEPS: GameDeps = {
  random: () => 0,
  phrases: [
    PHRASES.find((p) => p.text === 'Le Roi lion') ?? { theme: 'Film', text: 'Le Roi lion' },
  ],
};

function screenAfter(actions: GameAction[]) {
  let state: GameState = INITIAL_STATE;
  for (const action of actions) state = reduce(state, action, DEPS).state;
  return describeScreen(toPublicView(state, []));
}

const START: GameAction = { type: 'startGame', teamNames: ['A', 'B'] };

describe('describeScreen', () => {
  it('shows the setup first', () => {
    expect(screenAfter([])).toEqual({ kind: 'setup' });
  });

  it('shows the turn choices, with a vowel not yet affordable', () => {
    expect(screenAfter([START])).toEqual({
      kind: 'turn',
      canSpin: true,
      canBuyVowel: false,
      noMoreConsonants: false,
      noMoreVowels: false,
    });
  });

  it('locks everything while the wheel spins', () => {
    expect(screenAfter([START, { type: 'spin' }])).toEqual({ kind: 'spinning' });
  });

  it('asks for a consonant with the segment value', () => {
    expect(screenAfter([START, { type: 'spin' }, { type: 'spinEnded' }])).toEqual({
      kind: 'consonant',
      value: 300,
    });
  });

  it('shows the solution input', () => {
    expect(screenAfter([START, { type: 'startSolving' }])).toEqual({ kind: 'solving' });
  });

  it('shows the end of the round with the winner', () => {
    const actions: GameAction[] = [
      START,
      { type: 'startSolving' },
      { type: 'submitSolution', answer: 'le roi lion' },
    ];
    expect(screenAfter(actions)).toEqual({ kind: 'roundOver', winner: 0 });
  });

  it('shows the end of the game', () => {
    const actions: GameAction[] = [
      START,
      { type: 'startSolving' },
      { type: 'submitSolution', answer: 'le roi lion' },
      { type: 'endGame' },
    ];
    expect(screenAfter(actions)).toEqual({ kind: 'gameOver' });
  });
});

describe('letterKeys', () => {
  it('greys out the letters already proposed', () => {
    expect(letterKeys('AEI', ['E'])).toEqual([
      { letter: 'A', used: false },
      { letter: 'E', used: true },
      { letter: 'I', used: false },
    ]);
  });
});

describe('teamNamesFor', () => {
  it('sends one name per team, even when some were never typed', () => {
    const typed: string[] = [];
    typed[0] = 'Les Rouges';
    expect(teamNamesFor(typed, 3)).toEqual(['Les Rouges', '', '']);
  });

  it('ignores names typed for teams that were removed', () => {
    expect(teamNamesFor(['A', 'B', 'C'], 2)).toEqual(['A', 'B']);
  });
});
