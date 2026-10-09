const LIGATURES: Readonly<Record<string, string>> = { Œ: 'OE', Æ: 'AE' };

/** Uppercase, accents removed, ligatures expanded: "Cœur à l'été" → "COEUR A L'ETE". */
export function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[ŒÆ]/g, (ligature) => LIGATURES[ligature] ?? ligature)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** True for the letters hidden on the board (A to Z). Everything else is shown. */
export function isHiddenCharacter(char: string): boolean {
  return /^[A-Z]$/.test(char);
}

/** Keeps only letters and digits, for a lenient answer comparison. "&" may be typed "et". */
export function normalizeAnswer(text: string): string {
  return normalizeText(text)
    .replace(/&/g, 'ET')
    .replace(/[^A-Z0-9]/g, '');
}

export function isSameAnswer(proposal: string, solution: string): boolean {
  return normalizeAnswer(proposal) === normalizeAnswer(solution);
}
