/**
 * Wheel geometry, in degrees, clockwise. Segment i is drawn centred on angle
 * i × segmentAngle; the pointer is fixed at the top (angle 0).
 */

export function segmentAngle(segmentCount: number): number {
  return 360 / segmentCount;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

export interface SpinTarget {
  segmentIndex: number;
  segmentCount: number;
  fullTurns: number;
  /** Offset inside the segment, in [-0.5, 0.5] of a segment, so the wheel does not always stop dead centre. */
  offset: number;
}

/** Final rotation, always ahead of `from`, that puts the target segment under the pointer. */
export function targetRotation(from: number, target: SpinTarget): number {
  const angle = segmentAngle(target.segmentCount);
  const wanted = -(target.segmentIndex + target.offset) * angle;
  return from + target.fullTurns * 360 + positiveModulo(wanted - from, 360);
}

/** Segment under the pointer for a given wheel rotation. */
export function segmentAtPointer(rotation: number, segmentCount: number): number {
  const angle = segmentAngle(segmentCount);
  return positiveModulo(Math.round(-rotation / angle), segmentCount);
}

/** Starts fast, slows down at the end. */
export function easeOutCubic(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - (1 - clamped) ** 3;
}

/** Counts segment borders passed between two rotations: one "tick" each. */
export function bordersCrossed(from: number, to: number, segmentCount: number): number {
  const angle = segmentAngle(segmentCount);
  const border = (rotation: number): number => Math.floor((rotation + angle / 2) / angle);
  return Math.abs(border(to) - border(from));
}
