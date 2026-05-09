import { expect, test, describe } from 'vitest';
import { exportCSV, exportJSON } from './export';
import { GanttTask } from '../types';

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

  test('exportCSV returns valid CSV string with headers', () => {
    const csv = exportCSV(mockTasks);
    expect(csv).toContain('ID,Name,Start,End,Progress');
    expect(csv).toContain('1,"Task 1",2024-01-01,2024-01-05,50');
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
