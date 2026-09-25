import { DependencyType, GanttTask, TaskDependency } from '../types';

export const exportJSON = (tasks: GanttTask[]): string => {
  return JSON.stringify(tasks, null, 2);
};

type JSONRecord = Record<string, unknown>;

const isJSONRecord = (value: unknown): value is JSONRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseTaskDate = (
  value: unknown,
  taskId: string,
  field: string,
  required: boolean
): Date | undefined => {
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Task "${taskId}" is missing required date field "${field}".`);
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Task "${taskId}" has an invalid ${field}: expected an ISO date string.`);
  }

  const dateParts = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  const year = dateParts ? Number(dateParts[1]) : NaN;
  const month = dateParts ? Number(dateParts[2]) : NaN;
  const day = dateParts ? Number(dateParts[3]) : NaN;
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const hasValidCalendarDate =
    dateParts !== null &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day;
  const date = new Date(value);
  if (!hasValidCalendarDate || Number.isNaN(date.getTime())) {
    throw new Error(`Task "${taskId}" has an invalid ${field}: "${value}" is not a valid date.`);
  }

  return date;
};

const dependencyTypes: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];

const parseDependencies = (value: unknown, taskId: string): TaskDependency[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Task "${taskId}" has invalid dependencies: expected an array.`);
  }

  return value.map((dependency, index) => {
    if (!isJSONRecord(dependency) || typeof dependency.id !== 'string' || dependency.id.length === 0) {
      throw new Error(`Task "${taskId}" has an invalid dependency at index ${index}: predecessor id is required.`);
    }
    if (!dependencyTypes.includes(dependency.type as DependencyType)) {
      throw new Error(`Task "${taskId}" has an invalid dependency type at index ${index}. Expected FS, SS, FF, or SF.`);
    }
    if (dependency.lag !== undefined && (typeof dependency.lag !== 'number' || !Number.isFinite(dependency.lag))) {
      throw new Error(`Task "${taskId}" has an invalid dependency lag at index ${index}: expected a finite number.`);
    }

    return {
      ...dependency,
      id: dependency.id,
      type: dependency.type,
    } as TaskDependency;
  });
};

/**
 * Restores tasks from the JSON produced by `exportJSON`.
 *
 * Dates are revived for scheduling and baseline fields. The importer rejects
 * malformed project data before it reaches the scheduler, with the task and
 * field named in each error so callers can show a useful correction message.
 */
export const importJSON = (data: string): GanttTask[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error('Unable to import project JSON: invalid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Unable to import project JSON: expected an array of tasks.');
  }

  const ids = new Set<string>();
  const tasks = parsed.map((value, index) => {
    if (!isJSONRecord(value)) {
      throw new Error(`Unable to import task at index ${index}: expected an object.`);
    }

    if (typeof value.id !== 'string' || value.id.length === 0) {
      throw new Error(`Unable to import task at index ${index}: id must be a non-empty string.`);
    }
    if (ids.has(value.id)) {
      throw new Error(`Unable to import project JSON: duplicate task ID "${value.id}".`);
    }
    ids.add(value.id);

    if (typeof value.name !== 'string') {
      throw new Error(`Task "${value.id}" has an invalid name: expected a string.`);
    }

    const start = parseTaskDate(value.start, value.id, 'start', true)!;
    const end = parseTaskDate(value.end, value.id, 'end', true)!;
    const task = { ...value, id: value.id, name: value.name, start, end } as GanttTask;

    const baselineStart = parseTaskDate(value.baselineStart, value.id, 'baselineStart', false);
    const baselineEnd = parseTaskDate(value.baselineEnd, value.id, 'baselineEnd', false);
    const constraintDate = parseTaskDate(value.constraintDate, value.id, 'constraintDate', false);

    if (baselineStart) task.baselineStart = baselineStart;
    else delete task.baselineStart;
    if (baselineEnd) task.baselineEnd = baselineEnd;
    else delete task.baselineEnd;
    if (constraintDate) task.constraintDate = constraintDate;
    else delete task.constraintDate;

    const dependencies = parseDependencies(value.dependencies, value.id);
    if (dependencies) task.dependencies = dependencies;
    else delete task.dependencies;

    return task;
  });

  for (const task of tasks) {
    for (const dependency of task.dependencies ?? []) {
      if (!ids.has(dependency.id)) {
        throw new Error(`Task "${task.id}" references missing predecessor "${dependency.id}".`);
      }
    }
  }

  const byId = new Map(tasks.map(task => [task.id, task]));
  for (const task of tasks) {
    const visited = new Set<string>([task.id]);
    let parentId = task.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) {
        throw new Error(`Task "${task.id}" references missing parent "${parentId}".`);
      }
      if (visited.has(parentId)) {
        throw new Error(`Task "${task.id}" has a cyclic parent hierarchy.`);
      }
      visited.add(parentId);
      parentId = parent.parentId;
    }
  }

  return tasks;
};

/**
 * Escapes a value for one CSV field and neutralises spreadsheet formulas.
 *
 * A tab inside a quoted field prevents Excel from evaluating formula-like
 * values, including after the CSV is saved and reopened. The tab remains in
 * the data for programmatic CSV consumers.
 */
const escapeCSVField = (value: string | number, alwaysQuote = false): string => {
  let field = String(value);

  const formulaLike = /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(field);
  if (formulaLike) {
    field = `\t${field}`;
  }

  if (formulaLike || alwaysQuote || /[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
};

export const exportCSV = (tasks: GanttTask[]): string => {
  const headers = ['ID', 'Name', 'Start', 'End', 'Progress'];
  const rows = tasks.map(task => {
    return [
      escapeCSVField(task.id),
      escapeCSVField(task.name, true),
      escapeCSVField(task.start.toISOString().split('T')[0]),
      escapeCSVField(task.end.toISOString().split('T')[0]),
      escapeCSVField(task.progress ?? 0)
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
