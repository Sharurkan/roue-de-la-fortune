import * as z from 'zod/mini';
import { MAX_TEAMS } from '../game/config';
import { clientIdSchema, playModeSchema, teamNameSchema } from '../protocol/room';

const ROOM_KEY = 'rdlf.room';
const SAVE_VERSION = 1;

const savedRoomSchema = z.object({
  v: z.literal(SAVE_VERSION),
  mode: z.nullable(playModeSchema),
  masterId: z.nullable(clientIdSchema),
  seats: z
    .array(z.object({ clientId: clientIdSchema, name: teamNameSchema }))
    .check(z.maxLength(MAX_TEAMS)),
});

/** What survives a reload of the TV: the mode, the master and the teams of each phone. */
export type SavedRoom = Omit<z.infer<typeof savedRoomSchema>, 'v'>;

/** Null when nothing readable is saved or when storage is unavailable. */
export function loadRoom(): SavedRoom | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (raw === null) return null;
    const parsed = savedRoomSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const { mode, masterId, seats } = parsed.data;
    return { mode, masterId, seats };
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (private mode, quota, blocked). */
export function saveRoom(room: SavedRoom): boolean {
  try {
    const { mode, masterId, seats } = room;
    localStorage.setItem(ROOM_KEY, JSON.stringify({ v: SAVE_VERSION, mode, masterId, seats }));
    return true;
  } catch {
    return false;
  }
}
