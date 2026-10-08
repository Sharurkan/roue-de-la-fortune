import qrcode from 'qrcode-generator';
import { createSvgElement } from '../shared/dom';

const QUIET_ZONE = 4;

/** Draws a QR code as one SVG path: one small square per dark module. */
export function createQrCode(text: string): SVGSVGElement {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const count = code.getModuleCount();
  const squares: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      if (code.isDark(row, column)) {
        squares.push(`M${String(column + QUIET_ZONE)} ${String(row + QUIET_ZONE)}h1v1h-1z`);
      }
    }
  }
  const size = count + QUIET_ZONE * 2;
  return createSvgElement('svg', { viewBox: `0 0 ${String(size)} ${String(size)}`, class: 'qr' }, [
    createSvgElement('rect', { width: size, height: size, fill: '#ffffff' }),
    createSvgElement('path', { d: squares.join(''), fill: '#000000' }),
  ]);
}
