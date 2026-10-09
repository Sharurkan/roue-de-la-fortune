import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRoom, saveRoom, type SavedRoom } from './room-store';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const ROOM: SavedRoom = {
  mode: 'multi',
  masterId: 'alice123',
  seats: [{ clientId: 'alice123', name: 'Rouges' }],
};

describe('room store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads the room, without the links', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const withLinks = { ...ROOM, links: [{ link: 1, clientId: 'alice123' }] };
    expect(saveRoom(withLinks)).toBe(true);
    expect(loadRoom()).toEqual(ROOM);
  });

  it.each([
    'not json',
    JSON.stringify({ v: 0, ...ROOM }),
    JSON.stringify({ v: 1, ...ROOM, mode: 'both' }),
    JSON.stringify({ v: 1, ...ROOM, masterId: '<b>' }),
  ])('ignores the unreadable save %s', (raw) => {
    vi.stubGlobal('localStorage', memoryStorage({ 'rdlf.room': raw }));
    expect(loadRoom()).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(loadRoom()).toBeNull();
    expect(saveRoom(ROOM)).toBe(false);
  });
});
