import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIdSchema } from '../protocol/room';
import { generateClientId, loadClientId } from './client-id-store';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const blocked = () => {
  throw new Error('blocked');
};

describe('generateClientId', () => {
  it('builds an id the protocol accepts, even at the edges of random', () => {
    for (const value of [0, 0.5, 0.999999]) {
      expect(clientIdSchema.safeParse(generateClientId(() => value)).success).toBe(true);
    }
  });

  it('depends on the injected randomness', () => {
    expect(generateClientId(() => 0)).toBe('a'.repeat(16));
    expect(generateClientId(() => 0.999999)).toBe('9'.repeat(16));
  });
});

describe('loadClientId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates an id once, then keeps it', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const first = loadClientId(() => 0);
    expect(first).toEqual({ id: 'a'.repeat(16), saved: true });
    expect(loadClientId(() => 0.5)).toEqual(first);
  });

  it('replaces a malformed saved id', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'rdlf.clientId': '<script>' }));
    expect(loadClientId(() => 0).id).toBe('a'.repeat(16));
  });

  it('still gives an id when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(loadClientId(() => 0)).toEqual({ id: 'a'.repeat(16), saved: false });
  });
});
