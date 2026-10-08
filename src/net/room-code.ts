// I, L and O are left out: they are easy to confuse with 1 and 0 on a TV screen.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

const PEER_ID_PREFIX = 'rdlf-';

export function generateRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET.charAt(Math.min(index, ROOM_CODE_ALPHABET.length - 1));
  }
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

export function peerIdFor(code: string): string {
  return PEER_ID_PREFIX + code;
}
