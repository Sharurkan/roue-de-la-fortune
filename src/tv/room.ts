import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS } from '../game/config';
import type { Actor } from '../game/permissions';
import type { LinkId } from '../net/host';
import type { PlayMode, RoomView } from '../protocol/room';

/** A team joined with its own phone. Its index is the team index in the game. */
export interface Seat {
  clientId: string;
  name: string;
}

/** Who plays with which phone. Kept apart from the game: the rules are the same in both modes. */
export interface Room {
  /** Null until the master has chosen. */
  mode: PlayMode | null;
  /** The first phone: it runs the game. With one phone, the last phone connected. */
  masterId: string | null;
  seats: Seat[];
  /** Phones that said who they are, by link. Not saved: links do not survive a reload. */
  links: { link: LinkId; clientId: string }[];
}

export const EMPTY_ROOM: Room = { mode: null, masterId: null, seats: [], links: [] };

/** A change to the room, and the links the TV must close because of it. */
export interface RoomChange {
  room: Room;
  close: LinkId[];
}

function clientOf(room: Room, link: LinkId): string | null {
  return room.links.find((entry) => entry.link === link)?.clientId ?? null;
}

function seatOf(room: Room, clientId: string): number {
  return room.seats.findIndex((seat) => seat.clientId === clientId);
}

export function isMaster(room: Room, link: LinkId): boolean {
  const clientId = clientOf(room, link);
  return clientId !== null && clientId === room.masterId;
}

/**
 * A phone says who it is. The same phone on a new link drops its old link.
 * With one phone, the newcomer replaces every other phone.
 */
export function greet(room: Room, link: LinkId, clientId: string): RoomChange {
  const replaced = (entry: Room['links'][number]): boolean =>
    entry.link !== link && (room.mode === 'single' || entry.clientId === clientId);
  const close = room.links.filter(replaced).map((entry) => entry.link);
  const links = [
    ...room.links.filter((entry) => entry.link !== link && !close.includes(entry.link)),
    { link, clientId },
  ];
  const masterId = room.mode === 'single' || room.masterId === null ? clientId : room.masterId;
  return { room: { ...room, masterId, links }, close };
}

export function dropLink(room: Room, link: LinkId): Room {
  return { ...room, links: room.links.filter((entry) => entry.link !== link) };
}

/** Only the master chooses, and only between games. Teams join again after each choice. */
export function chooseMode(room: Room, link: LinkId, mode: PlayMode): RoomChange | null {
  if (!isMaster(room, link)) return null;
  if (mode === room.mode) return { room, close: [] };
  const close =
    mode === 'single' ? room.links.filter((e) => e.link !== link).map((e) => e.link) : [];
  const links = room.links.filter((entry) => !close.includes(entry.link));
  return { room: { ...room, mode, seats: [], links }, close };
}

/** Joins with one phone per team, or renames the team this phone already joined. */
export function joinTeam(room: Room, link: LinkId, name: string): Room | null {
  const clientId = clientOf(room, link);
  if (room.mode !== 'multi' || clientId === null) return null;
  const seatName = name.trim().slice(0, MAX_TEAM_NAME_LENGTH);
  const index = seatOf(room, clientId);
  if (index >= 0) {
    const seats = room.seats.map((seat, i) => (i === index ? { ...seat, name: seatName } : seat));
    return { ...room, seats };
  }
  if (room.seats.length >= MAX_TEAMS) return null;
  return { ...room, seats: [...room.seats, { clientId, name: seatName }] };
}

/** The master frees a team joined by mistake. The next teams move up one place. */
export function removeTeam(room: Room, link: LinkId, team: number): Room | null {
  if (room.mode !== 'multi' || !isMaster(room, link) || room.seats[team] === undefined) {
    return null;
  }
  return { ...room, seats: room.seats.filter((_, index) => index !== team) };
}

export function isTeamConnected(room: Room, team: number): boolean {
  const seat = room.seats[team];
  return seat !== undefined && room.links.some((entry) => entry.clientId === seat.clientId);
}

/** The player behind a link, with one phone per team. Null for a phone without a team. */
export function actorFor(room: Room, link: LinkId): Actor | null {
  const clientId = clientOf(room, link);
  if (clientId === null) return null;
  const team = seatOf(room, clientId);
  if (team < 0) return null;
  return { team, isMaster: clientId === room.masterId };
}

export function seatsView(room: Room): RoomView['seats'] {
  return room.seats.map((seat, index) => ({
    name: seat.name,
    connected: isTeamConnected(room, index),
  }));
}

export function roomViewFor(room: Room, link: LinkId): RoomView {
  const clientId = clientOf(room, link);
  const team = clientId === null ? -1 : seatOf(room, clientId);
  return {
    mode: room.mode,
    isMaster: isMaster(room, link),
    team: team < 0 ? null : team,
    seats: seatsView(room),
  };
}
