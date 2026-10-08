interface Tone {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  /** Seconds after "now". */
  delay?: number;
}

const DEFAULT_VOLUME = 0.3;

export interface Sound {
  /** Must be called from a user gesture (remote OK button), or browsers keep audio muted. */
  unlock(): Promise<boolean>;
  isUnlocked(): boolean;
  beep(): void;
  tick(): void;
  reveal(): void;
  absent(): void;
  bankrupt(): void;
  win(): void;
}

/** Returns null when Web Audio is not available. */
export function createSound(): Sound | null {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();

  function play(tone: Tone): void {
    if (context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + (tone.delay ?? 0);
    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(tone.volume ?? DEFAULT_VOLUME, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + tone.duration);
  }

  const beep = (): void => {
    play({ frequency: 880, duration: 0.15 });
  };

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
    tick: () => {
      play({ frequency: 1800, duration: 0.03, type: 'square', volume: 0.08 });
    },
    reveal: () => {
      play({ frequency: 1320, duration: 0.25, type: 'triangle' });
    },
    absent: () => {
      play({ frequency: 140, duration: 0.5, type: 'sawtooth', volume: 0.2 });
    },
    bankrupt: () => {
      [440, 330, 220, 110].forEach((frequency, index) => {
        play({ frequency, duration: 0.25, type: 'sawtooth', volume: 0.2, delay: index * 0.2 });
      });
    },
    win: () => {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        play({ frequency, duration: 0.3, type: 'triangle', delay: index * 0.15 });
      });
    },
  };
}
