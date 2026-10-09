import { describe, expect, it } from 'vitest';
import {
  chooseModeMessage,
  helloMessage,
  joinTeamMessage,
  parsePhoneMessage,
  parseTvMessage,
  PROTOCOL_VERSION,
  removeTeamMessage,
  REPLACED,
  stateMessage,
} from './messages';
import { INITIAL_STATE } from '../game/state';
import { SINGLE_PHONE_ROOM, type RoomView } from './room';
import { toPublicView } from './view';

const invalid = { ok: false, reason: 'invalid' };
const view = toPublicView(INITIAL_STATE, []);

describe('room messages from the phone', () => {
  it.each([
    helloMessage('abc12345'),
    helloMessage('a'.repeat(32)),
    chooseModeMessage('single'),
    chooseModeMessage('multi'),
    joinTeamMessage('Les Bleus'),
    joinTeamMessage(''),
    removeTeamMessage(0),
    removeTeamMessage(3),
  ])('accepts %j', (message) => {
    expect(parsePhoneMessage(message)).toEqual({ ok: true, message });
  });

  it.each([
    { type: 'hello' },
    { type: 'hello', clientId: 'short' },
    { type: 'hello', clientId: 'a'.repeat(33) },
    { type: 'hello', clientId: 'ABC12345' },
    { type: 'hello', clientId: 'abc 12345' },
    { type: 'chooseMode', mode: 'both' },
    { type: 'joinTeam' },
    { type: 'joinTeam', name: 'B'.repeat(21) },
    { type: 'removeTeam', team: 4 },
    { type: 'removeTeam', team: -1 },
    { type: 'removeTeam', team: 1.5 },
  ])('rejects %j as invalid', (data) => {
    expect(parsePhoneMessage({ v: PROTOCOL_VERSION, ...data })).toEqual(invalid);
  });
});

describe('room view from the TV', () => {
  const multiRoom: RoomView = {
    mode: 'multi',
    isMaster: false,
    team: 1,
    seats: [
      { name: 'Rouges', connected: true },
      { name: 'Bleus', connected: false },
    ],
  };

  it.each([SINGLE_PHONE_ROOM, multiRoom, { mode: null, isMaster: true, team: null, seats: [] }])(
    'accepts %j',
    (room) => {
      const message = stateMessage(view, room);
      expect(parseTvMessage(message)).toEqual({ ok: true, message });
    },
  );

  it.each([
    { ...multiRoom, mode: 'both' },
    { ...multiRoom, team: 4 },
    { ...multiRoom, seats: Array.from({ length: 5 }, () => ({ name: 'A', connected: true })) },
    { ...multiRoom, seats: [{ name: 'A' }] },
    { mode: 'multi', team: 0, seats: [] },
  ])('rejects the malformed room %j', (room) => {
    expect(parseTvMessage({ v: PROTOCOL_VERSION, type: 'state', view, room })).toEqual(invalid);
  });

  it('accepts the notice of a replaced phone', () => {
    expect(parseTvMessage(REPLACED)).toEqual({ ok: true, message: REPLACED });
  });

  it('rejects a state without room', () => {
    expect(parseTvMessage({ v: PROTOCOL_VERSION, type: 'state', view })).toEqual(invalid);
  });
});
