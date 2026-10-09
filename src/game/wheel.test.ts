import { describe, expect, it } from 'vitest';
import { WHEELS } from './config';
import { positionAfter, slotAt, travelTo } from './wheel';

const ROUND_4 = WHEELS[3] ?? [];
const JACKPOT = 0;

describe('slotAt', () => {
  it.each([
    [0, 'middle'],
    [0.2, 'middle'],
    [0.3, 'right'],
    [23.7, 'left'],
  ] as const)('position %d stops on the %s of the jackpot slot', (position, part) => {
    expect(slotAt(position, ROUND_4)).toEqual({ segmentIndex: JACKPOT, part });
  });

  it('other slots have no parts', () => {
    expect(slotAt(8.4, ROUND_4)).toEqual({ segmentIndex: 8, part: 'middle' });
  });
});

describe('travelTo (test mode)', () => {
  it.each(['left', 'middle', 'right'] as const)('stops on the %s part asked for', (part) => {
    for (const from of [0, 5.3, 23.9]) {
      const position = positionAfter(from, travelTo(from, JACKPOT, part, 24), 24);
      expect(slotAt(position, ROUND_4)).toEqual({ segmentIndex: JACKPOT, part });
    }
  });
});
