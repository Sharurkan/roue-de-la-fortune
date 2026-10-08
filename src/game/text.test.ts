import { describe, expect, it } from 'vitest';
import { isHiddenCharacter, isSameAnswer, normalizeAnswer, normalizeText } from './text';

describe('normalizeText', () => {
  it('uppercases', () => {
    expect(normalizeText('bonjour')).toBe('BONJOUR');
  });

  it('removes accents', () => {
    expect(normalizeText('Élève à la fenêtre, ça où')).toBe('ELEVE A LA FENETRE, CA OU');
  });

  it('expands ligatures, lowercase or uppercase', () => {
    expect(normalizeText('cœur Œuf ex æquo')).toBe('COEUR OEUF EX AEQUO');
  });

  it('keeps apostrophes, hyphens and punctuation', () => {
    expect(normalizeText("l'arc-en-ciel !")).toBe("L'ARC-EN-CIEL !");
  });
});

describe('isHiddenCharacter', () => {
  it('hides letters', () => {
    expect(isHiddenCharacter('A')).toBe(true);
    expect(isHiddenCharacter('Z')).toBe(true);
  });

  it.each(["'", '-', ',', ' ', '!', '?', '.', '1'])('shows %j', (char) => {
    expect(isHiddenCharacter(char)).toBe(false);
  });
});

describe('normalizeAnswer', () => {
  it('removes spaces and punctuation', () => {
    expect(normalizeAnswer("  L'arc-en-ciel, enfin ! ")).toBe('LARCENCIELENFIN');
  });
});

describe('isSameAnswer', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(isSameAnswer('le mont saint michel', 'Le mont Saint-Michel')).toBe(true);
    expect(isSameAnswer('BOEUF bourguignon', 'Bœuf bourguignon')).toBe(true);
    expect(isSameAnswer('cote d azur', "La Côte d'Azur")).toBe(false);
    expect(isSameAnswer('la cote dazur', "La Côte d'Azur")).toBe(true);
  });

  it('rejects a different answer', () => {
    expect(isSameAnswer('Le Roi singe', 'Le Roi lion')).toBe(false);
  });
});
