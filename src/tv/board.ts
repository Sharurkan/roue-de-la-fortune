import { layoutBoard } from '../game/board';
import { BOARD_COLUMNS, BOARD_MAX_ROWS } from '../game/config';
import { isHiddenCharacter } from '../game/text';
import { createElement } from '../shared/dom';

const REVEAL_INTERVAL_MS = 450;

interface Tile {
  element: HTMLElement;
  char: string;
  revealed: boolean;
  /** Position among the letters to guess, or null for punctuation. */
  letterIndex: number | null;
}

export interface Board {
  element: HTMLElement;
  /** Shows a new phrase, with the given letters (or letter positions) already visible. */
  setPhrase(
    text: string,
    revealedLetters: readonly string[],
    revealedTiles?: readonly number[],
  ): void;
  phrase(): string | null;
  /** Reveals the tiles of these letters one by one. */
  reveal(letters: readonly string[], onEachTile: () => void): Promise<void>;
  /** Toss-up: shows a single tile, given by its position among the letters to guess. */
  revealTile(letterIndex: number): void;
  revealAll(): void;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Places rows in a 4 × 14 grid, centred horizontally and vertically. */
function gridPositions(rows: readonly string[]): { row: number; column: number; char: string }[] {
  const top = Math.floor((BOARD_MAX_ROWS - rows.length) / 2);
  return rows.flatMap((text, rowIndex) => {
    const left = Math.floor((BOARD_COLUMNS - text.length) / 2);
    return Array.from(text).map((char, i) => ({ row: top + rowIndex, column: left + i, char }));
  });
}

export function createBoard(): Board {
  const element = createElement('div', { className: 'board' });
  let tiles: Tile[] = [];
  let currentPhrase: string | null = null;

  function showTile(tile: Tile, animate = false): void {
    tile.revealed = true;
    tile.element.textContent = tile.char;
    tile.element.classList.add('revealed');
    if (animate) tile.element.classList.add('flip');
  }

  function setPhrase(
    text: string,
    revealedLetters: readonly string[],
    revealedTiles: readonly number[] = [],
  ): void {
    currentPhrase = text;
    const cells = Array.from({ length: BOARD_COLUMNS * BOARD_MAX_ROWS }, () =>
      createElement('div', { className: 'tile empty' }),
    );
    tiles = [];
    let letterCount = 0;
    for (const { row, column, char } of gridPositions(layoutBoard(text) ?? [])) {
      const cell = cells[row * BOARD_COLUMNS + column];
      if (cell === undefined || char === ' ') continue;
      const letterIndex = isHiddenCharacter(char) ? letterCount++ : null;
      const tile: Tile = { element: cell, char, revealed: false, letterIndex };
      cell.className = 'tile';
      const visible =
        letterIndex === null ||
        revealedLetters.includes(char) ||
        revealedTiles.includes(letterIndex);
      if (visible) showTile(tile);
      tiles.push(tile);
    }
    element.replaceChildren(...cells);
  }

  async function reveal(letters: readonly string[], onEachTile: () => void): Promise<void> {
    for (const tile of tiles) {
      if (tile.revealed || !letters.includes(tile.char)) continue;
      tile.element.classList.add('lit');
      await wait(REVEAL_INTERVAL_MS);
      tile.element.classList.remove('lit');
      showTile(tile, true);
      onEachTile();
    }
  }

  return {
    element,
    setPhrase,
    phrase: () => currentPhrase,
    reveal,
    revealTile: (letterIndex) => {
      const tile = tiles.find((t) => t.letterIndex === letterIndex);
      if (tile !== undefined && !tile.revealed) showTile(tile, true);
    },
    revealAll: () => {
      for (const tile of tiles) if (!tile.revealed) showTile(tile, true);
    },
  };
}
