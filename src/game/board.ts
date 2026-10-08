import { BOARD_COLUMNS, BOARD_MAX_ROWS } from './config';
import { normalizeText } from './text';

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
