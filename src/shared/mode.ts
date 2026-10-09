const APP_MODES = ['tv', 'manette', 'test-tv', 'test-manette'] as const;

export type AppMode = (typeof APP_MODES)[number];

function isAppMode(value: string): value is AppMode {
  return APP_MODES.some((mode) => mode === value);
}

/** `&test` in the address unlocks shortcuts for testing, such as starting at a later round. */
export function isTestMode(search: string): boolean {
  return new URLSearchParams(search).has('test');
}

export function parseMode(search: string): AppMode | null {
  const mode = new URLSearchParams(search).get('mode');
  return mode !== null && isAppMode(mode) ? mode : null;
}
