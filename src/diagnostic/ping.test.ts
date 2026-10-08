import { describe, expect, it } from 'vitest';
import { parsePing, parsePong } from './ping';

describe('parsePing', () => {
  it('accepts a valid ping and drops extra fields', () => {
    expect(parsePing({ type: 'ping', seq: 1, sentAt: 12.5, extra: true })).toEqual({
      type: 'ping',
      seq: 1,
      sentAt: 12.5,
    });
  });

  it.each([
    null,
    'ping',
    42,
    {},
    { type: 'pong', seq: 1, sentAt: 1 },
    { type: 'ping', seq: '1', sentAt: 1 },
    { type: 'ping', seq: 1 },
    { type: 'ping', seq: Number.NaN, sentAt: 1 },
    { type: 'ping', seq: 1, sentAt: Number.POSITIVE_INFINITY },
  ])('rejects %j', (data) => {
    expect(parsePing(data)).toBeNull();
  });
});

describe('parsePong', () => {
  it('accepts a valid pong', () => {
    expect(parsePong({ type: 'pong', seq: 3, sentAt: 7 })).toEqual({
      type: 'pong',
      seq: 3,
      sentAt: 7,
    });
  });

  it('rejects a ping', () => {
    expect(parsePong({ type: 'ping', seq: 3, sentAt: 7 })).toBeNull();
  });
});
