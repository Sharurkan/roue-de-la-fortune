import { describe, expect, it } from 'vitest';
import {
  bordersCrossed,
  easeOutCubic,
  segmentAngle,
  segmentAtPointer,
  targetRotation,
} from './wheel-math';

const COUNT = 24;

describe('targetRotation', () => {
  it.each([0, 1, 7, 12, 23])('stops segment %i under the pointer', (segmentIndex) => {
    for (const from of [0, 95, 1234.5, -40]) {
      const end = targetRotation(from, {
        segmentIndex,
        segmentCount: COUNT,
        fullTurns: 4,
        offset: 0,
      });
      expect(segmentAtPointer(end, COUNT)).toBe(segmentIndex);
    }
  });

  it('turns forward by at least the requested full turns', () => {
    const end = targetRotation(100, {
      segmentIndex: 3,
      segmentCount: COUNT,
      fullTurns: 4,
      offset: 0,
    });
    expect(end - 100).toBeGreaterThanOrEqual(4 * 360);
    expect(end - 100).toBeLessThan(5 * 360);
  });

  it('stays in the right segment with an offset', () => {
    for (const offset of [-0.45, 0.45]) {
      const end = targetRotation(0, { segmentIndex: 5, segmentCount: COUNT, fullTurns: 3, offset });
      expect(segmentAtPointer(end, COUNT)).toBe(5);
    }
  });
});

describe('segmentAtPointer', () => {
  it('finds segment 0 at rest', () => {
    expect(segmentAtPointer(0, COUNT)).toBe(0);
  });

  it('turning clockwise by one segment brings the previous segment under the pointer', () => {
    expect(segmentAtPointer(segmentAngle(COUNT), COUNT)).toBe(COUNT - 1);
  });
});

describe('easeOutCubic', () => {
  it('goes from 0 to 1 and clamps', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
  });

  it('is faster at the start', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('bordersCrossed', () => {
  it('counts one tick per segment passed', () => {
    expect(bordersCrossed(0, 360, COUNT)).toBe(COUNT);
  });

  it('counts nothing inside a segment', () => {
    expect(bordersCrossed(0, segmentAngle(COUNT) / 3, COUNT)).toBe(0);
  });
});
