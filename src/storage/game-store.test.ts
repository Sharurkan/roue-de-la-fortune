import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reduce, type GameDeps } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import { loadGame, saveGame } from './game-store';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const DEPS: GameDeps = {
  random: () => 0,
  phrases: [{ theme: 'Film', text: 'Le Roi lion' }],
  finalPhrases: [{ theme: 'Objet', text: 'Une tondeuse' }],
  tossUpPhrases: [{ theme: 'Lieu', text: 'La tour Eiffel' }],
};

function play(actions: GameAction[]): GameState {
  let state: GameState = INITIAL_STATE;
  for (const action of actions) state = reduce(state, action, DEPS).state;
  return state;
}

const WIN_TOSS_UP: GameAction[] = [
  { type: 'buzz', team: 0 },
  { type: 'submitSolution', answer: 'la tour eiffel' },
];
const START_GAME: GameAction = { type: 'startGame', teamNames: ['Rouges', 'Bleus', 'Verts'] };
const START: GameAction[] = [START_GAME, ...WIN_TOSS_UP];
const WIN_ROUND: GameAction[] = [
  { type: 'startSolving' },
  { type: 'submitSolution', answer: 'le roi lion' },
  { type: 'nextRound' },
];
const NEXT_ROUND: GameAction[] = [...WIN_ROUND, ...WIN_TOSS_UP];
const TO_FINAL: GameAction[] = [
  ...START,
  ...NEXT_ROUND,
  ...NEXT_ROUND,
  ...NEXT_ROUND,
  ...WIN_ROUND,
];
const PICKS: GameAction[] = [
  { type: 'guessConsonant', letter: 'D' },
  { type: 'guessConsonant', letter: 'B' },
  { type: 'guessConsonant', letter: 'C' },
  { type: 'guessVowel', letter: 'O' },
];

describe('game store', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds nothing at first', () => {
    expect(loadGame()).toEqual({ kind: 'empty' });
  });

  it.each([
    ['setup', []],
    [
      'a toss-up, letters shown',
      [START_GAME, { type: 'revealTossUpLetter' }, { type: 'revealTossUpLetter' }],
    ],
    [
      'a toss-up, after a wrong answer',
      [START_GAME, { type: 'buzz', team: 1 }, { type: 'submitSolution', answer: 'non' }],
    ],
    [
      'a turn',
      [...START, { type: 'spin' }, { type: 'spinEnded' }, { type: 'guessConsonant', letter: 'L' }],
    ],
    ['a spinning wheel', [...START, { type: 'spin' }]],
    [
      'the end of a round',
      [...START, { type: 'startSolving' }, { type: 'submitSolution', answer: 'le roi lion' }],
    ],
    ['an abandoned game', [...START, { type: 'abandonGame' }]],
    [
      'the final, letters being picked',
      [
        ...TO_FINAL,
        { type: 'spin' },
        { type: 'spinEnded' },
        { type: 'guessConsonant', letter: 'D' },
      ],
    ],
    [
      'the end of the final',
      [
        ...TO_FINAL,
        { type: 'spin' },
        { type: 'spinEnded' },
        ...PICKS,
        { type: 'submitSolution', answer: 'une tondeuse' },
      ],
    ],
  ] satisfies [string, GameAction[]][])('saves and restores %s', (_, actions) => {
    const state = play(actions);
    expect(saveGame(state)).toBe(true);
    expect(loadGame()).toEqual({ kind: 'loaded', state });
  });

  it('rejects broken JSON', () => {
    storage.setItem('rdlf.game', '{not json');
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('rejects a save from another version', () => {
    storage.setItem('rdlf.game', JSON.stringify({ v: 999, state: INITIAL_STATE }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('rejects an inconsistent state', () => {
    const state = play(START);
    if (state.phase !== 'playing') throw new Error('Expected playing');
    const broken = { ...state, round: { ...state.round, activeTeam: 7 } };
    storage.setItem('rdlf.game', JSON.stringify({ v: 3, state: broken }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('rejects a toss-up with an unknown buzzer', () => {
    const state = play([START_GAME]);
    if (state.phase !== 'tossUp') throw new Error('Expected tossUp');
    const broken = { ...state, tossUp: { ...state.tossUp, buzzer: 5 } };
    storage.setItem('rdlf.game', JSON.stringify({ v: 3, state: broken }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('reports a blocked storage instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(loadGame()).toEqual({ kind: 'unreadable' });
    expect(saveGame(INITIAL_STATE)).toBe(false);
  });
});
