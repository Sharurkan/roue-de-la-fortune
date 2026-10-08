export interface ElementOptions {
  className?: string;
  text?: string;
}

/** Creates an element with plain text only: never use innerHTML with variable content. */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.className !== undefined) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  element.append(...children);
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an SVG element. Attribute values are set one by one, never parsed as markup. */
export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  children: Node[] = [],
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  element.append(...children);
  return element;
}
