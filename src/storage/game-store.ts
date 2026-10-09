import * as z from 'zod/mini';
import { FINAL_PRIZES, MAX_TEAM_NAME_LENGTH, MAX_TEAMS, MIN_TEAMS } from '../game/config';
import { THEMES } from '../game/phrases';
import type { GameState } from '../game/state';

const GAME_KEY = 'rdlf.game';
/** Bump when the saved shape changes: older saves are then dropped instead of misread. */
const SAVE_VERSION = 4;

const count = z.int().check(z.minimum(0));

const phraseSchema = z.object({
  text: z.string().check(z.minLength(1), z.maxLength(200)),
  theme: z.enum(THEMES),
});

const teamsSchema = z
  .array(
    z.object({
      name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)),
      roundScore: z.int(),
      totalScore: z.int(),
    }),
  )
  .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS));

const stepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choosing') }),
  z.object({
    kind: z.literal('spinning'),
    segmentIndex: count,
    part: z.enum(['left', 'middle', 'right']),
  }),
  z.object({ kind: z.literal('guessingConsonant'), amount: count, perLetter: z.boolean() }),
  z.object({ kind: z.literal('guessingVowel') }),
  z.object({ kind: z.literal('solving') }),
]);

const progressShape = {
  teams: teamsSchema,
  roundNumber: z.int().check(z.minimum(1)),
  usedPhraseIndexes: z.array(count),
  usedTossUpIndexes: z.array(count),
};

const gameDataShape = {
  ...progressShape,
  round: z.object({
    phrase: phraseSchema,
    guessedLetters: z.array(z.string().check(z.length(1))).check(z.maxLength(26)),
    activeTeam: count,
  }),
};

function teamsInRange(state: { teams: unknown[]; round: { activeTeam: number } }) {
  return state.round.activeTeam < state.teams.length;
}

const tossUpSchema = z
  .object({
    phase: z.literal('tossUp'),
    ...progressShape,
    tossUp: z.object({
      phrase: phraseSchema,
      revealOrder: z.array(count).check(z.maxLength(200)),
      revealedCount: count,
      buzzer: z.nullable(count),
      eliminated: z.array(count).check(z.maxLength(MAX_TEAMS)),
    }),
  })
  .check(
    z.refine(
      ({ teams, tossUp }) =>
        tossUp.revealedCount <= tossUp.revealOrder.length &&
        (tossUp.buzzer === null || tossUp.buzzer < teams.length) &&
        tossUp.eliminated.every((team) => team < teams.length),
    ),
  );

const prizeIndex = count.check(z.maximum(FINAL_PRIZES.length - 1));

const finalStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('prizeWheel') }),
  z.object({ kind: z.literal('prizeSpinning') }),
  z.object({ kind: z.literal('pickingLetters') }),
  z.object({ kind: z.literal('solving') }),
]);

const finalSchema = z
  .object({
    phase: z.literal('final'),
    teams: teamsSchema,
    finalist: count,
    step: finalStepSchema,
    final: z.object({
      phrase: phraseSchema,
      prizeIndex: z.nullable(prizeIndex),
      pickedLetters: z.array(z.string().check(z.length(1))).check(z.maxLength(26)),
    }),
  })
  .check(
    z.refine(
      (state) =>
        state.finalist < state.teams.length &&
        (state.step.kind === 'prizeWheel' || state.final.prizeIndex !== null),
    ),
  );

const gameOverSchema = z
  .object({
    phase: z.literal('gameOver'),
    teams: teamsSchema,
    final: z.nullable(z.object({ finalist: count, prizeIndex, won: z.boolean() })),
  })
  .check(z.refine((state) => state.final === null || state.final.finalist < state.teams.length));

const gameStateSchema: z.ZodMiniType<GameState> = z.union([
  z.object({ phase: z.literal('setup') }),
  tossUpSchema,
  z
    .object({ phase: z.literal('playing'), step: stepSchema, ...gameDataShape })
    .check(z.refine(teamsInRange)),
  z
    .object({ phase: z.literal('roundOver'), winner: count, ...gameDataShape })
    .check(z.refine((state) => teamsInRange(state) && state.winner < state.teams.length)),
  finalSchema,
  gameOverSchema,
]);

const saveSchema = z.object({ v: z.literal(SAVE_VERSION), state: gameStateSchema });

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: GameState }
  /** Unreadable, from another version, or storage blocked: the game starts over. */
  | { kind: 'unreadable' };

export function loadGame(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(GAME_KEY);
  } catch {
    return { kind: 'unreadable' };
  }
  if (raw === null) return { kind: 'empty' };
  try {
    const parsed = saveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { kind: 'loaded', state: parsed.data.state } : { kind: 'unreadable' };
  } catch {
    return { kind: 'unreadable' };
  }
}

/** Returns false when the game could not be saved (storage blocked or full). */
export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ v: SAVE_VERSION, state }));
    return true;
  } catch {
    return false;
  }
}
