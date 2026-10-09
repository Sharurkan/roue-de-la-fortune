export type WheelSegment =
  { kind: 'value'; amount: number } | { kind: 'bankrupt' } | { kind: 'pass' };

const value = (amount: number): WheelSegment => ({ kind: 'value', amount });
const BANKRUPT: WheelSegment = { kind: 'bankrupt' };
const PASS: WheelSegment = { kind: 'pass' };

export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  value(300),
  value(500),
  BANKRUPT,
  value(200),
  value(800),
  value(400),
  value(600),
  PASS,
  value(250),
  value(700),
  value(350),
  value(900),
  BANKRUPT,
  value(150),
  value(450),
  value(550),
  value(200),
  value(1000),
  value(300),
  PASS,
  value(650),
  value(400),
  value(500),
  value(750),
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
