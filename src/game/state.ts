import type { TeamEffect } from './config';
import type { Phrase } from './phrases';

export interface Team {
  name: string;
  roundScore: number;
  totalScore: number;
}

export interface Round {
  phrase: Phrase;
  /** Every letter proposed in this round, consonants and vowels, in order. */
  guessedLetters: string[];
  activeTeam: number;
  /** Where the wheel stands under the pointer, in segments: segment i spans [i - 0.5, i + 0.5). */
  wheelPosition: number;
}

/** Where the pointer stops inside the slot. Only the jackpot slot has distinct parts. */
export type SlotPart = 'left' | 'middle' | 'right';

export type PocketColor = 'red' | 'blue';

export type TurnStep =
  | { kind: 'choosing' }
  /** from and travel, in segments, let the TV replay the spin exactly. */
  | { kind: 'spinning'; segmentIndex: number; part: SlotPart; from: number; travel: number }
  /** perLetter is false for the jackpot: its amount is won once, not per letter. */
  /** effect: the swap or divide slot, applied once a right consonant is found. */
  | {
      kind: 'guessingConsonant';
      amount: number;
      perLetter: boolean;
      effect?: TeamEffect | undefined;
    }
  | { kind: 'choosingTeam'; effect: TeamEffect }
  /** The phone never learns which envelope wins nor its amount. */
  | { kind: 'choosingPocket'; winning: PocketColor; amount: number }
  | { kind: 'guessingVowel' }
  | { kind: 'solving' };

export interface GameProgress {
  teams: Team[];
  roundNumber: number;
  /** Indexes in the phrase list, so that a phrase is not reused in the same game. */
  usedPhraseIndexes: number[];
  /** Same for the toss-up list. */
  usedTossUpIndexes: number[];
}

type GameData = { round: Round } & GameProgress;

/**
 * Quick puzzle before each regular round: letters appear one by one until a
 * team buzzes. A right answer gives the team the first turn of the round.
 */
export interface TossUp {
  phrase: Phrase;
  /** Order in which the hidden tiles appear, as indexes among the phrase letters. */
  revealOrder: number[];
  revealedCount: number;
  /** Team answering after its buzz, or null while the letters appear. */
  buzzer: number | null;
  /** Teams that gave a wrong answer: they cannot buzz again. */
  eliminated: number[];
}

export type TossUpState = { phase: 'tossUp'; tossUp: TossUp } & GameProgress;

export type PlayingState = { phase: 'playing'; step: TurnStep } & GameData;
export type RoundOverState = { phase: 'roundOver'; winner: number } & GameData;

/**
 * Final round, after the last regular round: the finalist spins the envelope
 * wheel, gets RSTLNE for free, picks a few more letters, then has one try.
 */
export type FinalStep =
  | { kind: 'prizeWheel' }
  | { kind: 'prizeSpinning'; from: number; travel: number }
  | { kind: 'pickingLetters' }
  | { kind: 'solving' };

export interface FinalRound {
  phrase: Phrase;
  /** Index in FINAL_PRIZES, known once the envelope wheel has been spun. */
  prizeIndex: number | null;
  /** Letters picked by the finalist, revealed together once all are picked. */
  pickedLetters: string[];
  /** Where the envelope wheel stands, in segments. */
  wheelPosition: number;
}

export type FinalState = {
  phase: 'final';
  teams: Team[];
  finalist: number;
  step: FinalStep;
  final: FinalRound;
};

export interface FinalResult {
  finalist: number;
  prizeIndex: number;
  won: boolean;
}

export type GameOverState = {
  phase: 'gameOver';
  teams: Team[];
  /** Null when the game was abandoned before the end of the final. */
  final: FinalResult | null;
};

export type GameState =
  { phase: 'setup' } | TossUpState | PlayingState | RoundOverState | FinalState | GameOverState;

export type GameAction =
  /** firstRound skips earlier rounds, for testing; ROUND_COUNT + 1 starts at the final. */
  | { type: 'startGame'; teamNames: string[]; firstRound?: number | undefined }
  | { type: 'revealTossUpLetter' }
  | { type: 'buzz'; team: number }
  /**
   * power, from 0 to 1, decides where the wheel stops (drawn at random when
   * missing). segmentIndex and part force the result, for testing.
   */
  | {
      type: 'spin';
      power?: number | undefined;
      segmentIndex?: number | undefined;
      part?: SlotPart | undefined;
    }
  | { type: 'spinEnded' }
  | { type: 'guessConsonant'; letter: string }
  | { type: 'choosePocket'; color: PocketColor }
  | { type: 'chooseTeam'; team: number }
  | { type: 'buyVowel' }
  | { type: 'guessVowel'; letter: string }
  | { type: 'startSolving' }
  | { type: 'submitSolution'; answer: string }
  | { type: 'cancel' }
  | { type: 'nextRound' }
  | { type: 'abandonGame' }
  | { type: 'newGame' };

export const INITIAL_STATE: GameState = { phase: 'setup' };
