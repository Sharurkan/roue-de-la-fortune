import { describe, expect, it } from 'vitest';
import { INITIAL_STATE } from '../game/state';
import type { PhoneAction } from './actions';
import {
  actionMessage,
  HEARTBEAT,
  parsePhoneMessage,
  parseTvMessage,
  PROTOCOL_VERSION,
  stateMessage,
} from './messages';
import { toPublicView } from './view';

const invalid = { ok: false, reason: 'invalid' };
const otherVersion = { ok: false, reason: 'version' };

describe('parsePhoneMessage', () => {
  it.each([
    { type: 'startGame', teamNames: ['A', 'B'] },
    { type: 'spin' },
    { type: 'guessConsonant', letter: 'S' },
    { type: 'buyVowel' },
    { type: 'guessVowel', letter: 'é' },
    { type: 'startSolving' },
    { type: 'submitSolution', answer: 'Le Roi lion' },
    { type: 'cancel' },
    { type: 'nextRound' },
    { type: 'endGame' },
    { type: 'abandonGame' },
    { type: 'newGame' },
  ] satisfies PhoneAction[])('accepts the action $type', (action) => {
    expect(parsePhoneMessage(actionMessage(action))).toEqual({
      ok: true,
      message: { v: 1, type: 'action', action },
    });
  });

  it('accepts a heartbeat', () => {
    expect(parsePhoneMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('drops unknown fields', () => {
    const data = { v: 1, type: 'action', action: { type: 'spin', cheat: true }, extra: 1 };
    expect(parsePhoneMessage(data)).toEqual({
      ok: true,
      message: { v: 1, type: 'action', action: { type: 'spin' } },
    });
  });

  it.each([
    null,
    'spin',
    42,
    [],
    {},
    { v: 1 },
    { v: 1, type: 'action' },
    { v: 1, type: 'action', action: { type: 'hack' } },
    { v: 1, type: 'action', action: { type: 'spinEnded' } },
    { v: 1, type: 'action', action: { type: 'guessConsonant', letter: 'ST' } },
    { v: 1, type: 'action', action: { type: 'guessConsonant', letter: '' } },
    { v: 1, type: 'action', action: { type: 'guessConsonant' } },
    { v: 1, type: 'action', action: { type: 'submitSolution', answer: 'A'.repeat(101) } },
    { v: 1, type: 'action', action: { type: 'startGame', teamNames: ['A'] } },
    { v: 1, type: 'action', action: { type: 'startGame', teamNames: ['A', 'B', 'C', 'D', 'E'] } },
    { v: 1, type: 'action', action: { type: 'startGame', teamNames: ['A', 'B'.repeat(21)] } },
    { v: 1, type: 'action', action: { type: 'startGame', teamNames: ['A', 2] } },
    { v: 1, type: 'state', view: toPublicView(INITIAL_STATE, []) },
    { v: '1', type: 'heartbeat' },
  ])('rejects %j as invalid', (data) => {
    expect(parsePhoneMessage(data)).toEqual(invalid);
  });

  it('reports another protocol version', () => {
    expect(parsePhoneMessage({ v: PROTOCOL_VERSION + 1, type: 'action' })).toEqual(otherVersion);
  });
});

describe('parseTvMessage', () => {
  it('accepts a state message', () => {
    const message = stateMessage(toPublicView(INITIAL_STATE, []));
    expect(parseTvMessage(message)).toEqual({ ok: true, message });
  });

  it('accepts a heartbeat', () => {
    expect(parseTvMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('rejects an action', () => {
    expect(parseTvMessage(actionMessage({ type: 'spin' }))).toEqual(invalid);
  });

  it('rejects a malformed view', () => {
    const view = { ...toPublicView(INITIAL_STATE, []), phase: 'cheating' };
    expect(parseTvMessage({ v: 1, type: 'state', view })).toEqual(invalid);
  });

  it('reports another protocol version', () => {
    expect(parseTvMessage({ v: 2, type: 'state', view: {} })).toEqual(otherVersion);
  });
});
