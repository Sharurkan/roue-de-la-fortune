import { describe, expect, it } from 'vitest';
import { canAct, turnTeam } from './permissions';
import type { Phrase } from './phrases';
import type { FinalState, GameAction, GameState, PlayingState, Team, TossUpState } from './state';

const PHRASE: Phrase = { theme: 'Lieu', text: 'La tour Eiffel' };
const team = (name: string): Team => ({ name, roundScore: 0, totalScore: 0 });
const TEAMS = [team('Rouges'), team('Bleus'), team('Verts')];
const progress = { teams: TEAMS, roundNumber: 1, usedPhraseIndexes: [], usedTossUpIndexes: [] };

function playing(activeTeam: number): PlayingState {
  return {
    ...progress,
    phase: 'playing',
    step: { kind: 'choosing' },
    round: { phrase: PHRASE, guessedLetters: [], activeTeam },
  };
}

function tossUp(buzzer: number | null): TossUpState {
  return {
    ...progress,
    phase: 'tossUp',
    tossUp: { phrase: PHRASE, revealOrder: [], revealedCount: 0, buzzer, eliminated: [] },
  };
}

const final: FinalState = {
  phase: 'final',
  teams: TEAMS,
  finalist: 2,
  step: { kind: 'prizeWheel' },
  final: { phrase: PHRASE, prizeIndex: null, pickedLetters: [] },
};

const player = (teamIndex: number) => ({ team: teamIndex, isMaster: false });
const master = { team: 0, isMaster: true };
const allConnected = () => true;
const disconnected = (missing: number) => (t: number) => t !== missing;

describe('turnTeam', () => {
  it('is the active team during a round', () => {
    expect(turnTeam(playing(1))).toBe(1);
  });

  it('is the buzzer during a toss-up, nobody before the buzz', () => {
    expect(turnTeam(tossUp(2))).toBe(2);
    expect(turnTeam(tossUp(null))).toBeNull();
  });

  it('is the finalist during the final', () => {
    expect(turnTeam(final)).toBe(2);
  });

  it('is nobody between rounds', () => {
    expect(turnTeam({ phase: 'setup' })).toBeNull();
  });
});

describe('canAct', () => {
  const spin: GameAction = { type: 'spin' };

  it('lets only the active team play its turn', () => {
    expect(canAct(playing(1), spin, player(1), allConnected)).toBe(true);
    expect(canAct(playing(1), spin, player(2), allConnected)).toBe(false);
  });

  it('keeps the master from playing for a connected team', () => {
    expect(canAct(playing(1), spin, master, allConnected)).toBe(false);
  });

  it('lets the master play for a disconnected team', () => {
    expect(canAct(playing(1), spin, master, disconnected(1))).toBe(true);
  });

  it('never lets another player stand in for a disconnected team', () => {
    expect(canAct(playing(1), spin, player(2), disconnected(1))).toBe(false);
  });

  it('lets each team buzz only for itself', () => {
    const buzz: GameAction = { type: 'buzz', team: 1 };
    expect(canAct(tossUp(null), buzz, player(1), allConnected)).toBe(true);
    expect(canAct(tossUp(null), buzz, player(2), allConnected)).toBe(false);
    expect(canAct(tossUp(null), buzz, master, disconnected(1))).toBe(false);
  });

  it('lets only the buzzer answer the toss-up', () => {
    const answer: GameAction = { type: 'submitSolution', answer: 'x' };
    expect(canAct(tossUp(2), answer, player(2), allConnected)).toBe(true);
    expect(canAct(tossUp(2), answer, player(1), allConnected)).toBe(false);
    expect(canAct(tossUp(null), answer, player(2), allConnected)).toBe(false);
  });

  it('lets only the finalist play the final', () => {
    expect(canAct(final, spin, player(2), allConnected)).toBe(true);
    expect(canAct(final, spin, player(1), allConnected)).toBe(false);
  });

  it('keeps game management to the master', () => {
    const actions: GameAction[] = [
      { type: 'startGame', teamNames: ['A', 'B'] },
      { type: 'nextRound' },
      { type: 'abandonGame' },
      { type: 'newGame' },
    ];
    for (const action of actions) {
      expect(canAct(playing(1), action, master, allConnected)).toBe(true);
      expect(canAct(playing(1), action, player(1), allConnected)).toBe(false);
    }
  });

  it('refuses the actions sent by the TV itself', () => {
    const state: GameState = playing(0);
    expect(canAct(state, { type: 'spinEnded' }, master, allConnected)).toBe(false);
    expect(canAct(tossUp(null), { type: 'revealTossUpLetter' }, master, allConnected)).toBe(false);
  });
});
