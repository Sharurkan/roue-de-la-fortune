import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRoomCode, loadRoomCode, saveRoomCode } from './room-code-store';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe('room code store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves, loads and clears a code, each page with its own key', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(saveRoomCode('ABCD')).toBe(true);
    expect(saveRoomCode('WXYZ', 'phone')).toBe(true);
    expect(loadRoomCode()).toBe('ABCD');
    expect(loadRoomCode('phone')).toBe('WXYZ');
    clearRoomCode('phone');
    expect(loadRoomCode('phone')).toBeNull();
    expect(loadRoomCode()).toBe('ABCD');
  });

  it('never throws when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(loadRoomCode()).toBeNull();
    expect(saveRoomCode('ABCD')).toBe(false);
    expect(() => {
      clearRoomCode();
    }).not.toThrow();
  });
});
