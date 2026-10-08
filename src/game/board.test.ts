import { describe, expect, it } from 'vitest';
import { layoutBoard } from './board';

describe('layoutBoard', () => {
  it('keeps a short phrase on one row', () => {
    expect(layoutBoard('Le Roi lion')).toEqual(['LE ROI LION']);
  });

  it('wraps on words, up to 14 characters per row', () => {
    expect(layoutBoard('Avoir le cœur sur la main')).toEqual(['AVOIR LE COEUR', 'SUR LA MAIN']);
  });

  it('never cuts a word', () => {
    expect(layoutBoard('Coûter les yeux de la tête')).toEqual(['COUTER LES', 'YEUX DE LA', 'TETE']);
  });

  it('collapses extra spaces', () => {
    expect(layoutBoard('  Le   Roi  lion ')).toEqual(['LE ROI LION']);
  });

  it('rejects a word longer than a row', () => {
    expect(layoutBoard('Anticonstitutionnellement')).toBeNull();
  });

  it('rejects a phrase longer than 4 rows', () => {
    expect(layoutBoard('Il ne faut pas vendre la peau de l’ours avant de l’avoir tué')).toBeNull();
  });
});
