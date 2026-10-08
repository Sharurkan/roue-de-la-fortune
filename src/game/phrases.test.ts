import { describe, expect, it } from 'vitest';
import { layoutBoard } from './board';
import { CONSONANTS, VOWELS } from './config';
import { PHRASES } from './phrases';
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
