/** True when the browser offers the Screen Wake Lock API. */
export function isWakeLockSupported(): boolean {
  // Typed as always present, but older browsers (maybe Silk) do not have it.
  return 'wakeLock' in navigator;
}

/**
 * Asks the browser to keep the TV screen on. The lock is dropped whenever the
 * page is hidden, so it is asked again each time the page comes back.
 */
export function keepScreenOn(): void {
  if (!isWakeLockSupported()) return;
  const request = (): void => {
    navigator.wakeLock.request('screen').catch(() => {
      // Refused (e.g. low battery or page not visible yet): the screen saver may come back.
    });
  };
  request();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
}
