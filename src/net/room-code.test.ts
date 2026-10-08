import { describe, expect, it } from 'vitest';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  peerIdFor,
  ROOM_CODE_ALPHABET,
} from './room-code';

describe('generateRoomCode', () => {
  it('uses the first letter when random returns 0', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
  });

  it('stays inside the alphabet when random returns almost 1', () => {
    expect(generateRoomCode(() => 0.999999)).toBe('ZZZZ');
  });

  it('always produces a valid code', () => {
    const values = [0.1, 0.5, 0.3, 0.9];
    let call = 0;
    const code = generateRoomCode(() => values[call++ % values.length] ?? 0);
    expect(isValidRoomCode(code)).toBe(true);
  });
});

describe('ROOM_CODE_ALPHABET', () => {
  it('excludes ambiguous letters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO]/);
  });
});

describe('normalizeRoomCode', () => {
  it('uppercases and removes spaces', () => {
    expect(normalizeRoomCode(' ab cd ')).toBe('ABCD');
  });
});

describe('isValidRoomCode', () => {
  it('accepts a 4-letter code from the alphabet', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
  });

  it.each(['ABC', 'ABCDE', 'ABCO', 'abcd', 'AB1D', ''])('rejects %j', (code) => {
    expect(isValidRoomCode(code)).toBe(false);
  });
});

describe('peerIdFor', () => {
  it('prefixes the code to avoid collisions on the public server', () => {
    expect(peerIdFor('ABCD')).toBe('rdlf-ABCD');
  });
});
