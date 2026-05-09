import { GanttTheme } from '../types';

export { defaultTheme } from './default';
export { darkTheme } from './dark';

/**
 * Injects a GanttTheme into an HTMLElement's inline style as CSS custom properties.
 *
 * Scoping injection to the component's own root element (instead of
 * document.documentElement) ensures multiple GanttChart instances on the same
 * page each carry their own theme, with no cross-instance pollution.
 *
 * @param element - The root element to inject properties into
 * @param theme   - Theme token map to apply
 */
export function injectTheme(element: HTMLElement, theme: GanttTheme): void {
  for (const [property, value] of Object.entries(theme)) {
    element.style.setProperty(property, value);
  }
}
