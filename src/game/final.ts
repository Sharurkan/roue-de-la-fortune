import {
  CONSONANTS,
  FINAL_CONSONANT_PICKS,
  FINAL_GIVEN_LETTERS,
  FINAL_PRIZES,
  FINAL_VOWEL_PICKS,
  MAX_ANSWER_LENGTH,
  VOWELS,
} from './config';
import {
  normalizeLetter,
  pickIndex,
  reject,
  updateTeam,
  type GameDeps,
  type ReduceResult,
} from './common';
import type { FinalState, Team } from './state';
import { positionAfter, spinTravel } from './wheel';
import { isSameAnswer, normalizeAnswer } from './text';

/** Highest total wins the final. On a tie, the winner of the last round, else the first team. */
export function pickFinalist(teams: readonly Team[], lastRoundWinner: number): number {
  const best = Math.max(...teams.map((team) => team.totalScore));
  if (teams[lastRoundWinner]?.totalScore === best) return lastRoundWinner;
  return teams.findIndex((team) => team.totalScore === best);
}

export function startFinal(teams: Team[], lastRoundWinner: number, deps: GameDeps): ReduceResult {
  const phrase = deps.finalPhrases[pickIndex(deps.random, deps.finalPhrases.length)];
  if (phrase === undefined) throw new Error('No final phrase available');
  const finalist = pickFinalist(teams, lastRoundWinner);
  return {
    state: {
      phase: 'final',
      teams,
      finalist,
      step: { kind: 'prizeWheel' },
      final: { phrase, prizeIndex: null, pickedLetters: [], wheelPosition: 0 },
    },
    events: [{ type: 'finalStarted', finalist }],
  };
}

/**
 * The force decides which envelope stops under the pointer, but what is inside
 * is drawn at random: the envelopes all look the same.
 */
export function spinPrizeWheel(
  state: FinalState,
  power: number | undefined,
  deps: GameDeps,
): ReduceResult {
  if (state.step.kind !== 'prizeWheel') return reject(state, 'wrongPhase');
  const prizeIndex = pickIndex(deps.random, FINAL_PRIZES.length);
  const from = state.final.wheelPosition;
  const travel = spinTravel(power ?? deps.random(), FINAL_PRIZES.length);
  const wheelPosition = positionAfter(from, travel, FINAL_PRIZES.length);
  return {
    state: {
      ...state,
      step: { kind: 'prizeSpinning', from, travel },
      final: { ...state.final, prizeIndex, wheelPosition },
    },
    events: [{ type: 'prizeWheelSpun', prizeIndex, from, travel }],
  };
}

export function prizeWheelStopped(state: FinalState): ReduceResult {
  if (state.step.kind !== 'prizeSpinning') return reject(state, 'wrongPhase');
  return {
    state: { ...state, step: { kind: 'pickingLetters' } },
    events: [{ type: 'finalLettersGiven', letters: Array.from(FINAL_GIVEN_LETTERS) }],
  };
}

function picksLeft(picked: readonly string[], letters: string, max: number): number {
  return max - picked.filter((letter) => letters.includes(letter)).length;
}

export function finalPicksLeft(state: FinalState): { consonants: number; vowels: number } {
  const picked = state.final.pickedLetters;
  return {
    consonants: picksLeft(picked, CONSONANTS, FINAL_CONSONANT_PICKS),
    vowels: picksLeft(picked, VOWELS, FINAL_VOWEL_PICKS),
  };
}

/** Picks one letter. Once every pick is made, all picked letters are revealed together. */
export function pickFinalLetter(
  state: FinalState,
  input: string,
  kind: 'consonant' | 'vowel',
): ReduceResult {
  if (state.step.kind !== 'pickingLetters') return reject(state, 'wrongPhase');
  const letter = normalizeLetter(input, kind === 'consonant' ? CONSONANTS : VOWELS);
  if (letter === null) return reject(state, 'invalidLetter');
  const picked = state.final.pickedLetters;
  if (FINAL_GIVEN_LETTERS.includes(letter) || picked.includes(letter)) {
    return reject(state, 'letterAlreadyGuessed');
  }
  const left = finalPicksLeft(state);
  if ((kind === 'consonant' ? left.consonants : left.vowels) <= 0) {
    return reject(state, 'noPicksLeft');
  }
  const next: FinalState = {
    ...state,
    final: { ...state.final, pickedLetters: [...picked, letter] },
  };
  const after = finalPicksLeft(next);
  if (after.consonants > 0 || after.vowels > 0) {
    return { state: next, events: [{ type: 'finalLetterPicked', letter }] };
  }
  return {
    state: { ...next, step: { kind: 'solving' } },
    events: [
      { type: 'finalLetterPicked', letter },
      { type: 'finalLettersRevealed', letters: next.final.pickedLetters },
    ],
  };
}

/** One try. A money prize is added to the finalist's total; a gift is just won. */
export function submitFinalAnswer(state: FinalState, answer: string): ReduceResult {
  const { prizeIndex } = state.final;
  if (state.step.kind !== 'solving' || prizeIndex === null) return reject(state, 'wrongPhase');
  if (normalizeAnswer(answer) === '' || answer.length > MAX_ANSWER_LENGTH) {
    return reject(state, 'invalidAnswer');
  }
  const { finalist } = state;
  const won = isSameAnswer(answer, state.final.phrase.text);
  const prize = FINAL_PRIZES[prizeIndex];
  const gain = won && prize?.kind === 'money' ? prize.amount : 0;
  const teams = updateTeam(state.teams, finalist, (team) => ({
    ...team,
    totalScore: team.totalScore + gain,
  }));
  return {
    state: { phase: 'gameOver', teams, final: { finalist, prizeIndex, won } },
    events: [
      won
        ? { type: 'finalWon', finalist, prizeIndex }
        : { type: 'finalLost', finalist, prizeIndex, answer: answer.trim() },
    ],
  };
}

/** Letters visible on the board: RSTLNE once the envelope is drawn, picks once all are made. */
export function finalRevealedLetters(state: FinalState): string[] {
  switch (state.step.kind) {
    case 'prizeWheel':
    case 'prizeSpinning':
      return [];
    case 'pickingLetters':
      return Array.from(FINAL_GIVEN_LETTERS);
    case 'solving':
      return [...Array.from(FINAL_GIVEN_LETTERS), ...state.final.pickedLetters];
  }
}
