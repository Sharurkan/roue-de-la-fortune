import * as z from 'zod/mini';
import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS } from '../game/config';

/** One phone passed from team to team, or one phone per team. */
export const playModeSchema = z.enum(['single', 'multi']);

export type PlayMode = z.infer<typeof playModeSchema>;

/** Random id kept by each phone, so that it finds its team again after a reconnection. */
export const clientIdSchema = z.string().check(z.regex(/^[a-z0-9]{8,32}$/));

export const teamNameSchema = z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH));

export const teamIndexSchema = z.int().check(z.minimum(0), z.maximum(MAX_TEAMS - 1));

/** What one phone knows about the room. Each phone receives its own. */
export const roomViewSchema = z.object({
  /** Null until the master has chosen. */
  mode: z.nullable(playModeSchema),
  isMaster: z.boolean(),
  /** This phone's team with one phone per team, null before it joins. */
  team: z.nullable(teamIndexSchema),
  /** Teams that joined, in playing order, with one phone per team. */
  seats: z
    .array(z.object({ name: teamNameSchema, connected: z.boolean() }))
    .check(z.maxLength(MAX_TEAMS)),
});

export type RoomView = z.infer<typeof roomViewSchema>;

/** The room as seen by the only phone, when one phone is passed around. */
export const SINGLE_PHONE_ROOM: RoomView = {
  mode: 'single',
  isMaster: true,
  team: null,
  seats: [],
};
