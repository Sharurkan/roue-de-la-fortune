const ROOM_CODE_KEY = 'rdlf.roomCode';

/** Returns null when nothing is saved or when storage is unavailable. */
export function loadRoomCode(): string | null {
  try {
    return localStorage.getItem(ROOM_CODE_KEY);
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (private mode, quota, blocked). */
export function saveRoomCode(code: string): boolean {
  try {
    localStorage.setItem(ROOM_CODE_KEY, code);
    return true;
  } catch {
    return false;
  }
}
