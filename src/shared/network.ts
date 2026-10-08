/** Calls back now and on every change of the device's Internet connection. */
export function watchOnline(onChange: (online: boolean) => void): void {
  onChange(navigator.onLine);
  window.addEventListener('online', () => {
    onChange(true);
  });
  window.addEventListener('offline', () => {
    onChange(false);
  });
}
