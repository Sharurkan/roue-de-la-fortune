import type { GameEvent, RejectionReason } from './events';
import type { Phrase } from './phrases';
import type { GameState, Team } from './state';
import { normalizeText } from './text';

export interface GameDeps {
  /** Returns a number in [0, 1), like Math.random. */
  random: () => number;
  phrases: readonly Phrase[];
  finalPhrases: readonly Phrase[];
  tossUpPhrases: readonly Phrase[];
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

/** Picks an index not used yet in this game. Once all are used, starts over. */
export function pickUnused(
  random: () => number,
  length: number,
  used: readonly number[],
): { index: number; used: number[] } {
  const fresh = used.length >= length ? [] : used;
  const available = Array.from({ length }, (_, i) => i).filter((i) => !fresh.includes(i));
  const index = available[pickIndex(random, available.length)];
  if (index === undefined) throw new Error('Nothing to pick from');
  return { index, used: [...fresh, index] };
}

/** Fisher-Yates shuffle, with injected randomness. */
export function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = pickIndex(random, i + 1);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** The single uppercase letter typed, if it belongs to the allowed letters. */
export function normalizeLetter(input: string, allowed: string): string | null {
  const letter = normalizeText(input.trim());
  return letter.length === 1 && allowed.includes(letter) ? letter : null;
}

export function updateTeam(teams: Team[], index: number, update: (team: Team) => Team): Team[] {
  return teams.map((team, i) => (i === index ? update(team) : team));
}
