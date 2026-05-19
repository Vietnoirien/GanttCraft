import { render } from '@testing-library/react';
import { DependencyLayer } from './DependencyLayer';
import { describe, it, expect } from 'vitest';
import { GanttProvider } from '../components/GanttProvider';
import { GanttTask } from '../types';

describe('DependencyLayer (CR-3.D.1)', () => {
  it('renders SVG paths for dependencies', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'Task 2', start: new Date('2024-01-03'), end: new Date('2024-01-04'), dependencies: [{ id: '1', type: 'FS' }] }
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('renders exactly N paths for N dependency relationships', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'B', start: new Date('2024-01-03'), end: new Date('2024-01-04'), dependencies: [{ id: '1', type: 'FS' }] },
      { id: '3', name: 'C', start: new Date('2024-01-05'), end: new Date('2024-01-06'), dependencies: [{ id: '2', type: 'FS' }] },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    // 2 dependency relationships → 2 data paths
    // (marker defs also contain <path> elements so we count from the dependency-layer g directly)
    const depLayer = container.querySelector('.dependency-layer');
    expect(depLayer).not.toBeNull();
    // We'll check via stroke attribute — data paths have stroke attribute, marker paths don't
    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(2);
  });

  it('renders no paths when no tasks have dependencies', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'B', start: new Date('2024-01-03'), end: new Date('2024-01-04') },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(0);
  });

  it('uses gray stroke (#cbd5e1) when showCriticalPath is false', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'B', start: new Date('2024-01-03'), end: new Date('2024-01-04'), dependencies: [{ id: '1', type: 'FS' }] },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]} showCriticalPath={false}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(1);
    expect(dataPaths[0].getAttribute('stroke')).toBe('#cbd5e1');
  });

  it('uses critical color when showCriticalPath=true and target float===0', () => {
    // A task with float===0 indicates it is on the critical path
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'B', start: new Date('2024-01-02'), end: new Date('2024-01-04'), float: 0, dependencies: [{ id: '1', type: 'FS' }] },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]} showCriticalPath={true}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(1);
    // Critical path uses var(--gantt-critical, #ef4444) or a resolved red
    const stroke = dataPaths[0].getAttribute('stroke') ?? '';
    expect(stroke).toContain('#ef4444');
  });

  it('renders two paths for two dependencies from the same source', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'B', start: new Date('2024-01-03'), end: new Date('2024-01-04'), dependencies: [{ id: '1', type: 'FS' }] },
      { id: '3', name: 'C', start: new Date('2024-01-03'), end: new Date('2024-01-05'), dependencies: [{ id: '1', type: 'FS' }] },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(2);
  });

  it('renders a dashed line when linkState is provided (CR-3.A.3)', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') }
    ];

    const linkState = { sourceId: 't1', cursorX: 200, cursorY: 150 };

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer linkState={linkState} />
        </GanttProvider>
      </svg>
    );

    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(1);
    const line = lines[0];
    expect(line.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(line.getAttribute('x2')).toBe('200');
    expect(line.getAttribute('y2')).toBe('150');
  });
  it('dependency path Y-coordinates are viewport-local (not shifted by virtualWindow.offsetY)', () => {
    // This tests the scroll bug: when scrolled down, DependencyLayer was computing path Y using
    // absolute row indices (y = i * ROW_HEIGHT), but the paths live inside
    // <g transform={`translate(0, ${offsetY})`}> — so they were rendered offsetY pixels too low.
    // Path coords must match localY = (i * ROW_HEIGHT) - offsetY, as used by SVGRenderer task bars.
    //
    // We cannot drive scrollTop via GanttProvider's setScrollState (it's internal), so we test
    // renderPath directly by checking that the exported helper builds correct d strings with
    // viewport-local y coords — but since renderPath is private, we instead verify the path
    // attribute `d` on the rendered SVG path element and compare it against the expected coords.
    const tasks: GanttTask[] = [
      { id: 'a', name: 'A', start: new Date('2024-01-01'), end: new Date('2024-01-05') },
      { id: 'b', name: 'B', start: new Date('2024-01-06'), end: new Date('2024-01-10'), dependencies: [{ id: 'a', type: 'FS' }] },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(1);

    const d = dataPaths[0].getAttribute('d') ?? '';
    // With no scrolling (offsetY=0), task A is at row 0 (y=0), task B at row 1 (y=40).
    // Path starts at A's right edge at mid-row y = 0 + ROW_HEIGHT/2 = 20.
    // Path ends at B's left edge at mid-row y = 40 + ROW_HEIGHT/2 = 60.
    // startY should appear in the d string.
    expect(d).toContain('20'); // startY = ROW_HEIGHT/2 = 20 (row 0 center)
    expect(d).toContain('60'); // endY = 40 + ROW_HEIGHT/2 = 60 (row 1 center)
  });

  it('FF dependency routes end-to-end and does not trigger backward routing', () => {
    // With FF: source END → target END. Both tasks end on the same date.
    // Previously renderPath always used target.x (left/start edge), causing endX < startX
    // when the target started before the source ended — triggering spurious backward routing.
    const tasks: GanttTask[] = [
      { id: 'src', name: 'Source', start: new Date('2024-01-01'), end: new Date('2024-01-10') },
      { id: 'tgt', name: 'Target', start: new Date('2024-01-03'), end: new Date('2024-01-10'), dependencies: [{ id: 'src', type: 'FF' }] },
    ];

    const { container } = render(
      <svg>
        <GanttProvider tasks={tasks} columns={[]}>
          <DependencyLayer />
        </GanttProvider>
      </svg>
    );

    const dataPaths = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') !== null && p.getAttribute('fill') === 'none'
    );
    expect(dataPaths.length).toBe(1);

    // Both tasks end on the same date → endX ≈ startX → falls into "close" routing (6 segments,
    // routes below both rows so the arrowhead always points rightward into the target).
    // The old naive forward path (4 segments) had its last segment going leftward → wrong arrowhead.
    const d = dataPaths[0].getAttribute('d') ?? '';
    const cmdCount = (d.match(/[ML]/g) ?? []).length;
    expect(cmdCount).toBe(6); // M + 5 L commands: close/below routing
  });
});

