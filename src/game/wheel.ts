import { JACKPOT_SIDE_SHARE, WHEELS, type WheelSegment } from './config';
import type { SlotPart } from './state';

/** The wheel of a regular round. Later rounds, if any, keep the last wheel. */
export function wheelForRound(roundNumber: number): readonly WheelSegment[] {
  const index = Math.min(Math.max(roundNumber - 1, 0), WHEELS.length - 1);
  const wheel = WHEELS[index];
  if (wheel === undefined) throw new Error('No wheel configured');
  return wheel;
}

/** Draws where the pointer stops in the slot: the jackpot has a bankrupt on each edge. */
export function pickSlotPart(segment: WheelSegment | undefined, random: number): SlotPart {
  if (segment?.kind !== 'jackpot') return 'middle';
  if (random < JACKPOT_SIDE_SHARE) return 'left';
  return random < 1 - JACKPOT_SIDE_SHARE ? 'middle' : 'right';
}
