import { isValidRoomCode, normalizeRoomCode } from '../net/room-code';

const CODE_PARAM = 'code';

export function readCodeFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get(CODE_PARAM);
  if (raw === null) return null;
  const code = normalizeRoomCode(raw);
  return isValidRoomCode(code) ? code : null;
}

/** Keeps the code in the URL, so that a reload reconnects to the same TV. */
export function writeCodeToUrl(code: string | null): void {
  const url = new URL(window.location.href);
  if (code === null) url.searchParams.delete(CODE_PARAM);
  else url.searchParams.set(CODE_PARAM, code);
  window.history.replaceState(null, '', url.toString());
}
