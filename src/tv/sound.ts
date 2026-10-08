const BEEP_FREQUENCY_HZ = 880;
const BEEP_DURATION_S = 0.15;
const BEEP_VOLUME = 0.3;

export interface Sound {
  /** Must be called from a user gesture (remote OK button), or browsers keep audio muted. */
  unlock(): Promise<boolean>;
  isUnlocked(): boolean;
  beep(): void;
}

/** Returns null when Web Audio is not available. */
export function createSound(): Sound | null {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();

  function beep(): void {
    if (context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.frequency.value = BEEP_FREQUENCY_HZ;
    gain.gain.setValueAtTime(BEEP_VOLUME, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + BEEP_DURATION_S);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + BEEP_DURATION_S);
  }

  return {
    unlock: async () => {
      try {
        await context.resume();
      } catch {
        return false;
      }
      beep();
      return context.state === 'running';
    },
    isUnlocked: () => context.state === 'running',
    beep,
  };
}
