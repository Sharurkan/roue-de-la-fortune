import { describe, expect, it } from 'vitest';
import type { GameDeps, ReduceResult } from './common';
import { FINAL_PRIZES } from './config';
import { pickFinalist } from './final';
import type { Phrase } from './phrases';
import { reduce } from './reducer';
import type { FinalState, GameAction, GameState, RoundOverState, Team } from './state';

const FINAL_PHRASE: Phrase = { theme: 'Objet', text: 'Une tondeuse' };
const PRIZE = { money1000: 1, voyage: 6 } as const;

function deps(randoms: number[] = []): GameDeps {
  let call = 0;
  return {
    random: () => randoms[call++] ?? 0,
    phrases: [{ theme: 'Film', text: 'Le Roi lion' }],
    finalPhrases: [FINAL_PHRASE],
  };
}

const team = (name: string, totalScore: number): Team => ({ name, roundScore: 0, totalScore });

function lastRoundOver(teams: Team[], winner: number): RoundOverState {
  return {
    phase: 'roundOver',
    winner,
    teams,
    roundNumber: 4,
    usedPhraseIndexes: [0],
    round: {
      phrase: { theme: 'Film', text: 'Le Roi lion' },
      guessedLetters: [],
      activeTeam: winner,
      startingTeam: 0,
    },
  };
}

function apply(state: GameState, actions: GameAction[], gameDeps = deps()): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const action of actions) result = reduce(result.state, action, gameDeps);
  return result;
}

function inFinal(state: GameState): FinalState {
  if (state.phase !== 'final') throw new Error(`Expected final, got ${state.phase}`);
  return state;
}

const TEAMS = [team('Rouges', 500), team('Bleus', 900)];
const prizeRandom = (index: number) => (index + 0.5) / FINAL_PRIZES.length;

/** The final, envelope drawn and RSTLNE given. */
function readyToPick(prizeIndex: number = PRIZE.money1000): FinalState {
  const start = reduce(lastRoundOver(TEAMS, 1), { type: 'nextRound' }, deps()).state;
  return inFinal(
    apply(start, [{ type: 'spin' }, { type: 'spinEnded' }], deps([prizeRandom(prizeIndex)])).state,
  );
}

const PICKS: GameAction[] = [
  { type: 'guessConsonant', letter: 'D' },
  { type: 'guessConsonant', letter: 'B' },
  { type: 'guessConsonant', letter: 'C' },
  { type: 'guessVowel', letter: 'O' },
];

const rejection = (reason: string) => [{ type: 'actionRejected', reason }];

describe('pickFinalist', () => {
  it('picks the highest total', () => {
    expect(pickFinalist([team('A', 100), team('B', 700), team('C', 300)], 0)).toBe(1);
  });

  it('on a tie, picks the winner of the last round', () => {
    expect(pickFinalist([team('A', 700), team('B', 700)], 1)).toBe(1);
  });

  it('on a tie without the last winner, picks the first tied team', () => {
    expect(pickFinalist([team('A', 100), team('B', 700), team('C', 700)], 0)).toBe(1);
  });
});

describe('final round', () => {
  it('starts after the 4th round with the best team and a final phrase', () => {
    const result = reduce(lastRoundOver(TEAMS, 0), { type: 'nextRound' }, deps());
    const state = inFinal(result.state);
    expect(state.finalist).toBe(1);
    expect(state.final.phrase).toEqual(FINAL_PHRASE);
    expect(state.step).toEqual({ kind: 'prizeWheel' });
    expect(result.events).toEqual([{ type: 'finalStarted', finalist: 1 }]);
  });

  it('draws an envelope with the injected randomness', () => {
    const start = reduce(lastRoundOver(TEAMS, 1), { type: 'nextRound' }, deps()).state;
    const result = reduce(start, { type: 'spin' }, deps([prizeRandom(PRIZE.voyage)]));
    expect(inFinal(result.state).final.prizeIndex).toBe(PRIZE.voyage);
    expect(result.events).toEqual([{ type: 'prizeWheelSpun', prizeIndex: PRIZE.voyage }]);
  });

  it('gives R S T L N E once the small wheel stops', () => {
    const start = reduce(lastRoundOver(TEAMS, 1), { type: 'nextRound' }, deps()).state;
    const result = apply(start, [{ type: 'spin' }, { type: 'spinEnded' }]);
    expect(inFinal(result.state).step).toEqual({ kind: 'pickingLetters' });
    expect(result.events).toEqual([
      { type: 'finalLettersGiven', letters: ['R', 'S', 'T', 'L', 'N', 'E'] },
    ]);
  });

  it('refuses letters before the envelope is drawn', () => {
    const start = reduce(lastRoundOver(TEAMS, 1), { type: 'nextRound' }, deps()).state;
    expect(reduce(start, { type: 'guessConsonant', letter: 'D' }, deps()).events).toEqual(
      rejection('wrongPhase'),
    );
  });

  it('refuses regular-round actions', () => {
    for (const action of [
      { type: 'buyVowel' },
      { type: 'startSolving' },
      { type: 'cancel' },
    ] satisfies GameAction[]) {
      expect(reduce(readyToPick(), action, deps()).events).toEqual(rejection('wrongPhase'));
    }
  });

  it('refuses the given letters and letters already picked', () => {
    expect(reduce(readyToPick(), { type: 'guessConsonant', letter: 'R' }, deps()).events).toEqual(
      rejection('letterAlreadyGuessed'),
    );
    const afterD = apply(readyToPick(), [{ type: 'guessConsonant', letter: 'D' }]).state;
    expect(reduce(afterD, { type: 'guessConsonant', letter: 'd' }, deps()).events).toEqual(
      rejection('letterAlreadyGuessed'),
    );
  });

  it('allows 3 consonants and 1 vowel, no more', () => {
    const consonants = apply(readyToPick(), PICKS.slice(0, 3)).state;
    expect(reduce(consonants, { type: 'guessConsonant', letter: 'P' }, deps()).events).toEqual(
      rejection('noPicksLeft'),
    );
    const vowelFirst = apply(readyToPick(), [{ type: 'guessVowel', letter: 'O' }]).state;
    expect(reduce(vowelFirst, { type: 'guessVowel', letter: 'A' }, deps()).events).toEqual(
      rejection('noPicksLeft'),
    );
  });

  it('keeps picked letters hidden until the last pick, then reveals them together', () => {
    const three = apply(readyToPick(), PICKS.slice(0, 3));
    expect(three.events).toEqual([{ type: 'finalLetterPicked', letter: 'C' }]);
    expect(inFinal(three.state).step).toEqual({ kind: 'pickingLetters' });
    const last = reduce(three.state, PICKS[3] ?? { type: 'cancel' }, deps());
    expect(inFinal(last.state).step).toEqual({ kind: 'solving' });
    expect(last.events).toEqual([
      { type: 'finalLetterPicked', letter: 'O' },
      { type: 'finalLettersRevealed', letters: ['D', 'B', 'C', 'O'] },
    ]);
  });

  it('a right answer wins the envelope: money is added to the total', () => {
    const solving = apply(readyToPick(PRIZE.money1000), PICKS).state;
    const result = reduce(solving, { type: 'submitSolution', answer: 'une tondeuse' }, deps());
    expect(result.state).toEqual({
      phase: 'gameOver',
      teams: [team('Rouges', 500), team('Bleus', 1900)],
      final: { finalist: 1, prizeIndex: PRIZE.money1000, won: true },
    });
    expect(result.events).toEqual([{ type: 'finalWon', finalist: 1, prizeIndex: PRIZE.money1000 }]);
  });

  it('a gift is won without changing the total', () => {
    const solving = apply(readyToPick(PRIZE.voyage), PICKS).state;
    const result = reduce(solving, { type: 'submitSolution', answer: 'Une tondeuse' }, deps());
    expect(result.state).toMatchObject({
      teams: TEAMS,
      final: { finalist: 1, prizeIndex: PRIZE.voyage, won: true },
    });
  });

  it('a wrong answer loses the envelope, with only one try', () => {
    const solving = apply(readyToPick(), PICKS).state;
    const result = reduce(
      solving,
      { type: 'submitSolution', answer: ' Une tronçonneuse ' },
      deps(),
    );
    expect(result.state).toMatchObject({
      phase: 'gameOver',
      teams: TEAMS,
      final: { finalist: 1, prizeIndex: PRIZE.money1000, won: false },
    });
    expect(result.events).toEqual([
      { type: 'finalLost', finalist: 1, prizeIndex: PRIZE.money1000, answer: 'Une tronçonneuse' },
    ]);
  });

  it('can be abandoned', () => {
    const result = reduce(readyToPick(), { type: 'abandonGame' }, deps());
    expect(result.state).toEqual({ phase: 'gameOver', teams: TEAMS, final: null });
  });
});
