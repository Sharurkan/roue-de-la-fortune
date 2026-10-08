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
