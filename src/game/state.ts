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

export type GameState =
  { phase: 'setup' } | PlayingState | RoundOverState | { phase: 'gameOver'; teams: Team[] };

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
  | { type: 'endGame' }
  | { type: 'abandonGame' }
  | { type: 'newGame' };

export const INITIAL_STATE: GameState = { phase: 'setup' };
