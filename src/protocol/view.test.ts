import { describe, expect, it } from 'vitest';
import { PHRASES, type Phrase } from '../game/phrases';
import { reduce, type GameDeps } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import { normalizeText } from '../game/text';
import { parseTvMessage, stateMessage } from './messages';
import { toPublicView } from './view';

function deps(phrase: Phrase, random = 0): GameDeps {
  return { random: () => random, phrases: [phrase], finalPhrases: [phrase] };
}

function play(phrase: Phrase, actions: GameAction[], random = 0): GameState {
  let state: GameState = INITIAL_STATE;
  for (const action of actions) state = reduce(state, action, deps(phrase, random)).state;
  return state;
}

const START: GameAction = { type: 'startGame', teamNames: ['Rouges', 'Bleus'] };

describe('toPublicView', () => {
  it('describes the setup', () => {
    const view = toPublicView(INITIAL_STATE, []);
    expect(view.phase).toBe('setup');
    expect(view.teams).toEqual([]);
  });

  it('describes a turn: active team, scores and what can be done', () => {
    const phrase = PHRASES[0] ?? { theme: 'Objet', text: 'Le Roi lion' };
    const view = toPublicView(play(phrase, [START]), [{ type: 'roundStarted', roundNumber: 1 }]);
    expect(view).toMatchObject({
      phase: 'playing',
      roundNumber: 1,
      activeTeam: 0,
      step: 'choosing',
      canSpin: true,
      canBuyVowel: false,
      lastEvents: [{ type: 'roundStarted', roundNumber: 1 }],
    });
    expect(view.teams.map((team) => team.name)).toEqual(['Rouges', 'Bleus']);
  });

  it('gives the consonant value after the wheel stops', () => {
    const phrase: Phrase = { theme: 'Film', text: 'Le Roi lion' };
    const state = play(phrase, [START, { type: 'spin' }, { type: 'spinEnded' }]);
    expect(toPublicView(state, [])).toMatchObject({
      step: 'guessingConsonant',
      consonantValue: 300,
      canSpin: false,
    });
  });

  it('describes the end of the game with a ranking', () => {
    const phrase: Phrase = { theme: 'Film', text: 'Le Roi lion' };
    const state = play(phrase, [
      START,
      { type: 'startSolving' },
      { type: 'submitSolution', answer: 'le roi lion' },
      { type: 'abandonGame' },
    ]);
    expect(toPublicView(state, []).ranking).toEqual([
      { team: 0, rank: 1 },
      { team: 1, rank: 1 },
    ]);
  });

  it('produces views accepted by the protocol', () => {
    const phrase: Phrase = { theme: 'Film', text: 'Le Roi lion' };
    const state = play(phrase, [START, { type: 'spin' }]);
    const view = toPublicView(state, [{ type: 'wheelSpun', segmentIndex: 0 }]);
    expect(parseTvMessage(stateMessage(view)).ok).toBe(true);
  });

  it.each(PHRASES)('never reveals "$text" nor its theme', (phrase) => {
    const states = [
      play(phrase, [START]),
      play(phrase, [START, { type: 'startSolving' }, { type: 'submitSolution', answer: 'x' }]),
      play(phrase, [
        START,
        { type: 'startSolving' },
        { type: 'submitSolution', answer: phrase.text },
      ]),
    ];
    for (const state of states) {
      const json = JSON.stringify(toPublicView(state, []));
      expect(json).not.toContain(phrase.text);
      expect(json.toUpperCase()).not.toContain(normalizeText(phrase.text));
      expect(json).not.toContain(phrase.theme);
    }
  });

  describe('final round', () => {
    const phrase: Phrase = { theme: 'Objet', text: 'Une tondeuse' };
    const winRound: GameAction[] = [
      { type: 'startSolving' },
      { type: 'submitSolution', answer: 'une tondeuse' },
      { type: 'nextRound' },
    ];
    const toFinal: GameAction[] = [START, ...winRound, ...winRound, ...winRound, ...winRound];
    const picks: GameAction[] = [
      { type: 'guessConsonant', letter: 'D' },
      { type: 'guessConsonant', letter: 'B' },
      { type: 'guessConsonant', letter: 'C' },
      { type: 'guessVowel', letter: 'O' },
    ];

    it('lets the finalist spin the small wheel', () => {
      expect(toPublicView(play(phrase, toFinal), [])).toMatchObject({
        phase: 'final',
        step: 'prizeWheel',
        // All totals are tied at 0: the winner of round 4 (team 2) goes to the final.
        activeTeam: 1,
        canSpin: true,
      });
    });

    it('never tells the phone which envelope was drawn before the end', () => {
      const actions: GameAction[] = [...toFinal, { type: 'spin' }];
      const view = toPublicView(play(phrase, actions), [{ type: 'prizeWheelSpun', prizeIndex: 3 }]);
      expect(view.lastEvents).toEqual([]);
      expect(view.finalResult).toBeNull();
      expect(JSON.stringify(view)).not.toContain('prizeIndex');
    });

    it('greys out R S T L N E and counts the picks left', () => {
      const actions: GameAction[] = [...toFinal, { type: 'spin' }, { type: 'spinEnded' }];
      const view = toPublicView(play(phrase, [...actions, picks[0] ?? START]), []);
      expect(view.guessedLetters).toEqual(['R', 'S', 'T', 'L', 'N', 'E', 'D']);
      expect(view.finalPicks).toEqual({ consonants: 2, vowels: 1 });
    });

    it('reveals the envelope once the final is over', () => {
      const actions: GameAction[] = [
        ...toFinal,
        { type: 'spin' },
        { type: 'spinEnded' },
        ...picks,
        { type: 'submitSolution', answer: 'une tondeuse' },
      ];
      const view = toPublicView(play(phrase, actions), []);
      expect(view.finalResult).toEqual({
        finalist: 1,
        won: true,
        prize: { kind: 'money', amount: 500 },
      });
      expect(parseTvMessage(stateMessage(view)).ok).toBe(true);
    });
  });
});
