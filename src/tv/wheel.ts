import type { WheelSegment } from '../game/config';
import { createSvgElement } from '../shared/dom';
import { TV_TEXTS } from './texts';
import { bordersCrossed, easeOutCubic, segmentAngle, targetRotation } from './wheel-math';

const RADIUS = 100;
const LABEL_RADIUS = 58;
const SPIN_DURATION_MS = 5000;
const FULL_TURNS = 4;
/** Keeps the pointer away from segment borders, so the result is never ambiguous. */
const MAX_OFFSET = 0.35;
const VALUE_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#8e44ad'];

export interface Wheel {
  element: SVGSVGElement;
  /** Resolves when the wheel has stopped on the segment. */
  spin(segmentIndex: number): Promise<void>;
}

function pointAt(angle: number, radius: number): string {
  const radians = (angle * Math.PI) / 180;
  return `${String(radius * Math.sin(radians))} ${String(-radius * Math.cos(radians))}`;
}

function segmentStyle(
  segment: WheelSegment,
  index: number,
): { fill: string; text: string; label: string } {
  switch (segment.kind) {
    case 'bankrupt':
      return { fill: '#111111', text: '#ffffff', label: TV_TEXTS.wheel.bankrupt };
    case 'pass':
      return { fill: '#f8f9fa', text: '#111111', label: TV_TEXTS.wheel.pass };
    case 'value':
      return {
        fill: VALUE_COLORS[index % VALUE_COLORS.length] ?? '#457b9d',
        text: '#ffffff',
        label: String(segment.amount),
      };
  }
}

function drawSegment(segment: WheelSegment, index: number, angle: number): SVGGElement {
  const style = segmentStyle(segment, index);
  const start = (index - 0.5) * angle;
  const end = (index + 0.5) * angle;
  const wedge = createSvgElement('path', {
    d: `M 0 0 L ${pointAt(start, RADIUS)} A ${String(RADIUS)} ${String(RADIUS)} 0 0 1 ${pointAt(end, RADIUS)} Z`,
    fill: style.fill,
    stroke: '#ffffff',
    'stroke-width': 0.8,
  });
  const label = createSvgElement('text', {
    transform: `rotate(${String(index * angle)}) translate(0 ${String(-LABEL_RADIUS)}) rotate(-90)`,
    fill: style.text,
    'font-size': style.label.length > 5 ? 6.5 : 10,
    'font-weight': 'bold',
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  });
  label.textContent = style.label;
  return createSvgElement('g', {}, [wedge, label]);
}

export function createWheel(segments: readonly WheelSegment[], onTick: () => void): Wheel {
  const angle = segmentAngle(segments.length);
  const rotor = createSvgElement(
    'g',
    {},
    segments.map((segment, index) => drawSegment(segment, index, angle)),
  );
  const hub = createSvgElement('circle', { r: 12, fill: '#ffd23f', stroke: '#ffffff' });
  const pointer = createSvgElement('polygon', {
    points: '-9,-114 9,-114 0,-92',
    fill: '#ffd23f',
    stroke: '#0b1a3a',
    'stroke-width': 1.5,
  });
  const element = createSvgElement('svg', { viewBox: '-110 -118 220 228', class: 'wheel' }, [
    rotor,
    hub,
    pointer,
  ]);
  let rotation = 0;

  function show(value: number): void {
    rotor.setAttribute('transform', `rotate(${String(value)})`);
  }

  function spin(segmentIndex: number): Promise<void> {
    const from = rotation;
    const to = targetRotation(from, {
      segmentIndex,
      segmentCount: segments.length,
      fullTurns: FULL_TURNS,
      offset: (Math.random() * 2 - 1) * MAX_OFFSET,
    });
    return new Promise((resolve) => {
      const startedAt = performance.now();
      let previous = from;
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        rotation = to;
        show(to);
        resolve();
      };
      const frame = (now: number): void => {
        if (done) return;
        const progress = (now - startedAt) / SPIN_DURATION_MS;
        const current = from + (to - from) * easeOutCubic(progress);
        if (bordersCrossed(previous, current, segments.length) > 0) onTick();
        previous = current;
        show(current);
        if (progress >= 1) finish();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      // Animation frames pause when the page is hidden: the game must not get stuck.
      setTimeout(finish, SPIN_DURATION_MS + 1000);
    });
  }

  show(rotation);
  return { element, spin };
}
