import { describe, expect, it } from 'vitest';
import { WHEELS } from '../game/config';
import { positionAfter, slotAt, spinTravel } from '../game/wheel';
import { bordersCrossed, easeOutCubic, segmentAngle, segmentAtPointer } from './wheel-math';

const COUNT = 24;

describe('the TV and the game agree on the result', () => {
  it.each([0, 0.13, 0.5, 0.77, 1])('with a spin of force %d', (power) => {
    const wheel = WHEELS[2] ?? [];
    const angle = segmentAngle(wheel.length);
    for (const from of [0, 3.4, 17.9]) {
      const travel = spinTravel(power, wheel.length);
      // The TV turns from -from × angle, by travel × angle.
      const rotation = -from * angle + travel * angle;
      const position = positionAfter(from, travel, wheel.length);
      expect(segmentAtPointer(rotation, wheel.length)).toBe(slotAt(position, wheel).segmentIndex);
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
