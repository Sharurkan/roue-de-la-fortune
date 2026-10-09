import { pickUnused, type GameDeps, type ReduceResult } from './common';
import type { GameProgress } from './state';

/** Starts a regular round with a fresh phrase. The given team plays first. */
export function startRound(
  progress: GameProgress,
  startingTeam: number,
  deps: GameDeps,
): ReduceResult {
  const pick = pickUnused(deps.random, deps.phrases.length, progress.usedPhraseIndexes);
  const phrase = deps.phrases[pick.index];
  if (phrase === undefined) throw new Error('No phrase available');
  return {
    state: {
      ...progress,
      phase: 'playing',
      step: { kind: 'choosing' },
      usedPhraseIndexes: pick.used,
      round: { phrase, guessedLetters: [], activeTeam: startingTeam },
    },
    events: [{ type: 'roundStarted', roundNumber: progress.roundNumber }],
  };
}
