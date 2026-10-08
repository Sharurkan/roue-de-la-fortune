import { describe, expect, it } from 'vitest';
import { parseMode } from './mode';

describe('parseMode', () => {
  it('recognizes the TV mode', () => {
    expect(parseMode('?mode=tv')).toBe('tv');
  });

  it('recognizes the controller mode, even with a room code', () => {
    expect(parseMode('?mode=manette&code=ABCD')).toBe('manette');
  });

  it.each(['test-tv', 'test-manette'])('recognizes the %s test page', (mode) => {
    expect(parseMode(`?mode=${mode}`)).toBe(mode);
  });

  it('returns null without a mode', () => {
    expect(parseMode('')).toBeNull();
  });

  it('returns null for an unknown mode', () => {
    expect(parseMode('?mode=admin')).toBeNull();
  });
});
