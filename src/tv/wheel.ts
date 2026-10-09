import type { WheelSegment } from '../game/config';
import { createSvgElement } from '../shared/dom';
import { TV_TEXTS } from './texts';
import { bordersCrossed, easeOutCubic, segmentAngle } from './wheel-math';

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
/** A stronger spin goes further, and lasts longer. */
const SPIN_BASE_MS = 2000;
const SPIN_MS_PER_TURN = 1250;
/** Rich jewel tones: lively without being neon. Two neighbours never share a colour. */
const VALUE_COLORS = [
  '#e3122c',
  '#ff6b1a',
  '#f5b700',
  '#006400',
  '#1c7ce0',
  '#6f3ad6',
  '#e8247c',
  '#0fa3a8',
];
const DIGIT_STEP = 12.5;
const GOLD = '#ffd23f';
const JACKPOT_FILL = GOLD;
const POCKET_BLUE = '#1f5fbf';
const POCKET_RED = '#d7263d';
/** White letters on white: only their dark mauve outline draws them. */
const DIVIDE_OUTLINE = '#3d1458';
const FIRST_DIGIT_RADIUS = 82;
/** Stacked words stop before the hub. */
const LAST_LETTER_RADIUS = 22;
/** Long words start closer to the rim, to keep their letters as big as possible. */
const LONG_WORD_START = 88;
const LONG_WORD_LENGTH = 7;
/** Words stay a little smaller than the digits. */
const WORD_MAX_SIZE = 11;
const WORD_MAX_STEP = 10;
const EURO_SCALE = 0.65;
/** Below the small caption of a segment. */
const CAPTION_TEXT_START = 76;

/** What one segment of a wheel looks like. */
export interface WheelFace {
  fill: string;
  ink: string;
  label:
    /** leadInk colours the first character differently (the mystery's "?"). */
    | { kind: 'digits'; text: string; leadInk?: string }
    | { kind: 'word'; text: string; size?: number }
    | { kind: 'envelope' }
    /** Small caption near the rim, then a bigger word along the radius. */
    | { kind: 'caption'; caption: string; captionInk: string; text: string };
  /** Outline of the label letters, black by default. */
  outline?: string;
  /** Segment cut in two along its length, with a colour on each side. */
  halves?: { left: string; right: string };
  /** Narrow slices on both edges of the segment (the jackpot's bankrupts), as a share of it. */
  sides?: { fill: string; ink: string; text: string; share: number };
}

export interface Wheel {
  element: SVGSVGElement;
  /** Puts the wheel at this position, in segments, without animation. */
  place(position: number): void;
  /** Turns from a position by a travel, both in segments. Resolves once stopped. */
  spin(from: number, travel: number): Promise<void>;
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
          ink: POCKET_RED,
          label: { kind: 'word', text: TV_TEXTS.wheel.pass },
        };
      case 'value':
        return {
          fill: VALUE_COLORS[index % VALUE_COLORS.length] ?? '#2e86de',
          ink: '#ffffff',
          label: { kind: 'digits', text: String(segment.amount) },
        };
      case 'pocket':
        return {
          fill: POCKET_BLUE,
          ink: GOLD,
          halves: { left: POCKET_BLUE, right: POCKET_RED },
          label: {
            kind: 'caption',
            caption: TV_TEXTS.wheel.pocketCaption,
            captionInk: GOLD,
            text: TV_TEXTS.wheel.pocket,
          },
        };
      case 'mystery':
        return {
          fill: POCKET_BLUE,
          ink: '#ffffff',
          label: { kind: 'digits', text: `?${String(segment.amount)}€`, leadInk: GOLD },
        };
      case 'swap':
        return {
          fill: '#15151a',
          ink: GOLD,
          label: { kind: 'word', text: TV_TEXTS.wheel.swap, size: 8 },
        };
      case 'divide':
        return {
          fill: '#ffffff',
          ink: '#ffffff',
          outline: DIVIDE_OUTLINE,
          label: { kind: 'word', text: TV_TEXTS.wheel.divide, size: 7 },
        };
      case 'jackpot':
        return {
          fill: JACKPOT_FILL,
          ink: '#ffffff',
          label: { kind: 'word', text: String(segment.amount), size: 8 },
          sides: { fill: '#15151a', ink: '#ffffff', text: TV_TEXTS.wheel.bankrupt, share: 0.25 },
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

interface StackLayout {
  /** Distance from the hub to the first character. */
  start: number;
  step: number;
  size: number;
}

const DIGIT_LAYOUT: StackLayout = { start: FIRST_DIGIT_RADIUS, step: DIGIT_STEP, size: 15 };

/** Long words shrink so that they fit between their start and the hub. */
function wordLayout(length: number, start = FIRST_DIGIT_RADIUS, size?: number): StackLayout {
  if (size !== undefined) return { start, step: size * 1.1, size };
  const step = Math.min(WORD_MAX_STEP, (start - LAST_LETTER_RADIUS) / Math.max(length - 1, 1));
  return { start, step, size: Math.min(WORD_MAX_SIZE, step * 1.2) };
}

/**
 * Small letters get a thinner outline, so that they do not blur. A coloured
 * outline is thicker: it draws the letters on a background of their own colour.
 */
function outlineStyle(size: number, outline: string | undefined): string {
  if (outline === undefined) return `stroke-width: ${String(Math.min(1.6, size * 0.1))}px`;
  return `stroke-width: ${String(size * 0.3)}px; stroke: ${outline}`;
}

/** Characters written like on TV: one under the other, from the rim inwards, upright. */
function stackedLabel(
  text: string,
  color: string,
  layout: StackLayout = DIGIT_LAYOUT,
  leadInk = color,
  outline?: string,
): SVGTextElement[] {
  return Array.from(text, (char, i) => {
    // The euro sign reads as a unit, not a digit: it is drawn smaller.
    const size = char === '€' ? layout.size * EURO_SCALE : layout.size;
    const digit = createSvgElement('text', {
      y: -(layout.start - i * layout.step),
      fill: i === 0 ? leadInk : color,
      class: 'wheel-digit',
      // The stylesheet sets the digit size; smaller words override it.
      style: `font-size: ${String(size)}px; ${outlineStyle(size, outline)}`,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    digit.textContent = char;
    return digit;
  });
}

/** Long words do not fit stacked: they run along the radius instead. */
/** Along the radius: only for the tiny bankrupt slices of the jackpot, too narrow to stack. */
function radialLabel(text: string, color: string, size: number): SVGTextElement {
  const label = createSvgElement('text', {
    transform: 'translate(0 -56) rotate(-90)',
    fill: color,
    class: 'wheel-word',
    'font-size': size,
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
      return stackedLabel(face.label.text, face.ink, DIGIT_LAYOUT, face.label.leadInk);
    case 'word':
      return stackedLabel(
        face.label.text,
        face.ink,
        wordLayout(
          face.label.text.length,
          face.label.text.length >= LONG_WORD_LENGTH ? LONG_WORD_START : FIRST_DIGIT_RADIUS,
          face.label.size,
        ),
        face.ink,
        face.outline,
      );
    case 'envelope':
      return [envelopeIcon()];
    case 'caption':
      return captionLabel(face.label.caption, face.label.captionInk, face.label.text, face.ink);
  }
}

function captionLabel(
  caption: string,
  captionInk: string,
  text: string,
  ink: string,
): SVGElement[] {
  const small = createSvgElement('text', {
    y: -84,
    fill: captionInk,
    class: 'wheel-word',
    style: 'stroke-width: 0.3px',
    'font-size': 3,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  });
  small.textContent = caption;
  return [small, ...stackedLabel(text, ink, wordLayout(text.length, CAPTION_TEXT_START))];
}

function halfWedges(face: WheelFace, start: number, end: number): SVGElement[] {
  if (face.halves === undefined) return [];
  const middle = (start + end) / 2;
  return [wedge(start, middle, face.halves.left), wedge(middle, end, face.halves.right)];
}

function wedge(start: number, end: number, fill: string): SVGPathElement {
  return createSvgElement('path', {
    d: `M 0 0 L ${pointAt(start, RADIUS)} A ${String(RADIUS)} ${String(RADIUS)} 0 0 1 ${pointAt(end, RADIUS)} Z`,
    fill,
    // A very thin black line between segments.
    stroke: '#000000',
    'stroke-width': 0.35,
  });
}

function peg(angle: number, trim: string): SVGCircleElement {
  return createSvgElement('circle', {
    cx: PEG_RADIUS * Math.sin((angle * Math.PI) / 180),
    cy: -PEG_RADIUS * Math.cos((angle * Math.PI) / 180),
    r: 2.2,
    fill: trim,
  });
}

const SIDE_LABEL_SIZE = 3.4;

/** Where the narrow side slices of a segment end, if it has any. */
function sideBorders(face: WheelFace, start: number, end: number): [number, number] | null {
  if (face.sides === undefined) return null;
  const width = (end - start) * face.sides.share;
  return [start + width, end - width];
}

function sideLabel(sides: NonNullable<WheelFace['sides']>, angle: number): SVGGElement {
  const text = radialLabel(sides.text, sides.ink, SIDE_LABEL_SIZE);
  // The usual outline would blur such small letters.
  text.style.strokeWidth = '0.3px';
  return createSvgElement('g', { transform: `rotate(${String(angle)})` }, [text]);
}

/** Colours of a segment, drawn under the shading. */
function segmentBackground(face: WheelFace, index: number, angle: number): SVGGElement {
  const start = (index - 0.5) * angle;
  const end = (index + 0.5) * angle;
  const borders = sideBorders(face, start, end);
  const sides = face.sides;
  return createSvgElement('g', {}, [
    wedge(start, end, face.fill),
    ...halfWedges(face, start, end),
    ...(borders === null || sides === undefined
      ? []
      : [wedge(start, borders[0], sides.fill), wedge(borders[1], end, sides.fill)]),
  ]);
}

/**
 * Light on one edge of the segment, shadow on the other. Drawn upright then
 * rotated, so that one gradient serves every segment.
 */
function sheen(index: number, angle: number, sheenId: string): SVGGElement {
  const overlay = wedge(-angle / 2, angle / 2, `url(#${sheenId})`);
  overlay.setAttribute('stroke', 'none');
  return createSvgElement('g', { transform: `rotate(${String(index * angle)})` }, [overlay]);
}

/** Labels and pegs of a segment, drawn over the shading so that they stay crisp. */
function segmentForeground(
  face: WheelFace,
  index: number,
  angle: number,
  trim: string,
): SVGGElement {
  const start = (index - 0.5) * angle;
  const end = (index + 0.5) * angle;
  const borders = sideBorders(face, start, end);
  const sides = face.sides;
  return createSvgElement('g', {}, [
    createSvgElement('g', { transform: `rotate(${String(index * angle)})` }, faceLabel(face)),
    ...(borders === null || sides === undefined
      ? []
      : [
          sideLabel(sides, (start + borders[0]) / 2),
          sideLabel(sides, (borders[1] + end) / 2),
          peg(borders[0], trim),
          peg(borders[1], trim),
        ]),
    peg(start, trim),
  ]);
}

let wheelCount = 0;

/** Gradient ids must be unique in the page, and the TV shows two wheels. */
interface GradientIds {
  trim: string;
  shade: string;
  depth: string;
  sheen: string;
}

function gradientIds(): GradientIds {
  wheelCount += 1;
  const id = (name: string) => `wheel-${name}-${String(wheelCount)}`;
  return { trim: id('trim'), shade: id('shade'), depth: id('depth'), sheen: id('sheen') };
}

function drawDefs(ids: GradientIds): SVGDefsElement {
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
    createSvgElement('radialGradient', { id: ids.shade, cx: '40%', cy: '30%', r: '70%' }, [
      stop('0%', '#ffffff', 0.12),
      stop('45%', '#ffffff', 0),
      stop('100%', '#000000', 0.22),
    ]),
    // Across one segment: shaded edges and a slightly raised middle (see sheen()).
    createSvgElement(
      'linearGradient',
      { id: ids.sheen, gradientUnits: 'userSpaceOnUse', x1: -12, y1: 0, x2: 12, y2: 0 },
      [
        stop('0%', '#000000', 0.32),
        stop('22%', '#000000', 0.1),
        stop('50%', '#ffffff', 0.1),
        stop('78%', '#000000', 0.1),
        stop('100%', '#000000', 0.32),
      ],
    ),
    // Along each segment: dark near the hub, full colour towards the rim, a bevel at the edge.
    createSvgElement('radialGradient', { id: ids.depth, cx: '50%', cy: '50%', r: '50%' }, [
      stop('0%', '#000000', 0.55),
      stop('40%', '#000000', 0.25),
      stop('78%', '#000000', 0),
      stop('94%', '#000000', 0.05),
      stop('100%', '#000000', 0.3),
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
    ...faces.map((face, index) => segmentBackground(face, index, angle)),
    ...faces.map((_, index) => sheen(index, angle, ids.sheen)),
    createSvgElement('circle', { r: RADIUS, fill: `url(#${ids.depth})` }),
    createSvgElement('circle', { r: RADIUS, fill: `url(#${ids.shade})` }),
    ...faces.map((face, index) => segmentForeground(face, index, angle, trim)),
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

  function place(position: number): void {
    // Segment i is drawn at i × angle: the pointer reads it at the opposite rotation.
    rotation = -position * angle;
    show(rotation);
  }

  function spin(fromPosition: number, travel: number): Promise<void> {
    place(fromPosition);
    const from = rotation;
    const to = from + travel * angle;
    const duration = SPIN_BASE_MS + (travel / faces.length) * SPIN_MS_PER_TURN;
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
        const progress = (now - startedAt) / duration;
        const current = from + (to - from) * easeOutCubic(progress);
        if (bordersCrossed(previous, current, faces.length) > 0) tick();
        previous = current;
        show(current);
        if (progress >= 1) finish();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      // Animation frames pause when the page is hidden: the game must not get stuck.
      setTimeout(finish, duration + 1000);
    });
  }

  show(rotation);
  return { element, place, spin };
}
