import { describe, expect, it } from 'vitest';
import { layoutBoard } from './board';
import { CONSONANTS, FINAL_GIVEN_LETTERS, VOWELS } from './config';
import { FINAL_PHRASES, PHRASES, TOSS_UP_PHRASES, type Phrase } from './phrases';
import { normalizeText } from './text';

const ALLOWED = /^[A-Z '\-,.!?&]+$/;

// One test per rule, listing every phrase that breaks it: a test per phrase would be thousands.
function failing(list: readonly Phrase[], isValid: (text: string) => boolean): string[] {
  return list.map((phrase) => phrase.text).filter((text) => !isValid(text));
}

function letters(text: string): string[] {
  return Array.from(normalizeText(text)).filter((char) => /[A-Z]/.test(char));
}

function duplicates(list: readonly Phrase[]): string[] {
  const seen = new Set<string>();
  return list
    .map((phrase) => normalizeText(phrase.text))
    .filter((text) => {
      const duplicate = seen.has(text);
      seen.add(text);
      return duplicate;
    });
}

describe.each([
  ['PHRASES', PHRASES],
  ['FINAL_PHRASES', FINAL_PHRASES],
  ['TOSS_UP_PHRASES', TOSS_UP_PHRASES],
])('%s', (_name, list) => {
  it('has at least 800 puzzles', () => {
    expect(list.length).toBeGreaterThanOrEqual(800);
  });

  it('has no duplicate', () => {
    expect(duplicates(list)).toEqual([]);
  });

  it('fits on the board', () => {
    expect(failing(list, (text) => layoutBoard(text) !== null)).toEqual([]);
  });

  it('only uses supported characters', () => {
    expect(failing(list, (text) => ALLOWED.test(normalizeText(text)))).toEqual([]);
  });

  it('has at least one consonant and one vowel', () => {
    const hasBoth = (text: string): boolean =>
      letters(text).some((char) => CONSONANTS.includes(char)) &&
      letters(text).some((char) => VOWELS.includes(char));
    expect(failing(list, hasBoth)).toEqual([]);
  });
});

describe('PHRASES', () => {
  it('has more than 1 000 puzzles', () => {
    expect(PHRASES.length).toBeGreaterThan(1000);
  });

  it('gives two songs joined by & for the Musique theme', () => {
    const music = PHRASES.filter((phrase) => phrase.theme === 'Musique');
    expect(music.length).toBeGreaterThanOrEqual(100);
    expect(failing(music, (text) => text.split(' & ').length === 2)).toEqual([]);
  });

  it('leaves short puzzles to the toss-up', () => {
    expect(failing(PHRASES, (text) => text.split(/\s+/).length > 2)).toEqual([]);
  });
});

describe('FINAL_PHRASES', () => {
  it('is neither given away nor bare once R S T L N E are shown', () => {
    const balanced = (text: string): boolean => {
      const all = letters(text);
      const share = all.filter((char) => FINAL_GIVEN_LETTERS.includes(char)).length / all.length;
      return share >= 0.05 && share <= 0.25;
    };
    expect(failing(FINAL_PHRASES, balanced)).toEqual([]);
  });

  it('never uses an expression nor a proverb', () => {
    const themes = FINAL_PHRASES.map((phrase) => phrase.theme);
    expect(themes).not.toContain('Expression');
    expect(themes).not.toContain('Proverbe');
  });
});

describe('TOSS_UP_PHRASES', () => {
  it('has more than 1 000 puzzles', () => {
    expect(TOSS_UP_PHRASES.length).toBeGreaterThan(1000);
  });

  it('has three words at most', () => {
    expect(failing(TOSS_UP_PHRASES, (text) => text.split(/\s+/).length <= 3)).toEqual([]);
  });

  it('shares no phrase with the other lists', () => {
    const others = new Set([...PHRASES, ...FINAL_PHRASES].map((p) => normalizeText(p.text)));
    expect(failing(TOSS_UP_PHRASES, (text) => !others.has(normalizeText(text)))).toEqual([]);
  });
});
