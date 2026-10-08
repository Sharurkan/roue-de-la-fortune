import { z } from 'zod';
import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS, MIN_TEAMS } from '../game/config';
import { THEMES } from '../game/phrases';
import type { GameState } from '../game/state';

const GAME_KEY = 'rdlf.game';
/** Bump when the saved shape changes: older saves are then dropped instead of misread. */
const SAVE_VERSION = 1;

const count = z.number().int().min(0);

const teamsSchema = z
  .array(
    z.object({
      name: z.string().max(MAX_TEAM_NAME_LENGTH),
      roundScore: z.number().int(),
      totalScore: z.number().int(),
    }),
  )
  .min(MIN_TEAMS)
  .max(MAX_TEAMS);

const stepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choosing') }),
  z.object({ kind: z.literal('spinning'), segmentIndex: count }),
  z.object({ kind: z.literal('guessingConsonant'), amount: count }),
  z.object({ kind: z.literal('guessingVowel') }),
  z.object({ kind: z.literal('solving') }),
]);

const gameDataShape = {
  teams: teamsSchema,
  roundNumber: z.number().int().min(1),
  usedPhraseIndexes: z.array(count),
  round: z.object({
    phrase: z.object({ text: z.string().min(1).max(200), theme: z.enum(THEMES) }),
    guessedLetters: z.array(z.string().length(1)).max(26),
    activeTeam: count,
    startingTeam: count,
  }),
};

function teamsInRange(state: {
  teams: unknown[];
  round: { activeTeam: number; startingTeam: number };
}) {
  return (
    state.round.activeTeam < state.teams.length && state.round.startingTeam < state.teams.length
  );
}

const gameStateSchema: z.ZodType<GameState> = z.union([
  z.object({ phase: z.literal('setup') }),
  z
    .object({ phase: z.literal('playing'), step: stepSchema, ...gameDataShape })
    .refine(teamsInRange),
  z
    .object({ phase: z.literal('roundOver'), winner: count, ...gameDataShape })
    .refine((state) => teamsInRange(state) && state.winner < state.teams.length),
  z.object({ phase: z.literal('gameOver'), teams: teamsSchema }),
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
