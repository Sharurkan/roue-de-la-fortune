const ROOM_CODE_KEY = 'rdlf.roomCode';

/** Returns null when nothing is saved or when storage is unavailable. */
export function loadRoomCode(key = ROOM_CODE_KEY): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (private mode, quota, blocked). */
export function saveRoomCode(code: string, key = ROOM_CODE_KEY): boolean {
  try {
    localStorage.setItem(key, code);
    return true;
  } catch {
    return false;
  }
}
