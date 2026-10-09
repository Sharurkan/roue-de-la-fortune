import {
  normalizeLetter,
  pickIndex,
  reject,
  updateTeam,
  type GameDeps,
  type ReduceResult,
} from './common';
import {
  CONSONANTS,
  DEFAULT_TEAM_NAME_PREFIX,
  MAX_ANSWER_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  ROUND_COUNT,
  VOWEL_COST,
  VOWELS,
  type WheelSegment,
} from './config';
import type { GameEvent } from './events';
import {
  pickFinalLetter,
  prizeWheelStopped,
  spinPrizeWheel,
  startFinal,
  submitFinalAnswer,
} from './final';
import {
  activeTeamCanBuyVowel,
  countOccurrences,
  hasHiddenConsonants,
  hasHiddenVowels,
} from './selectors';
import type { GameAction, GameState, PlayingState, Round, SlotPart } from './state';
import { isSameAnswer, normalizeAnswer } from './text';
import { revealMystery } from './mystery';
import { offerPocket, openPocket } from './pocket';
import { passTurn } from './round';
import { pickSlotPart, wheelForRound } from './wheel';
import { buzz, revealTossUpLetter, startTossUp, submitTossUpAnswer } from './toss-up';

export type { GameDeps, ReduceResult } from './common';

export function reduce(state: GameState, action: GameAction, deps: GameDeps): ReduceResult {
  switch (action.type) {
    case 'startGame':
      return startGame(state, action.teamNames, action.firstRound ?? 1, deps);
    case 'revealTossUpLetter':
      return state.phase === 'tossUp' ? revealTossUpLetter(state) : reject(state, 'wrongPhase');
    case 'buzz':
      return state.phase === 'tossUp' ? buzz(state, action.team) : reject(state, 'wrongPhase');
    case 'spin':
      return spin(state, deps, action);
    case 'spinEnded':
      return spinEnded(state, deps);
    case 'choosePocket':
      return choosePocket(state, action.color);
    case 'guessConsonant':
      return guessConsonant(state, action.letter);
    case 'buyVowel':
      return buyVowel(state);
    case 'guessVowel':
      return guessVowel(state, action.letter);
    case 'startSolving':
      return startSolving(state);
    case 'submitSolution':
      return submitSolution(state, action.answer, deps);
    case 'cancel':
      return cancel(state);
    case 'nextRound':
      return nextRound(state, deps);
    case 'abandonGame':
      return abandonGame(state);
    case 'newGame':
      return newGame(state);
  }
}

function teamName(input: string, index: number): string {
  const trimmed = input.trim().slice(0, MAX_TEAM_NAME_LENGTH);
  return trimmed === '' ? `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}` : trimmed;
}

function startGame(
  state: GameState,
  teamNames: string[],
  firstRound: number,
  deps: GameDeps,
): ReduceResult {
  if (state.phase !== 'setup') return reject(state, 'wrongPhase');
  if (teamNames.length < MIN_TEAMS || teamNames.length > MAX_TEAMS) {
    return reject(state, 'invalidTeamCount');
  }
  if (!Number.isInteger(firstRound) || firstRound < 1 || firstRound > ROUND_COUNT + 1) {
    return reject(state, 'invalidRound');
  }
  const teams = teamNames.map((name, index) => ({
    name: teamName(name, index),
    roundScore: 0,
    totalScore: 0,
  }));
  if (firstRound > ROUND_COUNT) return startFinal(teams, 0, deps);
  return startTossUp(
    { teams, roundNumber: firstRound, usedPhraseIndexes: [], usedTossUpIndexes: [] },
    deps,
  );
}

function isChoosing(state: GameState): state is PlayingState & { step: { kind: 'choosing' } } {
  return state.phase === 'playing' && state.step.kind === 'choosing';
}

function spin(
  state: GameState,
  deps: GameDeps,
  forced: { segmentIndex?: number | undefined; part?: SlotPart | undefined },
): ReduceResult {
  if (state.phase === 'final') return spinPrizeWheel(state, deps);
  if (!isChoosing(state)) return reject(state, 'wrongPhase');
  if (!hasHiddenConsonants(state.round)) return reject(state, 'noConsonantsLeft');
  const wheel = wheelForRound(state.roundNumber);
  const forcedIndex = forced.segmentIndex;
  if (
    forcedIndex !== undefined &&
    (!Number.isInteger(forcedIndex) || wheel[forcedIndex] === undefined)
  ) {
    return reject(state, 'invalidSegment');
  }
  const segmentIndex = forcedIndex ?? pickIndex(deps.random, wheel.length);
  const part = forced.part ?? pickSlotPart(wheel[segmentIndex], deps.random());
  return {
    state: { ...state, step: { kind: 'spinning', segmentIndex, part } },
    events: [{ type: 'wheelSpun', segmentIndex, part }],
  };
}

function spinEnded(state: GameState, deps: GameDeps): ReduceResult {
  if (state.phase === 'final') return prizeWheelStopped(state);
  if (state.phase !== 'playing' || state.step.kind !== 'spinning') {
    return reject(state, 'wrongPhase');
  }
  const slot = wheelForRound(state.roundNumber)[state.step.segmentIndex];
  // The edges of the jackpot slot are bankrupts.
  const segment: WheelSegment | undefined =
    slot?.kind === 'jackpot' && state.step.part !== 'middle' ? { kind: 'bankrupt' } : slot;
  const team = state.round.activeTeam;
  switch (segment?.kind) {
    case 'value':
    case 'jackpot':
      return {
        state: {
          ...state,
          step: {
            kind: 'guessingConsonant',
            amount: segment.amount,
            perLetter: segment.kind === 'value',
          },
        },
        events: [],
      };
    case 'bankrupt': {
      const teams = updateTeam(state.teams, team, (t) => ({ ...t, roundScore: 0 }));
      return passTurn({ ...state, teams }, [{ type: 'bankrupt', team }]);
    }
    case 'pass':
      return passTurn(state, [{ type: 'landedOnPass', team }]);
    case 'pocket':
      return offerPocket(state, deps);
    case 'mystery':
      return revealMystery(state, segment.amount, deps);
    case undefined:
      return reject(state, 'wrongPhase');
  }
}

function guessConsonant(state: GameState, input: string): ReduceResult {
  if (state.phase === 'final') return pickFinalLetter(state, input, 'consonant');
  if (state.phase !== 'playing' || state.step.kind !== 'guessingConsonant') {
    return reject(state, 'wrongPhase');
  }
  const letter = normalizeLetter(input, CONSONANTS);
  if (letter === null) return reject(state, 'invalidLetter');
  if (state.round.guessedLetters.includes(letter)) return reject(state, 'letterAlreadyGuessed');
  const { amount, perLetter } = state.step;
  return revealLetter(state, letter, (count) => (perLetter ? amount * count : amount), []);
}

function buyVowel(state: GameState): ReduceResult {
  if (!isChoosing(state)) return reject(state, 'wrongPhase');
  if (!hasHiddenVowels(state.round)) return reject(state, 'noVowelsLeft');
  if (!activeTeamCanBuyVowel(state)) return reject(state, 'notEnoughMoney');
  return { state: { ...state, step: { kind: 'guessingVowel' } }, events: [] };
}

function guessVowel(state: GameState, input: string): ReduceResult {
  if (state.phase === 'final') return pickFinalLetter(state, input, 'vowel');
  if (state.phase !== 'playing' || state.step.kind !== 'guessingVowel') {
    return reject(state, 'wrongPhase');
  }
  const letter = normalizeLetter(input, VOWELS);
  if (letter === null) return reject(state, 'invalidLetter');
  if (state.round.guessedLetters.includes(letter)) return reject(state, 'letterAlreadyGuessed');
  const team = state.round.activeTeam;
  const teams = updateTeam(state.teams, team, (t) => ({
    ...t,
    roundScore: t.roundScore - VOWEL_COST,
  }));
  return revealLetter({ ...state, teams }, letter, () => 0, [
    { type: 'vowelBought', team, cost: VOWEL_COST },
  ]);
}

/** Adds the letter to the board. Found: the team scores and plays again. Absent: the turn passes. */
function revealLetter(
  state: PlayingState,
  letter: string,
  gainFor: (count: number) => number,
  events: GameEvent[],
): ReduceResult {
  const round = { ...state.round, guessedLetters: [...state.round.guessedLetters, letter] };
  const count = countOccurrences(round.phrase.text, letter);
  if (count === 0) {
    return passTurn({ ...state, round }, [...events, { type: 'letterAbsent', letter }]);
  }
  const gain = gainFor(count);
  const teams = updateTeam(state.teams, round.activeTeam, (t) => ({
    ...t,
    roundScore: t.roundScore + gain,
  }));
  return {
    state: { ...state, teams, round, step: { kind: 'choosing' } },
    events: [
      ...events,
      { type: 'letterFound', letter, count, gain },
      ...exhaustionEvents(state.round, round),
    ],
  };
}

function exhaustionEvents(before: Round, after: Round): GameEvent[] {
  const events: GameEvent[] = [];
  if (hasHiddenConsonants(before) && !hasHiddenConsonants(after)) {
    events.push({ type: 'noMoreConsonants' });
  }
  if (hasHiddenVowels(before) && !hasHiddenVowels(after)) {
    events.push({ type: 'noMoreVowels' });
  }
  return events;
}

function startSolving(state: GameState): ReduceResult {
  if (!isChoosing(state)) return reject(state, 'wrongPhase');
  return { state: { ...state, step: { kind: 'solving' } }, events: [] };
}

function submitSolution(state: GameState, answer: string, deps: GameDeps): ReduceResult {
  if (state.phase === 'final') return submitFinalAnswer(state, answer);
  if (state.phase === 'tossUp') return submitTossUpAnswer(state, answer, deps);
  if (state.phase !== 'playing' || state.step.kind !== 'solving') {
    return reject(state, 'wrongPhase');
  }
  if (normalizeAnswer(answer) === '' || answer.length > MAX_ANSWER_LENGTH) {
    return reject(state, 'invalidAnswer');
  }
  if (!isSameAnswer(answer, state.round.phrase.text)) {
    return passTurn(state, [{ type: 'wrongSolution', answer: answer.trim() }]);
  }
  const winner = state.round.activeTeam;
  const amount = state.teams[winner]?.roundScore ?? 0;
  const teams = state.teams.map((team, index) => ({
    ...team,
    totalScore: team.totalScore + (index === winner ? team.roundScore : 0),
    roundScore: 0,
  }));
  return {
    state: {
      phase: 'roundOver',
      winner,
      teams,
      roundNumber: state.roundNumber,
      usedPhraseIndexes: state.usedPhraseIndexes,
      usedTossUpIndexes: state.usedTossUpIndexes,
      round: state.round,
    },
    events: [{ type: 'roundWon', team: winner, amount }],
  };
}

function cancel(state: GameState): ReduceResult {
  if (
    state.phase !== 'playing' ||
    (state.step.kind !== 'guessingVowel' && state.step.kind !== 'solving')
  ) {
    return reject(state, 'wrongPhase');
  }
  return { state: { ...state, step: { kind: 'choosing' } }, events: [] };
}

/** Each regular round opens with a toss-up. After the last one, "next" leads to the final. */
function nextRound(state: GameState, deps: GameDeps): ReduceResult {
  if (state.phase !== 'roundOver') return reject(state, 'wrongPhase');
  if (state.roundNumber >= ROUND_COUNT) return startFinal(state.teams, state.winner, deps);
  const { teams, usedPhraseIndexes, usedTossUpIndexes } = state;
  return startTossUp(
    { teams, roundNumber: state.roundNumber + 1, usedPhraseIndexes, usedTossUpIndexes },
    deps,
  );
}

/** Stops a game at any time. Round scores of an unfinished round are lost. */
function abandonGame(state: GameState): ReduceResult {
  if (state.phase === 'setup' || state.phase === 'gameOver') return reject(state, 'wrongPhase');
  const teams = state.teams.map((team) => ({ ...team, roundScore: 0 }));
  return { state: { phase: 'gameOver', teams, final: null }, events: [{ type: 'gameOver' }] };
}

function newGame(state: GameState): ReduceResult {
  if (state.phase !== 'gameOver') return reject(state, 'wrongPhase');
  return { state: { phase: 'setup' }, events: [] };
}

function choosePocket(state: GameState, color: string): ReduceResult {
  if (state.phase !== 'playing' || state.step.kind !== 'choosingPocket') {
    return reject(state, 'wrongPhase');
  }
  if (color !== 'red' && color !== 'blue') return reject(state, 'invalidPocket');
  return openPocket(state, state.step, color);
}
