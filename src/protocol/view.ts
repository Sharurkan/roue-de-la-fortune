import { z } from 'zod';
import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS } from '../game/config';
import type { GameEvent } from '../game/events';
import { rankTeams } from '../game/ranking';
import { activeTeamCanBuyVowel, hasHiddenConsonants, hasHiddenVowels } from '../game/selectors';
import type { GameState, PlayingState, RoundOverState, Team } from '../game/state';

const MAX_EVENTS = 20;
const MAX_LETTERS = 26;

const index = z.number().int().min(0);
const amount = z.number().int();
const letter = z.string().length(1);

const gameEventSchema: z.ZodType<GameEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('roundStarted'), roundNumber: index }),
  z.object({ type: z.literal('wheelSpun'), segmentIndex: index }),
  z.object({ type: z.literal('bankrupt'), team: index }),
  z.object({ type: z.literal('landedOnPass'), team: index }),
  z.object({ type: z.literal('letterFound'), letter, count: index, gain: amount }),
  z.object({ type: z.literal('letterAbsent'), letter }),
  z.object({ type: z.literal('vowelBought'), team: index, cost: amount }),
  z.object({ type: z.literal('turnPassed'), team: index }),
  z.object({ type: z.literal('noMoreConsonants') }),
  z.object({ type: z.literal('noMoreVowels') }),
  z.object({ type: z.literal('wrongSolution'), answer: z.string() }),
  z.object({ type: z.literal('roundWon'), team: index, amount }),
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
    ]),
  }),
]);

/** What the phone may know about the game. Never the phrase nor its theme. */
export const publicViewSchema = z.object({
  phase: z.enum(['setup', 'playing', 'roundOver', 'gameOver']),
  roundNumber: index,
  teams: z
    .array(
      z.object({
        name: z.string().max(MAX_TEAM_NAME_LENGTH),
        roundScore: amount,
        totalScore: amount,
      }),
    )
    .max(MAX_TEAMS),
  activeTeam: index.nullable(),
  step: z
    .enum(['choosing', 'spinning', 'guessingConsonant', 'guessingVowel', 'solving'])
    .nullable(),
  consonantValue: amount.nullable(),
  guessedLetters: z.array(letter).max(MAX_LETTERS),
  canSpin: z.boolean(),
  canBuyVowel: z.boolean(),
  noMoreConsonants: z.boolean(),
  noMoreVowels: z.boolean(),
  winner: index.nullable(),
  ranking: z.array(z.object({ team: index, rank: z.number().int().min(1) })).max(MAX_TEAMS),
  lastEvents: z.array(gameEventSchema).max(MAX_EVENTS),
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
  ranking: [],
  lastEvents: [],
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

export function toPublicView(state: GameState, lastEvents: readonly GameEvent[]): PublicView {
  const events = lastEvents.slice(-MAX_EVENTS);
  switch (state.phase) {
    case 'setup':
      return { ...EMPTY_VIEW, lastEvents: events };
    case 'playing':
      return { ...playingView(state), lastEvents: events };
    case 'roundOver':
      return { ...roundView(state), winner: state.winner, lastEvents: events };
    case 'gameOver':
      return {
        ...EMPTY_VIEW,
        phase: 'gameOver',
        teams: publicTeams(state.teams),
        ranking: rankTeams(state.teams),
        lastEvents: events,
      };
  }
}
