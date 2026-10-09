import type { WheelSegment } from '../game/config';
import { createSvgElement } from '../shared/dom';
import { TV_TEXTS } from './texts';
import { bordersCrossed, easeOutCubic, segmentAngle, targetRotation } from './wheel-math';

/** Rim, pegs, hub and pointer use the shared trim colours defined in style.css. */
const TRIM = {
  light: 'var(--trim-light)',
  main: 'var(--trim-main)',
  dark: 'var(--trim-dark)',
  deep: 'var(--trim-deep)',
  shadow: 'var(--trim-shadow)',
};
const RIM_RADIUS = 100;
const RADIUS = 94;
const PEG_RADIUS = 89;
const BULB_COUNT = 24;
const SPIN_DURATION_MS = 5000;
const FULL_TURNS = 4;
/** Keeps the pointer away from segment borders, so the result is never ambiguous. */
const MAX_OFFSET = 0.35;
/** Rich jewel tones: lively without being neon. Two neighbours never share a colour. */
const VALUE_COLORS = [
  '#d7263d',
  '#f46036',
  '#e8a33d',
  '#2a9d6f',
  '#2e86de',
  '#6c5ce7',
  '#d63384',
  '#1aa3a3',
];
const DIGIT_STEP = 12.5;
const FIRST_DIGIT_RADIUS = 82;

/** What one segment of a wheel looks like. */
export interface WheelFace {
  fill: string;
  ink: string;
  label: { kind: 'digits'; text: string } | { kind: 'word'; text: string } | { kind: 'envelope' };
}

export interface Wheel {
  element: SVGSVGElement;
  /** Resolves when the wheel has stopped on the segment. */
  spin(segmentIndex: number): Promise<void>;
}

/** Faces of the main wheel. */
export function segmentFaces(segments: readonly WheelSegment[]): WheelFace[] {
  return segments.map((segment, index) => {
    switch (segment.kind) {
      case 'bankrupt':
        return {
          fill: '#15151a',
          ink: '#ffffff',
          label: { kind: 'word', text: TV_TEXTS.wheel.bankrupt },
        };
      case 'pass':
        return {
          fill: '#f7f4ea',
          ink: '#15151a',
          label: { kind: 'word', text: TV_TEXTS.wheel.pass },
        };
      case 'value':
        return {
          fill: VALUE_COLORS[index % VALUE_COLORS.length] ?? '#2e86de',
          ink: '#ffffff',
          label: { kind: 'digits', text: String(segment.amount) },
        };
    }
  });
}

/** Faces of the final wheel: identical envelopes, so nobody knows what is inside. */
export function envelopeFaces(count: number): WheelFace[] {
  return Array.from({ length: count }, (_, index) => ({
    fill: VALUE_COLORS[(index * 3) % VALUE_COLORS.length] ?? '#2e86de',
    ink: '#ffffff',
    label: { kind: 'envelope' },
  }));
}

function pointAt(angle: number, radius: number): string {
  const radians = (angle * Math.PI) / 180;
  return `${String(radius * Math.sin(radians))} ${String(-radius * Math.cos(radians))}`;
}

/** Values are written like on TV: one digit under the other, from the rim inwards. */
function stackedLabel(text: string, color: string): SVGTextElement[] {
  return Array.from(text, (char, i) => {
    const digit = createSvgElement('text', {
      y: -(FIRST_DIGIT_RADIUS - i * DIGIT_STEP),
      fill: color,
      class: 'wheel-digit',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    digit.textContent = char;
    return digit;
  });
}

/** Long words do not fit stacked: they run along the radius instead. */
function radialLabel(text: string, color: string): SVGTextElement {
  const label = createSvgElement('text', {
    transform: 'translate(0 -56) rotate(-90)',
    fill: color,
    class: 'wheel-word',
    'font-size': text.length > 5 ? 9 : 12,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  });
  label.textContent = text;
  return label;
}

function envelopeIcon(): SVGGElement {
  return createSvgElement('g', { transform: 'translate(0 -60)', class: 'wheel-envelope' }, [
    createSvgElement('rect', { x: -15, y: -10, width: 30, height: 20, rx: 2 }),
    createSvgElement('path', { d: 'M -15 -9 L 0 3 L 15 -9', fill: 'none' }),
  ]);
}

function faceLabel(face: WheelFace): SVGElement[] {
  switch (face.label.kind) {
    case 'digits':
      return stackedLabel(face.label.text, face.ink);
    case 'word':
      return [radialLabel(face.label.text, face.ink)];
    case 'envelope':
      return [envelopeIcon()];
  }
}

function drawSegment(face: WheelFace, index: number, angle: number, trim: string): SVGGElement {
  const start = (index - 0.5) * angle;
  const end = (index + 0.5) * angle;
  const wedge = createSvgElement('path', {
    d: `M 0 0 L ${pointAt(start, RADIUS)} A ${String(RADIUS)} ${String(RADIUS)} 0 0 1 ${pointAt(end, RADIUS)} Z`,
    fill: face.fill,
  });
  const peg = createSvgElement('circle', {
    cx: PEG_RADIUS * Math.sin((start * Math.PI) / 180),
    cy: -PEG_RADIUS * Math.cos((start * Math.PI) / 180),
    r: 2.2,
    fill: trim,
  });
  return createSvgElement('g', {}, [
    wedge,
    createSvgElement('g', { transform: `rotate(${String(index * angle)})` }, faceLabel(face)),
    peg,
  ]);
}

let wheelCount = 0;

/** Gradient ids must be unique in the page, and the TV shows two wheels. */
function gradientIds(): { trim: string; shade: string } {
  wheelCount += 1;
  return { trim: `wheel-trim-${String(wheelCount)}`, shade: `wheel-shade-${String(wheelCount)}` };
}

function drawDefs(ids: { trim: string; shade: string }): SVGDefsElement {
  const stop = (offset: string, color: string, opacity = 1) =>
    // CSS variables only work in style, not in SVG presentation attributes.
    createSvgElement('stop', {
      offset,
      style: `stop-color: ${color}; stop-opacity: ${String(opacity)}`,
    });
  return createSvgElement('defs', {}, [
    createSvgElement('linearGradient', { id: ids.trim, x1: 0, y1: 0, x2: 1, y2: 1 }, [
      stop('0%', TRIM.light),
      stop('45%', TRIM.main),
      stop('100%', TRIM.dark),
    ]),
    // One light-to-shadow overlay over every segment gives the wheel its relief.
    createSvgElement('radialGradient', { id: ids.shade, cx: '45%', cy: '40%', r: '60%' }, [
      stop('0%', '#ffffff', 0.22),
      stop('55%', '#ffffff', 0),
      stop('100%', '#000000', 0.18),
    ]),
  ]);
}

function drawBulbs(): SVGGElement {
  const angle = segmentAngle(BULB_COUNT);
  return createSvgElement(
    'g',
    { class: 'wheel-bulbs' },
    Array.from({ length: BULB_COUNT }, (_, i) =>
      createSvgElement('circle', {
        cx: RIM_RADIUS * Math.sin((i * angle * Math.PI) / 180),
        cy: -RIM_RADIUS * Math.cos((i * angle * Math.PI) / 180),
        r: 2.4,
        class: i % 2 === 0 ? 'bulb' : 'bulb bulb-alt',
      }),
    ),
  );
}

function drawPointer(trim: string): SVGGElement {
  const shape = 'M 0 -88 C -9 -98 -12 -106 -12 -112 A 12 12 0 0 1 12 -112 C 12 -106 9 -98 0 -88 Z';
  return createSvgElement('g', { class: 'wheel-pointer' }, [
    createSvgElement('path', {
      d: shape,
      fill: '#000000',
      opacity: 0.35,
      transform: 'translate(2 3)',
    }),
    createSvgElement('path', {
      d: shape,
      fill: trim,
      style: `stroke: ${TRIM.deep}`,
      'stroke-width': 1.2,
    }),
    createSvgElement('circle', { cx: 0, cy: -111, r: 4, style: `fill: ${TRIM.deep}` }),
  ]);
}

function restartAnimation(element: Element, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect(); // Forces a layout, so that the browser sees the class as new.
  element.classList.add(className);
}

export function createWheel(faces: readonly WheelFace[], onTick: () => void): Wheel {
  const angle = segmentAngle(faces.length);
  const ids = gradientIds();
  const trim = `url(#${ids.trim})`;
  const rotor = createSvgElement('g', {}, [
    ...faces.map((face, index) => drawSegment(face, index, angle, trim)),
    createSvgElement('circle', { r: RADIUS, fill: `url(#${ids.shade})` }),
  ]);
  const pointer = drawPointer(trim);
  const element = createSvgElement('svg', { viewBox: '-112 -126 224 240', class: 'wheel' }, [
    drawDefs(ids),
    createSvgElement('circle', { cx: 3, cy: 6, r: RIM_RADIUS + 6, fill: '#000000', opacity: 0.35 }),
    createSvgElement('circle', { r: RIM_RADIUS + 4, fill: trim }),
    createSvgElement('circle', { r: RIM_RADIUS - 2, style: `fill: ${TRIM.shadow}` }),
    rotor,
    drawBulbs(),
    createSvgElement('circle', {
      r: 17,
      fill: trim,
      style: `stroke: ${TRIM.deep}`,
      'stroke-width': 1.5,
    }),
    createSvgElement('circle', {
      r: 9,
      style: `fill: ${TRIM.main}; stroke: ${TRIM.light}`,
      'stroke-width': 1,
    }),
    pointer,
  ]);
  let rotation = 0;

  function show(value: number): void {
    rotor.setAttribute('transform', `rotate(${String(value)})`);
  }

  function tick(): void {
    restartAnimation(pointer, 'flick');
    onTick();
  }

  function spin(segmentIndex: number): Promise<void> {
    const from = rotation;
    const to = targetRotation(from, {
      segmentIndex,
      segmentCount: faces.length,
      fullTurns: FULL_TURNS,
      offset: (Math.random() * 2 - 1) * MAX_OFFSET,
    });
    element.classList.add('spinning');
    return new Promise((resolve) => {
      const startedAt = performance.now();
      let previous = from;
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        rotation = to;
        show(to);
        element.classList.remove('spinning');
        resolve();
      };
      const frame = (now: number): void => {
        if (done) return;
        const progress = (now - startedAt) / SPIN_DURATION_MS;
        const current = from + (to - from) * easeOutCubic(progress);
        if (bordersCrossed(previous, current, faces.length) > 0) tick();
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
