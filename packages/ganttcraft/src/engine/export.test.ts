import { expect, test, describe } from 'vitest';
import { exportCSV, exportJSON, importJSON } from './export';
import { GanttTask } from '../types';
import { exportJSON as publicExportJSON, importJSON as publicImportJSON } from '../index';

const parseCSV = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if (character === '\n' && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
};

describe('Export Engine', () => {
  const mockTasks: GanttTask[] = [
    { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-05'), progress: 50 },
    { id: '2', name: 'Task 2', start: new Date('2024-01-06'), end: new Date('2024-01-10'), progress: 100 }
  ];

  test('exportJSON returns valid JSON string', () => {
    const json = exportJSON(mockTasks);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Task 1');
  });

  test('public JSON export and import preserve task dates, dependencies, and baselines', () => {
    const tasks: GanttTask[] = [
      {
        id: '1',
        name: 'Plan',
        start: new Date('2024-01-01T09:00:00.000Z'),
        end: new Date('2024-01-05T17:00:00.000Z'),
        baselineStart: new Date('2024-01-01T08:00:00.000Z'),
        baselineEnd: new Date('2024-01-04T17:00:00.000Z'),
        constraintDate: new Date('2024-01-01T09:00:00.000Z'),
        dependencies: []
      },
      {
        id: '2',
        name: 'Build',
        start: new Date('2024-01-08T09:00:00.000Z'),
        end: new Date('2024-01-12T17:00:00.000Z'),
        baselineStart: new Date('2024-01-08T09:00:00.000Z'),
        baselineEnd: new Date('2024-01-11T17:00:00.000Z'),
        dependencies: [{ id: '1', type: 'FS', lag: 1 }]
      }
    ];

    const restored = publicImportJSON(publicExportJSON(tasks));
    expect(restored).toEqual(tasks);
    expect(restored[0].start).toBeInstanceOf(Date);
    expect(restored[1].dependencies).toEqual([{ id: '1', type: 'FS', lag: 1 }]);
  });

  test('importJSON reports malformed dates, duplicate IDs, and missing predecessors', () => {
    const validTask = {
      id: '1',
      name: 'Task',
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-02T00:00:00.000Z'
    };

    expect(() => importJSON(JSON.stringify([{ ...validTask, start: 'not-a-date' }]))).toThrow(
      'Task "1" has an invalid start'
    );
    expect(() => importJSON(JSON.stringify([{ ...validTask, baselineEnd: 'not-a-date' }]))).toThrow(
      'Task "1" has an invalid baselineEnd'
    );
    expect(() => importJSON(JSON.stringify([validTask, { ...validTask }]))).toThrow(
      'duplicate task ID "1"'
    );
    expect(() => importJSON(JSON.stringify([
      { ...validTask, id: '2', dependencies: [{ id: 'missing', type: 'FS' }] }
    ]))).toThrow('Task "2" references missing predecessor "missing"');
    expect(() => importJSON(JSON.stringify([
      { ...validTask, id: 'group', type: 'group', parentId: 'group' }
    ]))).toThrow('Task "group" has a cyclic parent hierarchy');
    expect(() => importJSON(JSON.stringify([
      { ...validTask, id: 'child', parentId: 'missing' }
    ]))).toThrow('Task "child" references missing parent "missing"');
  });

  test('exportCSV returns valid CSV string with headers', () => {
    const csv = exportCSV(mockTasks);
    expect(csv).toContain('ID,Name,Start,End,Progress');
    expect(csv).toContain('1,"Task 1",2024-01-01,2024-01-05,50');
  });

  test('exportCSV escapes separators, quotes, and newlines in every field', () => {
    const tasks: GanttTask[] = [
      {
        id: 'task,1',
        name: 'Task "quoted"\ncontinued',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
        progress: 50
      }
    ];

    expect(exportCSV(tasks)).toBe(
      'ID,Name,Start,End,Progress\n"task,1","Task ""quoted""\ncontinued",2024-01-01,2024-01-05,50'
    );
    expect(parseCSV(exportCSV(tasks))[1]).toEqual([
      'task,1', 'Task "quoted"\ncontinued', '2024-01-01', '2024-01-05', '50'
    ]);
  });

  test('exportCSV neutralises formula-like IDs and names', () => {
    const formulaPrefixes = ['=', '+', '-', '@', '＝', '＋', '－', '＠'];
    const tasks: GanttTask[] = formulaPrefixes.map((prefix, index) => ({
      id: `${prefix}id-${index}`,
      name: `${prefix}name-${index}`,
      start: new Date('2024-01-01'),
      end: new Date('2024-01-05'),
      progress: 50
    }));

    const rows = exportCSV(tasks).split('\n').slice(1);
    formulaPrefixes.forEach((prefix, index) => {
      expect(rows[index].startsWith(`"\t${prefix}id-${index}",`)).toBe(true);
      expect(rows[index]).toContain(`"\t${prefix}name-${index}"`);
    });

    const whitespacePrefixedTask: GanttTask = {
      id: '  +1+1',
      name: 'Task',
      start: new Date('2024-01-01'),
      end: new Date('2024-01-05'),
      progress: 50
    };
    expect(exportCSV([whitespacePrefixedTask])).toContain('"\t  +1+1"');
    expect(parseCSV(exportCSV(tasks)).slice(1).every(row => row.length === 5)).toBe(true);
  });
});

import { inlineCSSCustomProperties, flattenForeignObjects } from './export';

describe('exportPNG helpers (CR-3.C.1)', () => {
  test('inlineCSSCustomProperties resolves var() tokens in fill attribute', () => {
    // Create a mock SVG element with a CSS custom property
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'var(--gantt-task-fill, #3b82f6)');
    svg.appendChild(rect);

    inlineCSSCustomProperties(svg, { '--gantt-task-fill': '#0055ff' });

    expect(rect.getAttribute('fill')).toBe('#0055ff');
  });

  test('inlineCSSCustomProperties uses fallback when token not in map', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'var(--gantt-critical, #ef4444)');
    svg.appendChild(rect);

    inlineCSSCustomProperties(svg, {});

    // Should use the fallback value
    expect(rect.getAttribute('fill')).toBe('#ef4444');
  });

  test('flattenForeignObjects removes foreignObject elements', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    svg.appendChild(fo);
    svg.appendChild(rect);

    flattenForeignObjects(svg);

    expect(svg.querySelectorAll('foreignObject').length).toBe(0);
    expect(svg.querySelectorAll('rect').length).toBe(1);
  });

  test('snapshot: serialized SVG after preprocessing contains resolved hex, not var() (CR-3.C.2)', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;

    // Add a task rect with a CSS custom property fill
    const taskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    taskRect.setAttribute('fill', 'var(--gantt-task-fill, #3b82f6)');
    taskRect.setAttribute('width', '100');
    taskRect.setAttribute('height', '30');
    svg.appendChild(taskRect);

    // Add a critical path rect
    const criticalRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    criticalRect.setAttribute('fill', 'var(--gantt-critical, #ef4444)');
    criticalRect.setAttribute('width', '50');
    criticalRect.setAttribute('height', '30');
    svg.appendChild(criticalRect);

    // Add a foreignObject (simulating a custom renderer)
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('width', '100');
    fo.setAttribute('height', '30');
    svg.appendChild(fo);

    // Clone + preprocess (same pipeline as exportPNG uses)
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    flattenForeignObjects(cloned);
    inlineCSSCustomProperties(cloned, {
      '--gantt-task-fill': '#0055ff',
      '--gantt-critical': '#cc0000',
    });

    const serialized = new XMLSerializer().serializeToString(cloned);

    // Should have resolved values
    expect(serialized).toContain('#0055ff');
    expect(serialized).toContain('#cc0000');

    // Should NOT contain raw var() tokens
    expect(serialized).not.toContain('var(--gantt-task-fill');
    expect(serialized).not.toContain('var(--gantt-critical');

    // foreignObject should be stripped
    expect(serialized).not.toContain('foreignObject');
  });
});
