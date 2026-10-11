import { describe, expect, it } from 'vitest';
import { fillBoard, layoutBoard, maskBoard } from './board';

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

describe('maskBoard', () => {
  it('hides the letters not yet found, keeps punctuation', () => {
    expect(maskBoard("L'été indien", ['E'])).toEqual(["_'E_E ____E_"]);
  });

  it('shows the toss-up tiles given by position', () => {
    expect(maskBoard('Le Roi lion', [], [0, 4])).toEqual(['L_ __I ____']);
  });

  it('wraps like the TV board', () => {
    expect(maskBoard('Avoir le cœur sur la main', [])).toEqual(['_____ __ _____', '___ __ ____']);
  });

  it('keeps the ampersand of two songs visible', () => {
    expect(maskBoard('Lac & Mer', ['A'])).toEqual(['_A_ & ___']);
  });
});

describe('fillBoard', () => {
  const rows = ['L_ R__', '_ION'];

  it('fills the hidden tiles in order', () => {
    expect(fillBoard(rows, 'eoil')).toEqual({ rows: ['LE ROI', 'LION'], missing: 0, extra: 0 });
  });

  it('ignores accents, spaces and punctuation in what is typed', () => {
    expect(fillBoard(rows, 'é o-i  l')).toMatchObject({ rows: ['LE ROI', 'LION'] });
  });

  it('counts the empty tiles left', () => {
    expect(fillBoard(rows, 'E')).toEqual({ rows: ['LE R__', '_ION'], missing: 3, extra: 0 });
  });

  it('counts the letters that do not fit', () => {
    expect(fillBoard(rows, 'EOILXY')).toMatchObject({ rows: ['LE ROI', 'LION'], extra: 2 });
  });
});
