import { MAX_ANSWER_LENGTH } from './config';
import { pickUnused, reject, shuffle, type GameDeps, type ReduceResult } from './common';
import { startRound } from './round';
import type { GameEvent } from './events';
import type { GameProgress, TossUpState } from './state';
import { isHiddenCharacter, isSameAnswer, normalizeAnswer, normalizeText } from './text';

/** Letters hidden on the board, in reading order. Tile indexes refer to this list. */
export function hiddenLetters(text: string): string[] {
  return Array.from(normalizeText(text)).filter(isHiddenCharacter);
}

/** Without a right answer, the round starts with the next team in rotation. */
export function rotationTeam(progress: GameProgress): number {
  return (progress.roundNumber - 1) % progress.teams.length;
}

export function startTossUp(progress: GameProgress, deps: GameDeps): ReduceResult {
  const pick = pickUnused(deps.random, deps.tossUpPhrases.length, progress.usedTossUpIndexes);
  const phrase = deps.tossUpPhrases[pick.index];
  if (phrase === undefined) throw new Error('No toss-up phrase available');
  const tiles = hiddenLetters(phrase.text).map((_, index) => index);
  return {
    state: {
      ...progress,
      phase: 'tossUp',
      usedTossUpIndexes: pick.used,
      tossUp: {
        phrase,
        revealOrder: shuffle(deps.random, tiles),
        revealedCount: 0,
        buzzer: null,
        eliminated: [],
      },
    },
    events: [{ type: 'tossUpStarted', roundNumber: progress.roundNumber }],
  };
}

/** Sent by the TV on a timer. Once every letter is shown, teams can still buzz. */
export function revealTossUpLetter(state: TossUpState): ReduceResult {
  const { tossUp } = state;
  const tileIndex = tossUp.revealOrder[tossUp.revealedCount];
  if (tossUp.buzzer !== null || tileIndex === undefined) return reject(state, 'wrongPhase');
  return {
    state: { ...state, tossUp: { ...tossUp, revealedCount: tossUp.revealedCount + 1 } },
    events: [{ type: 'tossUpLetterRevealed', tileIndex }],
  };
}

export function buzz(state: TossUpState, team: number): ReduceResult {
  const { tossUp } = state;
  if (tossUp.buzzer !== null) return reject(state, 'wrongPhase');
  if (!Number.isInteger(team) || team < 0 || team >= state.teams.length) {
    return reject(state, 'invalidTeam');
  }
  if (tossUp.eliminated.includes(team)) return reject(state, 'teamEliminated');
  return {
    state: { ...state, tossUp: { ...tossUp, buzzer: team } },
    events: [{ type: 'buzzed', team }],
  };
}

function progressOf(state: TossUpState): GameProgress {
  const { teams, roundNumber, usedPhraseIndexes, usedTossUpIndexes } = state;
  return { teams, roundNumber, usedPhraseIndexes, usedTossUpIndexes };
}

/** One try per team. Right: the team starts the round. Wrong: the letters go on. */
export function submitTossUpAnswer(
  state: TossUpState,
  answer: string,
  deps: GameDeps,
): ReduceResult {
  const team = state.tossUp.buzzer;
  if (team === null) return reject(state, 'wrongPhase');
  if (normalizeAnswer(answer) === '' || answer.length > MAX_ANSWER_LENGTH) {
    return reject(state, 'invalidAnswer');
  }
  const progress = progressOf(state);
  if (isSameAnswer(answer, state.tossUp.phrase.text)) {
    const round = startRound(progress, team, deps);
    return { state: round.state, events: [{ type: 'tossUpWon', team }, ...round.events] };
  }
  const wrong: GameEvent = { type: 'tossUpWrong', team, answer: answer.trim() };
  const eliminated = [...state.tossUp.eliminated, team];
  if (eliminated.length < state.teams.length) {
    return {
      state: { ...state, tossUp: { ...state.tossUp, buzzer: null, eliminated } },
      events: [wrong],
    };
  }
  const fallback = rotationTeam(progress);
  const round = startRound(progress, fallback, deps);
  return {
    state: round.state,
    events: [wrong, { type: 'tossUpFailed', team: fallback }, ...round.events],
  };
}
