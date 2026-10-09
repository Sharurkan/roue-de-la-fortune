const CLIENT_ID_KEY = 'rdlf.clientId';
const CLIENT_ID_LENGTH = 16;
const CLIENT_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CLIENT_ID_PATTERN = /^[a-z0-9]{16}$/;

/** Random id telling the TV which phone it is, so that a phone finds its team again. */
export function generateClientId(random: () => number): string {
  let id = '';
  for (let i = 0; i < CLIENT_ID_LENGTH; i += 1) {
    const index = Math.min(
      Math.floor(random() * CLIENT_ID_CHARS.length),
      CLIENT_ID_CHARS.length - 1,
    );
    id += CLIENT_ID_CHARS.charAt(index);
  }
  return id;
}

function readSavedId(): string | null {
  try {
    const saved = localStorage.getItem(CLIENT_ID_KEY);
    return saved !== null && CLIENT_ID_PATTERN.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Returns the saved id, or creates one. When storage is unavailable, the id
 * only lasts as long as the page: a reload makes the phone a new one.
 */
export function loadClientId(random: () => number): { id: string; saved: boolean } {
  const saved = readSavedId();
  if (saved !== null) return { id: saved, saved: true };
  const id = generateClientId(random);
  try {
    localStorage.setItem(CLIENT_ID_KEY, id);
    return { id, saved: true };
  } catch {
    return { id, saved: false };
  }
}
