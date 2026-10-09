import * as z from 'zod/mini';
import {
  MAX_ANSWER_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  ROUND_COUNT,
} from '../game/config';
import type { GameAction } from '../game/state';

/** Wheels have 24 segments; a little room is kept for other wheels. */
const MAX_SEGMENTS = 48;

const letterSchema = z.string().check(z.length(1));

/** Actions the phone may send. Timing (wheel stop, toss-up letters) only comes from the TV. */
export type PhoneAction = Exclude<GameAction, { type: 'spinEnded' | 'revealTossUpLetter' }>;

export const phoneActionSchema: z.ZodMiniType<PhoneAction> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startGame'),
    teamNames: z
      .array(z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)))
      .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS)),
    firstRound: z.optional(z.int().check(z.minimum(1), z.maximum(ROUND_COUNT + 1))),
  }),
  z.object({
    type: z.literal('buzz'),
    team: z.int().check(z.minimum(0), z.maximum(MAX_TEAMS - 1)),
  }),
  z.object({
    type: z.literal('spin'),
    segmentIndex: z.optional(z.int().check(z.minimum(0), z.maximum(MAX_SEGMENTS))),
    part: z.optional(z.enum(['left', 'middle', 'right'])),
  }),
  z.object({ type: z.literal('guessConsonant'), letter: letterSchema }),
  z.object({ type: z.literal('choosePocket'), color: z.enum(['red', 'blue']) }),
  z.object({ type: z.literal('buyVowel') }),
  z.object({ type: z.literal('guessVowel'), letter: letterSchema }),
  z.object({ type: z.literal('startSolving') }),
  z.object({
    type: z.literal('submitSolution'),
    answer: z.string().check(z.maxLength(MAX_ANSWER_LENGTH)),
  }),
  z.object({ type: z.literal('cancel') }),
  z.object({ type: z.literal('nextRound') }),
  z.object({ type: z.literal('abandonGame') }),
  z.object({ type: z.literal('newGame') }),
]);
