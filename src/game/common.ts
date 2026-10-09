import type { GameEvent, RejectionReason } from './events';
import type { Phrase } from './phrases';
import type { GameState, Team } from './state';
import { normalizeText } from './text';

export interface GameDeps {
  /** Returns a number in [0, 1), like Math.random. */
  random: () => number;
  phrases: readonly Phrase[];
  finalPhrases: readonly Phrase[];
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export function reject(state: GameState, reason: RejectionReason): ReduceResult {
  return { state, events: [{ type: 'actionRejected', reason }] };
}

export function pickIndex(random: () => number, length: number): number {
  return Math.min(Math.floor(random() * length), length - 1);
}

/** The single uppercase letter typed, if it belongs to the allowed letters. */
export function normalizeLetter(input: string, allowed: string): string | null {
  const letter = normalizeText(input.trim());
  return letter.length === 1 && allowed.includes(letter) ? letter : null;
}

export function updateTeam(teams: Team[], index: number, update: (team: Team) => Team): Team[] {
  return teams.map((team, i) => (i === index ? update(team) : team));
}
