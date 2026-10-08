import {
  CONSONANTS,
  DEFAULT_TEAM_NAME_PREFIX,
  MAX_ANSWER_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  VOWEL_COST,
  VOWELS,
  WHEEL_SEGMENTS,
} from './config';
import type { GameEvent, RejectionReason } from './events';
import type { Phrase } from './phrases';
import {
  activeTeamCanBuyVowel,
  countOccurrences,
  hasHiddenConsonants,
  hasHiddenVowels,
} from './selectors';
import type { GameAction, GameState, PlayingState, Round, Team } from './state';
import { isSameAnswer, normalizeAnswer, normalizeText } from './text';

export interface GameDeps {
  /** Returns a number in [0, 1), like Math.random. */
  random: () => number;
  phrases: readonly Phrase[];
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export function reduce(state: GameState, action: GameAction, deps: GameDeps): ReduceResult {
  switch (action.type) {
    case 'startGame':
      return startGame(state, action.teamNames, deps);
    case 'spin':
      return spin(state, deps);
    case 'spinEnded':
      return spinEnded(state);
    case 'guessConsonant':
      return guessConsonant(state, action.letter);
    case 'buyVowel':
      return buyVowel(state);
    case 'guessVowel':
      return guessVowel(state, action.letter);
    case 'startSolving':
      return startSolving(state);
    case 'submitSolution':
      return submitSolution(state, action.answer);
    case 'cancel':
      return cancel(state);
    case 'nextRound':
      return nextRound(state, deps);
    case 'endGame':
      return endGame(state);
    case 'newGame':
      return newGame(state);
  }
}

function reject(state: GameState, reason: RejectionReason): ReduceResult {
  return { state, events: [{ type: 'actionRejected', reason }] };
}

function pickIndex(random: () => number, length: number): number {
  return Math.min(Math.floor(random() * length), length - 1);
}

function teamName(input: string, index: number): string {
  const trimmed = input.trim().slice(0, MAX_TEAM_NAME_LENGTH);
  return trimmed === '' ? `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}` : trimmed;
}

function startGame(state: GameState, teamNames: string[], deps: GameDeps): ReduceResult {
  if (state.phase !== 'setup') return reject(state, 'wrongPhase');
  if (teamNames.length < MIN_TEAMS || teamNames.length > MAX_TEAMS) {
    return reject(state, 'invalidTeamCount');
  }
  const teams = teamNames.map((name, index) => ({
    name: teamName(name, index),
    roundScore: 0,
    totalScore: 0,
  }));
  return startRound(teams, 1, [], 0, deps);
}

function startRound(
  teams: Team[],
  roundNumber: number,
  usedPhraseIndexes: number[],
  startingTeam: number,
  deps: GameDeps,
): ReduceResult {
  const used = usedPhraseIndexes.length >= deps.phrases.length ? [] : usedPhraseIndexes;
  const available = deps.phrases.map((_, index) => index).filter((index) => !used.includes(index));
  const phraseIndex = available[pickIndex(deps.random, available.length)];
  const phrase = phraseIndex === undefined ? undefined : deps.phrases[phraseIndex];
  if (phraseIndex === undefined || phrase === undefined) throw new Error('No phrase available');
  const round: Round = { phrase, guessedLetters: [], activeTeam: startingTeam, startingTeam };
  return {
    state: {
      phase: 'playing',
      step: { kind: 'choosing' },
      teams,
      roundNumber,
      usedPhraseIndexes: [...used, phraseIndex],
      round,
    },
    events: [{ type: 'roundStarted', roundNumber }],
  };
}

function isChoosing(state: GameState): state is PlayingState & { step: { kind: 'choosing' } } {
  return state.phase === 'playing' && state.step.kind === 'choosing';
}

function spin(state: GameState, deps: GameDeps): ReduceResult {
  if (!isChoosing(state)) return reject(state, 'wrongPhase');
  if (!hasHiddenConsonants(state.round)) return reject(state, 'noConsonantsLeft');
  const segmentIndex = pickIndex(deps.random, WHEEL_SEGMENTS.length);
  return {
    state: { ...state, step: { kind: 'spinning', segmentIndex } },
    events: [{ type: 'wheelSpun', segmentIndex }],
  };
}

function spinEnded(state: GameState): ReduceResult {
  if (state.phase !== 'playing' || state.step.kind !== 'spinning') {
    return reject(state, 'wrongPhase');
  }
  const segment = WHEEL_SEGMENTS[state.step.segmentIndex];
  const team = state.round.activeTeam;
  switch (segment?.kind) {
    case 'value':
      return {
        state: { ...state, step: { kind: 'guessingConsonant', amount: segment.amount } },
        events: [],
      };
    case 'bankrupt': {
      const teams = updateTeam(state.teams, team, (t) => ({ ...t, roundScore: 0 }));
      return passTurn({ ...state, teams }, [{ type: 'bankrupt', team }]);
    }
    case 'pass':
      return passTurn(state, [{ type: 'landedOnPass', team }]);
    case undefined:
      return reject(state, 'wrongPhase');
  }
}

function normalizeLetter(input: string, allowed: string): string | null {
  const letter = normalizeText(input.trim());
  return letter.length === 1 && allowed.includes(letter) ? letter : null;
}

function guessConsonant(state: GameState, input: string): ReduceResult {
  if (state.phase !== 'playing' || state.step.kind !== 'guessingConsonant') {
    return reject(state, 'wrongPhase');
  }
  const letter = normalizeLetter(input, CONSONANTS);
  if (letter === null) return reject(state, 'invalidLetter');
  if (state.round.guessedLetters.includes(letter)) return reject(state, 'letterAlreadyGuessed');
  return revealLetter(state, letter, state.step.amount, []);
}

function buyVowel(state: GameState): ReduceResult {
  if (!isChoosing(state)) return reject(state, 'wrongPhase');
  if (!hasHiddenVowels(state.round)) return reject(state, 'noVowelsLeft');
  if (!activeTeamCanBuyVowel(state)) return reject(state, 'notEnoughMoney');
  return { state: { ...state, step: { kind: 'guessingVowel' } }, events: [] };
}

function guessVowel(state: GameState, input: string): ReduceResult {
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
  return revealLetter({ ...state, teams }, letter, 0, [
    { type: 'vowelBought', team, cost: VOWEL_COST },
  ]);
}

/** Adds the letter to the board. Found: the team scores and plays again. Absent: the turn passes. */
function revealLetter(
  state: PlayingState,
  letter: string,
  amountPerLetter: number,
  events: GameEvent[],
): ReduceResult {
  const round = { ...state.round, guessedLetters: [...state.round.guessedLetters, letter] };
  const count = countOccurrences(round.phrase.text, letter);
  if (count === 0) {
    return passTurn({ ...state, round }, [...events, { type: 'letterAbsent', letter }]);
  }
  const gain = amountPerLetter * count;
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

function submitSolution(state: GameState, answer: string): ReduceResult {
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

function nextRound(state: GameState, deps: GameDeps): ReduceResult {
  if (state.phase !== 'roundOver') return reject(state, 'wrongPhase');
  const startingTeam = (state.round.startingTeam + 1) % state.teams.length;
  return startRound(
    state.teams,
    state.roundNumber + 1,
    state.usedPhraseIndexes,
    startingTeam,
    deps,
  );
}

function endGame(state: GameState): ReduceResult {
  if (state.phase !== 'roundOver') return reject(state, 'wrongPhase');
  return { state: { phase: 'gameOver', teams: state.teams }, events: [{ type: 'gameOver' }] };
}

function newGame(state: GameState): ReduceResult {
  if (state.phase !== 'gameOver') return reject(state, 'wrongPhase');
  return { state: { phase: 'setup' }, events: [] };
}

function passTurn(state: PlayingState, events: GameEvent[]): ReduceResult {
  const team = (state.round.activeTeam + 1) % state.teams.length;
  return {
    state: { ...state, round: { ...state.round, activeTeam: team }, step: { kind: 'choosing' } },
    events: [...events, { type: 'turnPassed', team }],
  };
}

function updateTeam(teams: Team[], index: number, update: (team: Team) => Team): Team[] {
  return teams.map((team, i) => (i === index ? update(team) : team));
}
