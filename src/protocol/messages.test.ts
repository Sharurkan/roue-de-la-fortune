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
    { type: 'startGame', teamNames: ['A', 'B'], firstRound: 5 },
    { type: 'buzz', team: 3 },
    { type: 'choosePocket', color: 'red' },
    { type: 'spin' },
    { type: 'spin', segmentIndex: 3, part: 'left' },
    { type: 'guessConsonant', letter: 'S' },
    { type: 'buyVowel' },
    { type: 'guessVowel', letter: 'é' },
    { type: 'startSolving' },
    { type: 'submitSolution', answer: 'Le Roi lion' },
    { type: 'cancel' },
    { type: 'nextRound' },
    { type: 'abandonGame' },
    { type: 'newGame' },
  ] satisfies PhoneAction[])('accepts the action $type', (action) => {
    expect(parsePhoneMessage(actionMessage(action))).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: 'action', action },
    });
  });

  it('accepts a heartbeat', () => {
    expect(parsePhoneMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('drops unknown fields', () => {
    const data = {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'spin', cheat: true },
      extra: 1,
    };
    expect(parsePhoneMessage(data)).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: 'action', action: { type: 'spin' } },
    });
  });

  it.each([
    null,
    'spin',
    42,
    [],
    {},
    { v: PROTOCOL_VERSION },
    { v: PROTOCOL_VERSION, type: 'action' },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'hack' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'spinEnded' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'revealTossUpLetter' } },
    {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'startGame', teamNames: ['A', 'B'], firstRound: 6 },
    },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz', team: 4 } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz', team: -1 } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'buzz' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'spin', segmentIndex: 99 } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'choosePocket', color: 'green' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'guessConsonant', letter: 'ST' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'guessConsonant', letter: '' } },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'guessConsonant' } },
    {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'submitSolution', answer: 'A'.repeat(101) },
    },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'startGame', teamNames: ['A'] } },
    {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'startGame', teamNames: ['A', 'B', 'C', 'D', 'E'] },
    },
    {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'startGame', teamNames: ['A', 'B'.repeat(21)] },
    },
    { v: PROTOCOL_VERSION, type: 'action', action: { type: 'startGame', teamNames: ['A', 2] } },
    { v: PROTOCOL_VERSION, type: 'state', view: toPublicView(INITIAL_STATE, []) },
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
    expect(parseTvMessage({ v: PROTOCOL_VERSION, type: 'state', view })).toEqual(invalid);
  });

  it('reports another protocol version', () => {
    expect(parseTvMessage({ v: PROTOCOL_VERSION + 1, type: 'state', view: {} })).toEqual(
      otherVersion,
    );
  });
});
