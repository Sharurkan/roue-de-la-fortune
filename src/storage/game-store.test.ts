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

const DEPS: GameDeps = { random: () => 0, phrases: [{ theme: 'Film', text: 'Le Roi lion' }] };

function play(actions: GameAction[]): GameState {
  let state: GameState = INITIAL_STATE;
  for (const action of actions) state = reduce(state, action, DEPS).state;
  return state;
}

const START: GameAction = { type: 'startGame', teamNames: ['Rouges', 'Bleus', 'Verts'] };

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
      'a turn',
      [START, { type: 'spin' }, { type: 'spinEnded' }, { type: 'guessConsonant', letter: 'L' }],
    ],
    ['a spinning wheel', [START, { type: 'spin' }]],
    [
      'the end of a round',
      [START, { type: 'startSolving' }, { type: 'submitSolution', answer: 'le roi lion' }],
    ],
    ['the end of the game', [START, { type: 'abandonGame' }]],
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
    const state = play([START]);
    if (state.phase !== 'playing') throw new Error('Expected playing');
    const broken = { ...state, round: { ...state.round, activeTeam: 7 } };
    storage.setItem('rdlf.game', JSON.stringify({ v: 1, state: broken }));
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
