import * as z from 'zod/mini';
import { MAX_ANSWER_LENGTH, MAX_TEAM_NAME_LENGTH, MAX_TEAMS, MIN_TEAMS } from '../game/config';
import type { GameAction } from '../game/state';

const letterSchema = z.string().check(z.length(1));

/** Actions the phone may send. The end of the wheel spin only comes from the TV animation. */
export type PhoneAction = Exclude<GameAction, { type: 'spinEnded' }>;

export const phoneActionSchema: z.ZodMiniType<PhoneAction> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startGame'),
    teamNames: z
      .array(z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)))
      .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS)),
  }),
  z.object({ type: z.literal('spin') }),
  z.object({ type: z.literal('guessConsonant'), letter: letterSchema }),
  z.object({ type: z.literal('buyVowel') }),
  z.object({ type: z.literal('guessVowel'), letter: letterSchema }),
  z.object({ type: z.literal('startSolving') }),
  z.object({
    type: z.literal('submitSolution'),
    answer: z.string().check(z.maxLength(MAX_ANSWER_LENGTH)),
  }),
  z.object({ type: z.literal('cancel') }),
  z.object({ type: z.literal('nextRound') }),
  z.object({ type: z.literal('endGame') }),
  z.object({ type: z.literal('abandonGame') }),
  z.object({ type: z.literal('newGame') }),
]);
