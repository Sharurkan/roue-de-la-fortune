import { describe, expect, it } from 'vitest';
import { layoutBoard } from './board';
import { CONSONANTS, FINAL_GIVEN_LETTERS, VOWELS } from './config';
import { FINAL_PHRASES, PHRASES, TOSS_UP_PHRASES } from './phrases';
import { normalizeText } from './text';

const ALLOWED = /^[A-Z '\-,.!?]+$/;

describe('PHRASES', () => {
  it('contains about 40 phrases', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(35);
  });

  it('has no duplicate', () => {
    const texts = PHRASES.map((phrase) => normalizeText(phrase.text));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each(PHRASES.map((phrase) => phrase.text))('%s fits on the board', (text) => {
    expect(layoutBoard(text)).not.toBeNull();
  });

  it.each(PHRASES.map((phrase) => phrase.text))('%s only uses supported characters', (text) => {
    expect(normalizeText(text)).toMatch(ALLOWED);
  });

  it.each(PHRASES.map((phrase) => phrase.text))(
    '%s has at least one consonant and one vowel',
    (text) => {
      const letters = Array.from(normalizeText(text));
      expect(letters.some((char) => CONSONANTS.includes(char))).toBe(true);
      expect(letters.some((char) => VOWELS.includes(char))).toBe(true);
    },
  );
});

describe('FINAL_PHRASES', () => {
  it('contains enough answers to vary the final', () => {
    expect(FINAL_PHRASES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(FINAL_PHRASES.map((phrase) => phrase.text))('%s fits on the board', (text) => {
    expect(layoutBoard(text)).not.toBeNull();
  });

  it.each(FINAL_PHRASES.map((phrase) => phrase.text))(
    '%s only uses supported characters',
    (text) => {
      expect(normalizeText(text)).toMatch(ALLOWED);
    },
  );

  it.each(FINAL_PHRASES.map((phrase) => phrase.text))(
    '%s still hides letters once R S T L N E are given',
    (text) => {
      const hidden = Array.from(normalizeText(text)).filter(
        (char) => /[A-Z]/.test(char) && !FINAL_GIVEN_LETTERS.includes(char),
      );
      expect(hidden.length).toBeGreaterThanOrEqual(2);
    },
  );
});

describe('TOSS_UP_PHRASES', () => {
  it('contains enough puzzles for many games', () => {
    expect(TOSS_UP_PHRASES.length).toBeGreaterThanOrEqual(30);
  });

  it('shares no phrase with the other lists', () => {
    const others = [...PHRASES, ...FINAL_PHRASES].map((phrase) => normalizeText(phrase.text));
    const tossUps = TOSS_UP_PHRASES.map((phrase) => normalizeText(phrase.text));
    expect(tossUps.filter((text) => others.includes(text))).toEqual([]);
    expect(new Set(tossUps).size).toBe(tossUps.length);
  });

  it.each(TOSS_UP_PHRASES.map((phrase) => phrase.text))('%s fits on the board', (text) => {
    expect(layoutBoard(text)).not.toBeNull();
  });

  it.each(TOSS_UP_PHRASES.map((phrase) => phrase.text))(
    '%s only uses supported characters',
    (text) => {
      expect(normalizeText(text)).toMatch(ALLOWED);
    },
  );
});
