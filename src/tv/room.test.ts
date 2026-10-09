import { describe, expect, it } from 'vitest';
import {
  actorFor,
  chooseMode,
  dropLink,
  EMPTY_ROOM,
  greet,
  isTeamConnected,
  joinTeam,
  removeTeam,
  roomViewFor,
  type Room,
} from './room';

function must<T>(value: T | null): T {
  if (value === null) throw new Error('Refused');
  return value;
}

/** Master on link 1 ("alice"), with one phone per team chosen. Bob is on link 2. */
function multiLobby(): Room {
  const withAlice = greet(EMPTY_ROOM, 1, 'alice').room;
  const withBob = greet(withAlice, 2, 'bob').room;
  return must(chooseMode(withBob, 1, 'multi')).room;
}

describe('greet', () => {
  it('makes the first phone the master', () => {
    const room = greet(greet(EMPTY_ROOM, 1, 'alice').room, 2, 'bob').room;
    expect(room.masterId).toBe('alice');
    expect(roomViewFor(room, 1).isMaster).toBe(true);
    expect(roomViewFor(room, 2).isMaster).toBe(false);
  });

  it('drops the old link of a phone that comes back', () => {
    const first = greet(EMPTY_ROOM, 1, 'alice').room;
    const change = greet(first, 5, 'alice');
    expect(change.close).toEqual([1]);
    expect(change.room.links).toEqual([{ link: 5, clientId: 'alice' }]);
  });

  it('replaces every other phone with one phone', () => {
    const single = must(chooseMode(greet(EMPTY_ROOM, 1, 'alice').room, 1, 'single')).room;
    const change = greet(single, 2, 'bob');
    expect(change.close).toEqual([1]);
    expect(change.room.masterId).toBe('bob');
  });
});

describe('chooseMode', () => {
  it('is refused to a phone that is not the master', () => {
    const room = greet(greet(EMPTY_ROOM, 1, 'alice').room, 2, 'bob').room;
    expect(chooseMode(room, 2, 'multi')).toBeNull();
  });

  it('keeps only the master when going back to one phone', () => {
    const lobby = must(joinTeam(multiLobby(), 2, 'Bleus'));
    const change = must(chooseMode(lobby, 1, 'single'));
    expect(change.close).toEqual([2]);
    expect(change.room.seats).toEqual([]);
    expect(change.room.links).toEqual([{ link: 1, clientId: 'alice' }]);
  });
});

describe('joinTeam', () => {
  it('gives each phone its own team, in order of arrival', () => {
    const room = must(joinTeam(must(joinTeam(multiLobby(), 2, ' Bleus ')), 1, 'Rouges'));
    expect(room.seats).toEqual([
      { clientId: 'bob', name: 'Bleus' },
      { clientId: 'alice', name: 'Rouges' },
    ]);
    expect(actorFor(room, 1)).toEqual({ team: 1, isMaster: true });
    expect(actorFor(room, 2)).toEqual({ team: 0, isMaster: false });
  });

  it('renames the team of a phone that joins again', () => {
    const room = must(joinTeam(must(joinTeam(multiLobby(), 2, 'Bleus')), 2, 'Verts'));
    expect(room.seats).toEqual([{ clientId: 'bob', name: 'Verts' }]);
  });

  it('is refused before the mode is chosen, or with one phone', () => {
    expect(joinTeam(greet(EMPTY_ROOM, 1, 'alice').room, 1, 'A')).toBeNull();
    const single = must(chooseMode(greet(EMPTY_ROOM, 1, 'alice').room, 1, 'single')).room;
    expect(joinTeam(single, 1, 'A')).toBeNull();
  });

  it('is refused to a phone that did not say who it is', () => {
    expect(joinTeam(multiLobby(), 9, 'A')).toBeNull();
  });

  it('is refused once every team is taken', () => {
    let room = multiLobby();
    for (const [link, id] of [
      [3, 'c'],
      [4, 'd'],
      [5, 'e'],
      [6, 'f'],
    ] as const) {
      room = must(joinTeam(greet(room, link, id).room, link, id));
    }
    expect(joinTeam(room, 2, 'Bleus')).toBeNull();
  });
});

describe('removeTeam', () => {
  it('lets the master free a team, the next ones move up', () => {
    const lobby = must(joinTeam(must(joinTeam(multiLobby(), 2, 'Bleus')), 1, 'Rouges'));
    const room = must(removeTeam(lobby, 1, 0));
    expect(room.seats).toEqual([{ clientId: 'alice', name: 'Rouges' }]);
    expect(actorFor(room, 2)).toBeNull();
  });

  it('is refused to other phones and for a missing team', () => {
    const lobby = must(joinTeam(multiLobby(), 2, 'Bleus'));
    expect(removeTeam(lobby, 2, 0)).toBeNull();
    expect(removeTeam(lobby, 1, 3)).toBeNull();
  });
});

describe('connection of the teams', () => {
  it('follows the links of each phone', () => {
    const lobby = must(joinTeam(multiLobby(), 2, 'Bleus'));
    expect(isTeamConnected(lobby, 0)).toBe(true);
    const lost = dropLink(lobby, 2);
    expect(isTeamConnected(lost, 0)).toBe(false);
    expect(roomViewFor(lost, 1)).toEqual({
      mode: 'multi',
      isMaster: true,
      team: null,
      seats: [{ name: 'Bleus', connected: false }],
    });
    const back = greet(lost, 7, 'bob').room;
    expect(roomViewFor(back, 7).team).toBe(0);
  });
});
