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

export interface Wheel {
  element: SVGSVGElement;
  /** Resolves when the wheel has stopped on the segment. */
  spin(segmentIndex: number): Promise<void>;
}

function pointAt(angle: number, radius: number): string {
  const radians = (angle * Math.PI) / 180;
  return `${String(radius * Math.sin(radians))} ${String(-radius * Math.cos(radians))}`;
}

function segmentStyle(segment: WheelSegment, index: number): { fill: string; text: string } {
  switch (segment.kind) {
    case 'bankrupt':
      return { fill: '#15151a', text: '#ffffff' };
    case 'pass':
      return { fill: '#f7f4ea', text: '#15151a' };
    case 'value':
      return { fill: VALUE_COLORS[index % VALUE_COLORS.length] ?? '#1f7ae0', text: '#ffffff' };
  }
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

function drawSegment(segment: WheelSegment, index: number, angle: number): SVGGElement {
  const style = segmentStyle(segment, index);
  const start = (index - 0.5) * angle;
  const end = (index + 0.5) * angle;
  const wedge = createSvgElement('path', {
    d: `M 0 0 L ${pointAt(start, RADIUS)} A ${String(RADIUS)} ${String(RADIUS)} 0 0 1 ${pointAt(end, RADIUS)} Z`,
    fill: style.fill,
  });
  const labels =
    segment.kind === 'value'
      ? stackedLabel(String(segment.amount), style.text)
      : [
          radialLabel(
            segment.kind === 'bankrupt' ? TV_TEXTS.wheel.bankrupt : TV_TEXTS.wheel.pass,
            style.text,
          ),
        ];
  const peg = createSvgElement('circle', {
    cx: PEG_RADIUS * Math.sin((start * Math.PI) / 180),
    cy: -PEG_RADIUS * Math.cos((start * Math.PI) / 180),
    r: 2.2,
    fill: 'url(#wheel-trim)',
  });
  return createSvgElement('g', {}, [
    wedge,
    createSvgElement('g', { transform: `rotate(${String(index * angle)})` }, labels),
    peg,
  ]);
}

function drawDefs(): SVGDefsElement {
  const stop = (offset: string, color: string, opacity = 1) =>
    // CSS variables only work in style, not in SVG presentation attributes.
    createSvgElement('stop', {
      offset,
      style: `stop-color: ${color}; stop-opacity: ${String(opacity)}`,
    });
  return createSvgElement('defs', {}, [
    createSvgElement('linearGradient', { id: 'wheel-trim', x1: 0, y1: 0, x2: 1, y2: 1 }, [
      stop('0%', TRIM.light),
      stop('45%', TRIM.main),
      stop('100%', TRIM.dark),
    ]),
    // One light-to-shadow overlay over every segment gives the wheel its relief.
    createSvgElement('radialGradient', { id: 'wheel-shade', cx: '45%', cy: '40%', r: '60%' }, [
      stop('0%', '#ffffff', 0.22),
      stop('55%', '#ffffff', 0),
      stop('100%', '#000000', 0.18),
    ]),
  ]);
}

function drawBulbs(count: number, angle: number): SVGGElement {
  return createSvgElement(
    'g',
    { class: 'wheel-bulbs' },
    Array.from({ length: count }, (_, i) =>
      createSvgElement('circle', {
        cx: RIM_RADIUS * Math.sin((i * angle * Math.PI) / 180),
        cy: -RIM_RADIUS * Math.cos((i * angle * Math.PI) / 180),
        r: 2.4,
        class: i % 2 === 0 ? 'bulb' : 'bulb bulb-alt',
      }),
    ),
  );
}

function drawPointer(): SVGGElement {
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
      fill: 'url(#wheel-trim)',
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

export function createWheel(segments: readonly WheelSegment[], onTick: () => void): Wheel {
  const angle = segmentAngle(segments.length);
  const rotor = createSvgElement('g', {}, [
    ...segments.map((segment, index) => drawSegment(segment, index, angle)),
    createSvgElement('circle', { r: RADIUS, fill: 'url(#wheel-shade)' }),
  ]);
  const pointer = drawPointer();
  const element = createSvgElement(
    'svg',
    {
      viewBox: '-112 -126 224 240',
      class: 'wheel',
    },
    [
      drawDefs(),
      createSvgElement('circle', {
        cx: 3,
        cy: 6,
        r: RIM_RADIUS + 6,
        fill: '#000000',
        opacity: 0.35,
      }),
      createSvgElement('circle', { r: RIM_RADIUS + 4, fill: 'url(#wheel-trim)' }),
      createSvgElement('circle', { r: RIM_RADIUS - 2, style: `fill: ${TRIM.shadow}` }),
      rotor,
      drawBulbs(segments.length, angle),
      createSvgElement('circle', {
        r: 17,
        fill: 'url(#wheel-trim)',
        style: `stroke: ${TRIM.deep}`,
        'stroke-width': 1.5,
      }),
      createSvgElement('circle', {
        r: 9,
        style: `fill: ${TRIM.main}; stroke: ${TRIM.light}`,
        'stroke-width': 1,
      }),
      pointer,
    ],
  );
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
      segmentCount: segments.length,
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
        if (bordersCrossed(previous, current, segments.length) > 0) tick();
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
