import { layoutBoard } from '../game/board';
import { BOARD_COLUMNS, BOARD_MAX_ROWS } from '../game/config';
import { isHiddenCharacter } from '../game/text';
import { createElement } from '../shared/dom';

const REVEAL_INTERVAL_MS = 450;

interface Tile {
  element: HTMLElement;
  char: string;
  revealed: boolean;
}

export interface Board {
  element: HTMLElement;
  /** Shows a new phrase, with the given letters already visible. */
  setPhrase(text: string, revealedLetters: readonly string[]): void;
  phrase(): string | null;
  /** Reveals the tiles of these letters one by one. */
  reveal(letters: readonly string[], onEachTile: () => void): Promise<void>;
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

  function showTile(tile: Tile): void {
    tile.revealed = true;
    tile.element.textContent = tile.char;
    tile.element.classList.add('revealed');
  }

  function setPhrase(text: string, revealedLetters: readonly string[]): void {
    currentPhrase = text;
    const cells = Array.from({ length: BOARD_COLUMNS * BOARD_MAX_ROWS }, () =>
      createElement('div', { className: 'tile empty' }),
    );
    tiles = [];
    for (const { row, column, char } of gridPositions(layoutBoard(text) ?? [])) {
      const cell = cells[row * BOARD_COLUMNS + column];
      if (cell === undefined || char === ' ') continue;
      const tile: Tile = { element: cell, char, revealed: false };
      cell.className = 'tile';
      if (!isHiddenCharacter(char) || revealedLetters.includes(char)) showTile(tile);
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
      showTile(tile);
      onEachTile();
    }
  }

  return {
    element,
    setPhrase,
    phrase: () => currentPhrase,
    reveal,
    revealAll: () => {
      tiles.filter((tile) => !tile.revealed).forEach(showTile);
    },
  };
}
