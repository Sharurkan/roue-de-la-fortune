import { CONSONANTS, VOWEL_COST, VOWELS } from './config';
import type { PlayingState, Round } from './state';
import { normalizeText } from './text';

export function countOccurrences(phrase: string, letter: string): number {
  let count = 0;
  for (const char of normalizeText(phrase)) {
    if (char === letter) count += 1;
  }
  return count;
}

function hasHiddenLetterFrom(round: Round, letters: string): boolean {
  for (const char of normalizeText(round.phrase.text)) {
    if (letters.includes(char) && !round.guessedLetters.includes(char)) return true;
  }
  return false;
}

export function hasHiddenConsonants(round: Round): boolean {
  return hasHiddenLetterFrom(round, CONSONANTS);
}

export function hasHiddenVowels(round: Round): boolean {
  return hasHiddenLetterFrom(round, VOWELS);
}

export function activeTeamCanBuyVowel(state: PlayingState): boolean {
  const team = state.teams[state.round.activeTeam];
  return team !== undefined && team.roundScore >= VOWEL_COST && hasHiddenVowels(state.round);
}
