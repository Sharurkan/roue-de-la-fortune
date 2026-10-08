import type { PublicView } from '../protocol/view';

/** What the phone shows, derived only from the public view sent by the TV. */
export type PhoneScreen =
  | { kind: 'setup' }
  | {
      kind: 'turn';
      canSpin: boolean;
      canBuyVowel: boolean;
      noMoreConsonants: boolean;
      noMoreVowels: boolean;
    }
  | { kind: 'spinning' }
  | { kind: 'consonant'; value: number }
  | { kind: 'vowel' }
  | { kind: 'solving' }
  | { kind: 'roundOver'; winner: number | null }
  | { kind: 'gameOver' };

function roundScreen(view: PublicView): PhoneScreen {
  switch (view.step) {
    case 'spinning':
      return { kind: 'spinning' };
    case 'guessingConsonant':
      return { kind: 'consonant', value: view.consonantValue ?? 0 };
    case 'guessingVowel':
      return { kind: 'vowel' };
    case 'solving':
      return { kind: 'solving' };
    case 'choosing':
    case null:
      return {
        kind: 'turn',
        canSpin: view.canSpin,
        canBuyVowel: view.canBuyVowel,
        noMoreConsonants: view.noMoreConsonants,
        noMoreVowels: view.noMoreVowels,
      };
  }
}

export function describeScreen(view: PublicView): PhoneScreen {
  switch (view.phase) {
    case 'setup':
      return { kind: 'setup' };
    case 'playing':
      return roundScreen(view);
    case 'roundOver':
      return { kind: 'roundOver', winner: view.winner };
    case 'gameOver':
      return { kind: 'gameOver' };
  }
}

export interface LetterKey {
  letter: string;
  used: boolean;
}

export function letterKeys(letters: string, usedLetters: readonly string[]): LetterKey[] {
  return Array.from(letters, (letter) => ({ letter, used: usedLetters.includes(letter) }));
}

/** One name per team, empty when not typed: the TV then uses the default name. */
export function teamNamesFor(
  typedNames: readonly (string | undefined)[],
  teamCount: number,
): string[] {
  return Array.from({ length: teamCount }, (_, index) => typedNames[index] ?? '');
}
