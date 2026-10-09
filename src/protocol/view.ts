import * as z from 'zod/mini';
import {
  FINAL_GIVEN_LETTERS,
  FINAL_PRIZES,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  type Prize,
} from '../game/config';
import type { GameEvent } from '../game/events';
import { finalPicksLeft } from '../game/final';
import { rankTeams } from '../game/ranking';
import { activeTeamCanBuyVowel, hasHiddenConsonants, hasHiddenVowels } from '../game/selectors';
import type {
  FinalState,
  GameOverState,
  GameState,
  PlayingState,
  RoundOverState,
  Team,
  TossUpState,
} from '../game/state';

const MAX_EVENTS = 20;
const MAX_LETTERS = 26;

const index = z.int().check(z.minimum(0));
const amount = z.int();
const letter = z.string().check(z.length(1));
/** Wheel positions and travels, in segments. */
const distance = z.number().check(z.minimum(0));
const letters = z.array(letter).check(z.maxLength(MAX_LETTERS));

const gameEventSchema: z.ZodMiniType<GameEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tossUpStarted'), roundNumber: index }),
  z.object({ type: z.literal('tossUpLetterRevealed'), tileIndex: index }),
  z.object({ type: z.literal('buzzed'), team: index }),
  z.object({ type: z.literal('tossUpWrong'), team: index, answer: z.string() }),
  z.object({ type: z.literal('tossUpWon'), team: index }),
  z.object({ type: z.literal('tossUpFailed'), team: index }),
  z.object({ type: z.literal('roundStarted'), roundNumber: index }),
  z.object({
    type: z.literal('wheelSpun'),
    segmentIndex: index,
    part: z.enum(['left', 'middle', 'right']),
    from: distance,
    travel: distance,
  }),
  z.object({ type: z.literal('bankrupt'), team: index }),
  z.object({ type: z.literal('landedOnPass'), team: index }),
  z.object({ type: z.literal('pocketOffered'), team: index }),
  z.object({
    type: z.literal('mysteryRevealed'),
    team: index,
    outcome: z.enum(['money', 'bonus', 'double', 'bankrupt', 'half']),
  }),
  z.object({
    type: z.literal('pocketOpened'),
    team: index,
    chosen: z.enum(['red', 'blue']),
    winning: z.enum(['red', 'blue']),
    amount,
  }),
  z.object({ type: z.literal('letterFound'), letter, count: index, gain: amount }),
  z.object({ type: z.literal('letterAbsent'), letter }),
  z.object({ type: z.literal('letterAlreadyCalled'), letter }),
  z.object({ type: z.literal('vowelBought'), team: index, cost: amount }),
  z.object({ type: z.literal('turnPassed'), team: index }),
  z.object({ type: z.literal('noMoreConsonants') }),
  z.object({ type: z.literal('noMoreVowels') }),
  z.object({ type: z.literal('wrongSolution'), answer: z.string() }),
  z.object({ type: z.literal('roundWon'), team: index, amount }),
  z.object({ type: z.literal('finalStarted'), finalist: index }),
  z.object({
    type: z.literal('prizeWheelSpun'),
    prizeIndex: index,
    from: distance,
    travel: distance,
  }),
  z.object({ type: z.literal('finalLettersGiven'), letters }),
  z.object({ type: z.literal('finalLetterPicked'), letter }),
  z.object({ type: z.literal('finalLettersRevealed'), letters }),
  z.object({ type: z.literal('finalWon'), finalist: index, prizeIndex: index }),
  z.object({
    type: z.literal('finalLost'),
    finalist: index,
    prizeIndex: index,
    answer: z.string(),
  }),
  z.object({ type: z.literal('gameOver') }),
  z.object({
    type: z.literal('actionRejected'),
    reason: z.enum([
      'wrongPhase',
      'invalidTeamCount',
      'invalidLetter',
      'letterAlreadyGuessed',
      'notEnoughMoney',
      'noConsonantsLeft',
      'noVowelsLeft',
      'invalidAnswer',
      'noPicksLeft',
      'invalidTeam',
      'invalidRound',
      'invalidPocket',
      'invalidSegment',
      'invalidPower',
      'teamEliminated',
    ]),
  }),
]);

const prizeSchema: z.ZodMiniType<Prize> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('money'), amount }),
  z.object({ kind: z.literal('gift'), label: z.string().check(z.maxLength(30)) }),
]);

/**
 * What the phone may know about the game. Never the phrase nor its theme,
 * and the final envelope only once the final is over.
 */
export const publicViewSchema = z.object({
  phase: z.enum(['setup', 'tossUp', 'playing', 'roundOver', 'final', 'gameOver']),
  roundNumber: index,
  teams: z
    .array(
      z.object({
        name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)),
        roundScore: amount,
        totalScore: amount,
      }),
    )
    .check(z.maxLength(MAX_TEAMS)),
  activeTeam: z.nullable(index),
  step: z.nullable(
    z.enum([
      'buzzing',
      'choosing',
      'spinning',
      'guessingConsonant',
      'guessingVowel',
      'choosingPocket',
      'solving',
      'prizeWheel',
      'prizeSpinning',
      'pickingLetters',
    ]),
  ),
  consonantValue: z.nullable(amount),
  guessedLetters: letters,
  canSpin: z.boolean(),
  canBuyVowel: z.boolean(),
  noMoreConsonants: z.boolean(),
  noMoreVowels: z.boolean(),
  winner: z.nullable(index),
  /** Toss-up: teams that gave a wrong answer and cannot buzz again. */
  eliminatedTeams: z.array(index).check(z.maxLength(MAX_TEAMS)),
  ranking: z
    .array(z.object({ team: index, rank: z.int().check(z.minimum(1)) }))
    .check(z.maxLength(MAX_TEAMS)),
  /** Final round: letters the finalist may still pick. */
  finalPicks: z.nullable(z.object({ consonants: index, vowels: index })),
  finalResult: z.nullable(z.object({ finalist: index, won: z.boolean(), prize: prizeSchema })),
  lastEvents: z.array(gameEventSchema).check(z.maxLength(MAX_EVENTS)),
  /** True while the TV still animates (wheel, letters…): the phone waits before the next action. */
  busy: z.boolean(),
});

export type PublicView = z.infer<typeof publicViewSchema>;

const EMPTY_VIEW: PublicView = {
  phase: 'setup',
  roundNumber: 0,
  teams: [],
  activeTeam: null,
  step: null,
  consonantValue: null,
  guessedLetters: [],
  canSpin: false,
  canBuyVowel: false,
  noMoreConsonants: false,
  noMoreVowels: false,
  winner: null,
  eliminatedTeams: [],
  ranking: [],
  finalPicks: null,
  finalResult: null,
  lastEvents: [],
  busy: false,
};

function publicTeams(teams: readonly Team[]): PublicView['teams'] {
  return teams.map(({ name, roundScore, totalScore }) => ({ name, roundScore, totalScore }));
}

function roundView(state: PlayingState | RoundOverState): PublicView {
  return {
    ...EMPTY_VIEW,
    phase: state.phase,
    roundNumber: state.roundNumber,
    teams: publicTeams(state.teams),
    activeTeam: state.round.activeTeam,
    guessedLetters: [...state.round.guessedLetters],
    noMoreConsonants: !hasHiddenConsonants(state.round),
    noMoreVowels: !hasHiddenVowels(state.round),
  };
}

function playingView(state: PlayingState): PublicView {
  const choosing = state.step.kind === 'choosing';
  return {
    ...roundView(state),
    step: state.step.kind,
    consonantValue: state.step.kind === 'guessingConsonant' ? state.step.amount : null,
    canSpin: choosing && hasHiddenConsonants(state.round),
    canBuyVowel: choosing && activeTeamCanBuyVowel(state),
  };
}

function tossUpView(state: TossUpState): PublicView {
  const { buzzer, eliminated } = state.tossUp;
  return {
    ...EMPTY_VIEW,
    phase: 'tossUp',
    roundNumber: state.roundNumber,
    teams: publicTeams(state.teams),
    activeTeam: buzzer,
    step: buzzer === null ? 'buzzing' : 'solving',
    eliminatedTeams: [...eliminated],
  };
}

function finalView(state: FinalState): PublicView {
  const given = state.step.kind === 'prizeWheel' || state.step.kind === 'prizeSpinning';
  return {
    ...EMPTY_VIEW,
    phase: 'final',
    teams: publicTeams(state.teams),
    activeTeam: state.finalist,
    step: state.step.kind,
    guessedLetters: given ? [] : [...Array.from(FINAL_GIVEN_LETTERS), ...state.final.pickedLetters],
    canSpin: state.step.kind === 'prizeWheel',
    finalPicks: state.step.kind === 'pickingLetters' ? finalPicksLeft(state) : null,
  };
}

function gameOverView(state: GameOverState): PublicView {
  const prize = state.final === null ? undefined : FINAL_PRIZES[state.final.prizeIndex];
  return {
    ...EMPTY_VIEW,
    phase: 'gameOver',
    teams: publicTeams(state.teams),
    ranking: rankTeams(state.teams),
    finalResult:
      state.final === null || prize === undefined
        ? null
        : { finalist: state.final.finalist, won: state.final.won, prize },
  };
}

function phaseView(state: GameState): PublicView {
  switch (state.phase) {
    case 'setup':
      return EMPTY_VIEW;
    case 'tossUp':
      return tossUpView(state);
    case 'playing':
      return playingView(state);
    case 'roundOver':
      return { ...roundView(state), winner: state.winner };
    case 'final':
      return finalView(state);
    case 'gameOver':
      return gameOverView(state);
  }
}

export function toPublicView(
  state: GameState,
  lastEvents: readonly GameEvent[],
  busy = false,
): PublicView {
  // The drawn envelope stays a surprise until the end of the final.
  const events = lastEvents.filter((event) => event.type !== 'prizeWheelSpun').slice(-MAX_EVENTS);
  return { ...phaseView(state), lastEvents: events, busy };
}
