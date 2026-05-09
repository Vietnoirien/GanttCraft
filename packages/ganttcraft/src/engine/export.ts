import { GanttTask } from '../types';

export const exportJSON = (tasks: GanttTask[]): string => {
  return JSON.stringify(tasks, null, 2);
};

export const exportCSV = (tasks: GanttTask[]): string => {
  const headers = ['ID', 'Name', 'Start', 'End', 'Progress'];
  const rows = tasks.map(task => {
    return [
      task.id,
      `"${task.name.replace(/"/g, '""')}"`,
      task.start.toISOString().split('T')[0],
      task.end.toISOString().split('T')[0],
      task.progress ?? 0
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

export const downloadBlob = (data: string, filename: string, mimeType: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Parses a `var(--token, fallback)` expression and returns the resolved value
 * from the provided token map, or the fallback if not found.
 */
const resolveVarToken = (value: string, tokenMap: Record<string, string>): string => {
  const varRegex = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g;
  return value.replace(varRegex, (_, token: string, fallback: string) => {
    return tokenMap[token] ?? fallback ?? '';
  });
};

/**
 * Walks all elements in the SVG clone and resolves any CSS custom property
 * (`var(--gantt-*)`) references in attributes to their concrete values.
 *
 * @param root   - Root SVG element (will be mutated in-place)
 * @param tokens - Map of `--token-name` → resolved value. Typically derived
 *                 from `getComputedStyle(document.documentElement)`.
 */
export const inlineCSSCustomProperties = (
  root: SVGElement,
  tokens: Record<string, string>
): void => {
  const SVG_ATTRS_WITH_VARS = ['fill', 'stroke', 'color', 'style', 'opacity', 'stop-color'];
  const allElements = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const el of allElements) {
    for (const attr of SVG_ATTRS_WITH_VARS) {
      const value = el.getAttribute(attr);
      if (value && value.includes('var(')) {
        el.setAttribute(attr, resolveVarToken(value, tokens));
      }
    }
  }
};

/**
 * Removes all `<foreignObject>` elements from the SVG clone.
 * These contain HTML and cannot be serialised/rasterised safely in all browsers.
 */
export const flattenForeignObjects = (root: SVGElement): void => {
  const foreignObjects = Array.from(root.querySelectorAll('foreignObject'));
  for (const fo of foreignObjects) {
    fo.parentNode?.removeChild(fo);
  }
};

/**
 * Collects all known Gantt CSS custom properties from the document's
 * computed style and returns them as a plain map.
 */
const collectGanttTokens = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const style = getComputedStyle(document.documentElement);
  const knownTokens = [
    '--gantt-bg', '--gantt-bg-surface', '--gantt-bg-hover',
    '--gantt-border-color', '--gantt-text-primary', '--gantt-text-danger',
    '--gantt-task-fill', '--gantt-critical', '--gantt-baseline',
    '--gantt-group-fill', '--gantt-border',
  ];
  const tokens: Record<string, string> = {};
  for (const token of knownTokens) {
    const value = style.getPropertyValue(token).trim();
    if (value) tokens[token] = value;
  }
  return tokens;
};

export const exportPNG = async (svgElement: SVGSVGElement, filename: string = 'gantt.png') => {
  if (typeof window === 'undefined') return;

  // 1. Clone the SVG to avoid mutating the live DOM
  const cloned = svgElement.cloneNode(true) as SVGSVGElement;

  // 2. Flatten foreignObject elements so they don't break serialisation
  flattenForeignObjects(cloned);

  // 3. Inline CSS custom property values
  const tokens = collectGanttTokens();
  inlineCSSCustomProperties(cloned, tokens);

  const svgData = new XMLSerializer().serializeToString(cloned);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 4. Set dimensions based on SVG intrinsic size
  const width = svgElement.width.baseVal.value || 1000;
  const height = svgElement.height.baseVal.value || 500;
  canvas.width = width;
  canvas.height = height;

  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = window.URL.createObjectURL(svgBlob);

  return new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      window.URL.revokeObjectURL(url);
      const pngData = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngData;
      a.download = filename;
      a.click();
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
};
