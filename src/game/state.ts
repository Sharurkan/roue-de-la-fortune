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
  startingTeam: number;
}

export type TurnStep =
  | { kind: 'choosing' }
  | { kind: 'spinning'; segmentIndex: number }
  | { kind: 'guessingConsonant'; amount: number }
  | { kind: 'guessingVowel' }
  | { kind: 'solving' };

interface GameData {
  teams: Team[];
  roundNumber: number;
  /** Indexes in the phrase list, so that a phrase is not reused in the same game. */
  usedPhraseIndexes: number[];
  round: Round;
}

export type PlayingState = { phase: 'playing'; step: TurnStep } & GameData;
export type RoundOverState = { phase: 'roundOver'; winner: number } & GameData;

/**
 * Final round, after the last regular round: the finalist spins the envelope
 * wheel, gets RSTLNE for free, picks a few more letters, then has one try.
 */
export type FinalStep =
  | { kind: 'prizeWheel' }
  | { kind: 'prizeSpinning' }
  | { kind: 'pickingLetters' }
  | { kind: 'solving' };

export interface FinalRound {
  phrase: Phrase;
  /** Index in FINAL_PRIZES, known once the envelope wheel has been spun. */
  prizeIndex: number | null;
  /** Letters picked by the finalist, revealed together once all are picked. */
  pickedLetters: string[];
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
  { phase: 'setup' } | PlayingState | RoundOverState | FinalState | GameOverState;

export type GameAction =
  | { type: 'startGame'; teamNames: string[] }
  | { type: 'spin' }
  | { type: 'spinEnded' }
  | { type: 'guessConsonant'; letter: string }
  | { type: 'buyVowel' }
  | { type: 'guessVowel'; letter: string }
  | { type: 'startSolving' }
  | { type: 'submitSolution'; answer: string }
  | { type: 'cancel' }
  | { type: 'nextRound' }
  | { type: 'abandonGame' }
  | { type: 'newGame' };

export const INITIAL_STATE: GameState = { phase: 'setup' };
