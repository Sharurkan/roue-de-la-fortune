export type RejectionReason =
  | 'wrongPhase'
  | 'invalidTeamCount'
  | 'invalidLetter'
  | 'letterAlreadyGuessed'
  | 'notEnoughMoney'
  | 'noConsonantsLeft'
  | 'noVowelsLeft'
  | 'invalidAnswer';

export type GameEvent =
  | { type: 'roundStarted'; roundNumber: number }
  | { type: 'wheelSpun'; segmentIndex: number }
  | { type: 'bankrupt'; team: number }
  | { type: 'landedOnPass'; team: number }
  | { type: 'letterFound'; letter: string; count: number; gain: number }
  | { type: 'letterAbsent'; letter: string }
  | { type: 'vowelBought'; team: number; cost: number }
  | { type: 'turnPassed'; team: number }
  | { type: 'noMoreConsonants' }
  | { type: 'noMoreVowels' }
  | { type: 'wrongSolution'; answer: string }
  | { type: 'roundWon'; team: number; amount: number }
  | { type: 'gameOver' }
  | { type: 'actionRejected'; reason: RejectionReason };
