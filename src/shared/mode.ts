export type AppMode = 'tv' | 'manette';

export function parseMode(search: string): AppMode | null {
  const mode = new URLSearchParams(search).get('mode');
  return mode === 'tv' || mode === 'manette' ? mode : null;
}
