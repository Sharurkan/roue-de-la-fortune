export type WheelSegment =
  | { kind: 'value'; amount: number }
  /**
   * Shared slot: 25 % bankrupt on each edge, the amount in the middle half.
   * The amount is won once, whatever the number of letters found.
   */
  | { kind: 'jackpot'; amount: number }
  | { kind: 'bankrupt' }
  | { kind: 'pass' }
  /** "La Bonne Poche": two envelopes, one holds money, the other nothing. */
  | { kind: 'pocket' }
  /** Hidden panel: either its amount per letter, or a special effect. */
  | { kind: 'mystery'; amount: number };

/** Share of the jackpot slot taken by the bankrupt on each of its edges. */
export const JACKPOT_SIDE_SHARE = 0.25;

const v = (amount: number): WheelSegment => ({ kind: 'value', amount });
const BANKRUPT: WheelSegment = { kind: 'bankrupt' };
const PASS: WheelSegment = { kind: 'pass' };
const JACKPOT: WheelSegment = { kind: 'jackpot', amount: 5000 };
const POCKET: WheelSegment = { kind: 'pocket' };
const MYSTERY: WheelSegment = { kind: 'mystery', amount: 500 };

/** Mystery panel: one chance in two of a special effect instead of the amount. */
export const MYSTERY_EFFECT_CHANCE = 0.5;
export const MYSTERY_BONUS = 1000;
export const MYSTERY_EFFECTS = ['bonus', 'double', 'bankrupt', 'half'] as const;
export type MysteryEffect = (typeof MYSTERY_EFFECTS)[number];

/** "La Bonne Poche": the amount hidden in the winning envelope, drawn each time. */
export const POCKET_AMOUNTS: readonly number[] = [500, 1000, 1500, 2000, 3000];

/**
 * One wheel per regular round, like on TV, clockwise from 12 o'clock.
 * Round 1 has small amounts and no traps; round 3 has La Bonne Poche and the mystery panel; round 4 has the 5 000 € jackpot, shared with two bankrupts.
 */
export const WHEELS: readonly (readonly WheelSegment[])[] = [
  [
    v(150),
    v(300),
    v(100),
    v(250),
    v(750),
    v(1500),
    v(250),
    v(150),
    v(450),
    v(400),
    v(1000),
    v(900),
    v(150),
    v(200),
    v(150),
    v(300),
    v(300),
    v(250),
    v(100),
    v(500),
    v(750),
    v(250),
    v(500),
    v(200),
  ],
  [
    v(150),
    v(300),
    v(100),
    v(250),
    v(750),
    v(450),
    v(250),
    v(150),
    v(100),
    v(450),
    v(1000),
    v(900),
    v(150),
    v(200),
    v(150),
    v(300),
    v(300),
    v(250),
    v(100),
    v(500),
    v(750),
    v(200),
    v(500),
    PASS,
  ],
  [
    POCKET,
    v(300),
    v(100),
    v(250),
    BANKRUPT,
    v(1500),
    v(250),
    v(150),
    v(100),
    v(450),
    v(1000),
    v(900),
    MYSTERY,
    v(200),
    v(150),
    v(300),
    v(450),
    v(250),
    v(100),
    v(500),
    v(750),
    v(200),
    v(500),
    PASS,
  ],
  [
    JACKPOT,
    v(300),
    v(100),
    v(250),
    v(600),
    v(1500),
    v(250),
    v(150),
    PASS,
    v(450),
    v(1000),
    v(900),
    v(150),
    v(200),
    v(150),
    v(300),
    v(450),
    v(250),
    v(100),
    v(500),
    v(750),
    v(200),
    v(500),
    v(700),
  ],
];

export const VOWEL_COST = 250;
export const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXZ';
export const VOWELS = 'AEIOUY';

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;
export const MAX_TEAM_NAME_LENGTH = 20;
export const DEFAULT_TEAM_NAME_PREFIX = 'Équipe';

export const MAX_ANSWER_LENGTH = 100;

export const BOARD_COLUMNS = 14;
export const BOARD_MAX_ROWS = 4;

export const ROUND_COUNT = 4;

/** Toss-up: time between two letters appearing on the board. */
export const TOSS_UP_REVEAL_INTERVAL_MS = 1500;

/** Final round: letters given for free, then letters the finalist picks. */
export const FINAL_GIVEN_LETTERS = 'RSTLNE';
export const FINAL_CONSONANT_PICKS = 3;
export const FINAL_VOWEL_PICKS = 1;

export type Prize = { kind: 'money'; amount: number } | { kind: 'gift'; label: string };

const money = (amount: number): Prize => ({ kind: 'money', amount });
const gift = (label: string): Prize => ({ kind: 'gift', label });

/** Envelopes of the small final wheel. */
export const FINAL_PRIZES: readonly Prize[] = [
  money(500),
  money(1000),
  money(1500),
  money(2000),
  money(3000),
  money(5000),
  gift('Voyage'),
  gift('Bisou'),
];
