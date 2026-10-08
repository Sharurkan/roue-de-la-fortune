interface Tone {
  frequency: number;
  /** Slides to this frequency over the tone, for "wah" effects. */
  endFrequency?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  /** Seconds after "now". */
  delay?: number;
}

const MASTER_VOLUME = 0.7;
const DEFAULT_VOLUME = 0.3;
const SILENT = 0.0001;

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
  roundStart(): void;
}

/** Returns null when Web Audio is not available. */
export function createSound(): Sound | null {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(context.destination);
  const noise = createNoiseBuffer(context);

  function envelope(volume: number, start: number, duration: number): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(SILENT, start + duration);
    gain.connect(master);
    return gain;
  }

  function play(tone: Tone): void {
    if (context.state !== 'running') return;
    const start = context.currentTime + (tone.delay ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + tone.duration);
    }
    oscillator.connect(envelope(tone.volume ?? DEFAULT_VOLUME, start, tone.duration));
    oscillator.start(start);
    oscillator.stop(start + tone.duration);
  }

  function click(): void {
    if (context.state !== 'running') return;
    const start = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    source.connect(filter).connect(envelope(0.5, start, 0.03));
    source.start(start);
    source.stop(start + 0.03);
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
    tick: click,
    reveal: () => {
      // A bell: a note and its octave, fading slowly.
      play({ frequency: 1320, duration: 0.6, volume: 0.25 });
      play({ frequency: 2640, duration: 0.4, volume: 0.1 });
    },
    absent: () => {
      // Two close low notes beat against each other, like a buzzer.
      play({ frequency: 110, duration: 0.6, type: 'square', volume: 0.12 });
      play({ frequency: 116, duration: 0.6, type: 'square', volume: 0.12 });
    },
    bankrupt: () => {
      [0, 0.45, 0.9].forEach((delay, index) => {
        const from = 330 - index * 60;
        play({
          frequency: from,
          endFrequency: from * 0.75,
          duration: 0.4,
          type: 'sawtooth',
          volume: 0.15,
          delay,
        });
      });
    },
    win: () => {
      [523, 659, 784].forEach((frequency, index) => {
        play({ frequency, duration: 0.2, type: 'triangle', delay: index * 0.13 });
      });
      [523, 659, 784, 1047].forEach((frequency) => {
        play({ frequency, duration: 0.9, type: 'triangle', volume: 0.15, delay: 0.42 });
      });
    },
    roundStart: () => {
      [392, 523, 659].forEach((frequency, index) => {
        play({ frequency, duration: 0.25, type: 'triangle', volume: 0.2, delay: index * 0.12 });
      });
    },
  };
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.05), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
