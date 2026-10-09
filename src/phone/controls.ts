import { ROUND_COUNT, type TeamEffect, type WheelSegment } from '../game/config';
import type { SlotPart } from '../game/state';
import { wheelForRound } from '../game/wheel';
import type { RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';

/** What the phone shows, derived only from the public view sent by the TV. */
export type PhoneScreen =
  | { kind: 'setup' }
  | { kind: 'buzzing'; eliminatedTeams: number[] }
  | { kind: 'tossUpSolving'; team: number }
  | {
      kind: 'turn';
      canSpin: boolean;
      canBuyVowel: boolean;
      noMoreConsonants: boolean;
      noMoreVowels: boolean;
    }
  | { kind: 'spinning' }
  | { kind: 'consonant'; value: number; effect: TeamEffect | null }
  | { kind: 'chooseTeam'; effect: TeamEffect }
  | { kind: 'vowel' }
  | { kind: 'pocket' }
  | { kind: 'solving' }
  | { kind: 'roundOver'; winner: number | null; isLastRound: boolean }
  | { kind: 'prizeWheel' }
  | { kind: 'prizeSpinning' }
  | { kind: 'finalPicking'; consonantsLeft: number; vowelsLeft: number }
  | { kind: 'finalSolving' }
  | { kind: 'gameOver' };

function roundScreen(view: PublicView): PhoneScreen {
  switch (view.step) {
    case 'spinning':
      return { kind: 'spinning' };
    case 'guessingConsonant':
      return { kind: 'consonant', value: view.consonantValue ?? 0, effect: view.teamEffect };
    case 'choosingTeam':
      return { kind: 'chooseTeam', effect: view.teamEffect ?? 'swap' };
    case 'guessingVowel':
      return { kind: 'vowel' };
    case 'choosingPocket':
      return { kind: 'pocket' };
    case 'solving':
      return { kind: 'solving' };
    case 'choosing':
    case 'buzzing':
    case 'prizeWheel':
    case 'prizeSpinning':
    case 'pickingLetters':
    case null:
      return {
        kind: 'turn',
        canSpin: view.canSpin,
        canBuyVowel: view.canBuyVowel,
        noMoreConsonants: view.noMoreConsonants,
        noMoreVowels: view.noMoreVowels,
      };
  }
}

function finalScreen(view: PublicView): PhoneScreen {
  switch (view.step) {
    case 'prizeSpinning':
      return { kind: 'prizeSpinning' };
    case 'pickingLetters':
      return {
        kind: 'finalPicking',
        consonantsLeft: view.finalPicks?.consonants ?? 0,
        vowelsLeft: view.finalPicks?.vowels ?? 0,
      };
    case 'solving':
      return { kind: 'finalSolving' };
    default:
      return { kind: 'prizeWheel' };
  }
}

export function describeScreen(view: PublicView): PhoneScreen {
  switch (view.phase) {
    case 'setup':
      return { kind: 'setup' };
    case 'tossUp':
      return view.activeTeam === null
        ? { kind: 'buzzing', eliminatedTeams: view.eliminatedTeams }
        : { kind: 'tossUpSolving', team: view.activeTeam };
    case 'playing':
      return roundScreen(view);
    case 'roundOver':
      return {
        kind: 'roundOver',
        winner: view.winner,
        isLastRound: view.roundNumber >= ROUND_COUNT,
      };
    case 'final':
      return finalScreen(view);
    case 'gameOver':
      return { kind: 'gameOver' };
  }
}

export interface LetterKey {
  letter: string;
  used: boolean;
}

export function letterKeys(letters: string, usedLetters: readonly string[]): LetterKey[] {
  return Array.from(letters, (letter) => ({ letter, used: usedLetters.includes(letter) }));
}

/** One name per team, empty when not typed: the TV then uses the default name. */
export function teamNamesFor(
  typedNames: readonly (string | undefined)[],
  teamCount: number,
): string[] {
  return Array.from({ length: teamCount }, (_, index) => typedNames[index] ?? '');
}

/** Test mode: a wheel result the phone can force. */
export interface ForcedSpin {
  segmentIndex: number;
  part: SlotPart;
  label: string;
}

/** Every result of the round's wheel, the jackpot giving its middle and its edge. */
export function forcedSpinOptions(
  roundNumber: number,
  label: (segment: WheelSegment, part: SlotPart) => string,
): ForcedSpin[] {
  return wheelForRound(roundNumber).flatMap((segment, segmentIndex) => {
    const parts: SlotPart[] = segment.kind === 'jackpot' ? ['middle', 'left'] : ['middle'];
    return parts.map((part) => ({
      segmentIndex,
      part,
      label: `${String(segmentIndex + 1)} · ${label(segment, part)}`,
    }));
  });
}

/** What this phone may do right now. With one phone, it may do everything. */
export interface PhoneRole {
  /** Turn actions: spin, letters, answer, envelopes, buzz. */
  canPlay: boolean;
  /** Game management: start, next round, abandon, new game. */
  canManage: boolean;
  /** Team whose turn it is, when this phone is not playing. */
  waitingFor: number | null;
  /** The master may play for the team whose turn it is: its phone is disconnected. */
  canStandIn: boolean;
}

const FULL_ROLE: PhoneRole = {
  canPlay: true,
  canManage: true,
  waitingFor: null,
  canStandIn: false,
};

function hasTurns(view: PublicView): boolean {
  return view.phase === 'tossUp' || view.phase === 'playing' || view.phase === 'final';
}

/** standingIn: team the master chose to play for, if any. */
export function phoneRole(view: PublicView, room: RoomView, standingIn: number | null): PhoneRole {
  if (room.mode !== 'multi') return FULL_ROLE;
  const canManage = room.isMaster;
  // Before the buzz, every team plays at once on its own phone.
  if (view.phase === 'tossUp' && view.activeTeam === null) {
    return { canPlay: room.team !== null, canManage, waitingFor: null, canStandIn: false };
  }
  const turn = hasTurns(view) ? view.activeTeam : null;
  if (turn === null) return { canPlay: false, canManage, waitingFor: null, canStandIn: false };
  const own = turn === room.team;
  const canStandIn = room.isMaster && !own && room.seats[turn]?.connected === false;
  const canPlay = own || (canStandIn && standingIn === turn);
  return { canPlay, canManage, waitingFor: canPlay ? null : turn, canStandIn };
}
