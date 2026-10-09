import type { MysteryEffect } from './config';
import type { PocketColor, SlotPart } from './state';

export type RejectionReason =
  | 'wrongPhase'
  | 'invalidTeamCount'
  | 'invalidLetter'
  | 'letterAlreadyGuessed'
  | 'notEnoughMoney'
  | 'noConsonantsLeft'
  | 'noVowelsLeft'
  | 'invalidAnswer'
  | 'noPicksLeft'
  | 'invalidTeam'
  | 'invalidRound'
  | 'invalidPocket'
  | 'teamEliminated';

export type GameEvent =
  | { type: 'tossUpStarted'; roundNumber: number }
  | { type: 'tossUpLetterRevealed'; tileIndex: number }
  | { type: 'buzzed'; team: number }
  | { type: 'tossUpWrong'; team: number; answer: string }
  | { type: 'tossUpWon'; team: number }
  | { type: 'tossUpFailed'; team: number }
  | { type: 'roundStarted'; roundNumber: number }
  | { type: 'wheelSpun'; segmentIndex: number; part: SlotPart }
  | { type: 'bankrupt'; team: number }
  | { type: 'landedOnPass'; team: number }
  | { type: 'pocketOffered'; team: number }
  /** 'money': the panel only hides its amount, played like a normal value. */
  | { type: 'mysteryRevealed'; team: number; outcome: MysteryEffect | 'money' }
  | {
      type: 'pocketOpened';
      team: number;
      chosen: PocketColor;
      winning: PocketColor;
      amount: number;
    }
  | { type: 'letterFound'; letter: string; count: number; gain: number }
  | { type: 'letterAbsent'; letter: string }
  | { type: 'vowelBought'; team: number; cost: number }
  | { type: 'turnPassed'; team: number }
  | { type: 'noMoreConsonants' }
  | { type: 'noMoreVowels' }
  | { type: 'wrongSolution'; answer: string }
  | { type: 'roundWon'; team: number; amount: number }
  | { type: 'finalStarted'; finalist: number }
  | { type: 'prizeWheelSpun'; prizeIndex: number }
  | { type: 'finalLettersGiven'; letters: string[] }
  | { type: 'finalLetterPicked'; letter: string }
  | { type: 'finalLettersRevealed'; letters: string[] }
  | { type: 'finalWon'; finalist: number; prizeIndex: number }
  | { type: 'finalLost'; finalist: number; prizeIndex: number; answer: string }
  | { type: 'gameOver' }
  | { type: 'actionRejected'; reason: RejectionReason };
