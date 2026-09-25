import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { GanttBody } from '../src/components/GanttBody';
import { GanttChart } from '../src/components/GanttChart';
import { GanttProvider, useGanttContext } from '../src/components/GanttProvider';
import { GanttTask } from '../src/types';

const TASK_COUNT = 10_000;
const VIEWPORT_HEIGHT = 400;
const VIEWPORT_WIDTH = 800;
const SCROLL_TOPS = [0, 1_600, 6_400, 16_000, 32_000];

const tasks: GanttTask[] = Array.from({ length: TASK_COUNT }, (_, index) => {
  const start = new Date(Date.UTC(2024, 0, 1 + index));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    id: `task-${index}`,
    name: `Task ${index}`,
    start,
    end,
    progress: index % 101,
  };
});

const renderChart = () => render(
  <GanttChart
    tasks={tasks}
    autoSchedule={false}
    headless
    undoRedoEnabled={false}
  />
);

const setViewport = (element: HTMLElement) => {
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: VIEWPORT_HEIGHT });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: VIEWPORT_WIDTH });
};

const measure = (operation: () => void, iterations: number) => {
  const samples: number[] = [];
  for (let index = 0; index < iterations; index++) {
    const startedAt = performance.now();
    operation();
    samples.push(performance.now() - startedAt);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    iterations,
    minMs: sorted[0],
    medianMs: sorted[Math.floor(sorted.length / 2)],
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    maxMs: sorted[sorted.length - 1],
  };
};

describe(`GanttCraft ${TASK_COUNT.toLocaleString()} task benchmark`, () => {
  test('records initial render, scrolling, and task edit timings', () => {
    const initialRender = measure(() => {
      const result = renderChart();
      result.unmount();
    }, 1);

    const scrollResult = renderChart();
    const scrollSurface = scrollResult.container.querySelector('.gantt-chart-container > div') as HTMLElement | null;
    expect(scrollSurface).not.toBeNull();
    setViewport(scrollSurface!);
    const scrolling = measure(() => {
      for (const scrollTop of SCROLL_TOPS) {
        act(() => {
          scrollSurface!.scrollTop = scrollTop;
          fireEvent.scroll(scrollSurface!);
        });
      }
    }, 1);

    let updateTask: ((task: GanttTask) => void) | undefined;
    const EditProbe: React.FC = () => {
      updateTask = useGanttContext().updateTask;
      return null;
    };
    const editResult = render(
      <GanttProvider
        tasks={tasks}
        columns={[{ id: 'name', header: 'Name', accessor: task => task.name }]}
        autoSchedule={false}
        headless
        undoRedoEnabled={false}
      >
        <EditProbe />
        <GanttBody />
      </GanttProvider>
    );
    expect(updateTask).toBeDefined();
    const edit = measure(() => {
      const task = tasks[5_000];
      act(() => {
        updateTask!({ ...task, progress: (task.progress ?? 0) + 1 });
      });
    }, 1);

    console.log(JSON.stringify({
      taskCount: TASK_COUNT,
      environment: 'Vitest jsdom',
      initialRender,
      scrolling,
      edit,
    }, null, 2));

    scrollResult.unmount();
    editResult.unmount();
  }, 120_000);
});
