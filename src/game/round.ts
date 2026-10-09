import { pickUnused, type GameDeps, type ReduceResult } from './common';
import type { GameEvent } from './events';
import type { GameProgress, PlayingState } from './state';

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

export function passTurn(state: PlayingState, events: GameEvent[]): ReduceResult {
  const team = (state.round.activeTeam + 1) % state.teams.length;
  return {
    state: { ...state, round: { ...state.round, activeTeam: team }, step: { kind: 'choosing' } },
    events: [...events, { type: 'turnPassed', team }],
  };
}
