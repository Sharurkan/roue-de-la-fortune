import {
  JACKPOT_SIDE_SHARE,
  SPIN_MIN_TURNS,
  SPIN_POWER_TURNS,
  WHEELS,
  type WheelSegment,
} from './config';
import type { SlotPart } from './state';

/** The wheel of a regular round. Later rounds, if any, keep the last wheel. */
export function wheelForRound(roundNumber: number): readonly WheelSegment[] {
  const index = Math.min(Math.max(roundNumber - 1, 0), WHEELS.length - 1);
  const wheel = WHEELS[index];
  if (wheel === undefined) throw new Error('No wheel configured');
  return wheel;
}

export function isValidPower(power: number): boolean {
  return Number.isFinite(power) && power >= 0 && power <= 1;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

/** How far a spin of this force goes, in segments. */
export function spinTravel(power: number, segmentCount: number): number {
  return segmentCount * (SPIN_MIN_TURNS + power * SPIN_POWER_TURNS);
}

/** The wheel turns clockwise: the position under the pointer goes down. */
export function positionAfter(from: number, travel: number, segmentCount: number): number {
  return positiveModulo(from - travel, segmentCount);
}

/** Segment under the pointer, and where in it: the jackpot has a bankrupt on each edge. */
export function slotAt(
  position: number,
  wheel: readonly WheelSegment[],
): { segmentIndex: number; part: SlotPart } {
  const nearest = Math.round(position);
  const segmentIndex = positiveModulo(nearest, wheel.length);
  if (wheel[segmentIndex]?.kind !== 'jackpot') return { segmentIndex, part: 'middle' };
  const offset = position - nearest;
  const edge = 0.5 - JACKPOT_SIDE_SHARE;
  const part = offset < -edge ? 'left' : offset > edge ? 'right' : 'middle';
  return { segmentIndex, part };
}

const PART_OFFSET: Record<SlotPart, number> = {
  left: -(0.5 - JACKPOT_SIDE_SHARE / 2),
  middle: 0,
  right: 0.5 - JACKPOT_SIDE_SHARE / 2,
};

/** Test mode: a travel that stops in the middle of the given part of the segment. */
export function travelTo(
  from: number,
  segmentIndex: number,
  part: SlotPart,
  segmentCount: number,
): number {
  const target = segmentIndex + PART_OFFSET[part];
  return segmentCount * SPIN_MIN_TURNS + positiveModulo(from - target, segmentCount);
}
