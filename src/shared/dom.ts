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
