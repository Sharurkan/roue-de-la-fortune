export type RejectionReason =
  | 'wrongPhase'
  | 'invalidTeamCount'
  | 'invalidLetter'
  | 'letterAlreadyGuessed'
  | 'notEnoughMoney'
  | 'noConsonantsLeft'
  | 'noVowelsLeft'
  | 'invalidAnswer'
  | 'noPicksLeft';

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
  | { type: 'finalStarted'; finalist: number }
  | { type: 'prizeWheelSpun'; prizeIndex: number }
  | { type: 'finalLettersGiven'; letters: string[] }
  | { type: 'finalLetterPicked'; letter: string }
  | { type: 'finalLettersRevealed'; letters: string[] }
  | { type: 'finalWon'; finalist: number; prizeIndex: number }
  | { type: 'finalLost'; finalist: number; prizeIndex: number; answer: string }
  | { type: 'gameOver' }
  | { type: 'actionRejected'; reason: RejectionReason };
