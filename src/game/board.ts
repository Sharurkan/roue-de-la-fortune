import { BOARD_COLUMNS, BOARD_MAX_ROWS } from './config';
import { isHiddenCharacter, normalizeText } from './text';

/**
 * Splits a phrase into board rows, wrapping on words.
 * Returns null when the phrase does not fit on the board.
 */
export function layoutBoard(phrase: string): string[] | null {
  const words = normalizeText(phrase).split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  for (const word of words) {
    if (word.length > BOARD_COLUMNS) return null;
    const last = rows[rows.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= BOARD_COLUMNS) {
      rows[rows.length - 1] = `${last} ${word}`;
    } else {
      rows.push(word);
    }
  }
  return rows.length <= BOARD_MAX_ROWS ? rows : null;
}

/** Stands for a letter still hidden, in the board sent to the phone. */
export const HIDDEN_TILE = '_';

/**
 * The board as the TV shows it: hidden letters replaced by HIDDEN_TILE.
 * revealedTiles are positions among the letters to guess (toss-up).
 */
export function maskBoard(
  phrase: string,
  revealedLetters: readonly string[],
  revealedTiles: readonly number[] = [],
): string[] {
  let letterIndex = 0;
  return (layoutBoard(phrase) ?? []).map((row) =>
    Array.from(row, (char) => {
      if (!isHiddenCharacter(char)) return char;
      const visible = revealedLetters.includes(char) || revealedTiles.includes(letterIndex);
      letterIndex += 1;
      return visible ? char : HIDDEN_TILE;
    }).join(''),
  );
}

export interface FilledBoard {
  rows: string[];
  /** Hidden tiles still empty. */
  missing: number;
  /** Typed letters that do not fit in the hidden tiles. */
  extra: number;
}

/** Puts the typed letters, in order, into the hidden tiles. Anything but letters is ignored. */
export function fillBoard(rows: readonly string[], typed: string): FilledBoard {
  const letters = Array.from(normalizeText(typed)).filter(isHiddenCharacter);
  let next = 0;
  const filled = rows.map((row) =>
    Array.from(row, (char) =>
      char === HIDDEN_TILE ? (letters[next++] ?? HIDDEN_TILE) : char,
    ).join(''),
  );
  const tiles = rows.join('').split(HIDDEN_TILE).length - 1;
  return {
    rows: filled,
    missing: Math.max(tiles - letters.length, 0),
    extra: Math.max(letters.length - tiles, 0),
  };
}
