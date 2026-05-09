import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TimeScale } from './TimeScale';
import { GanttProvider } from './GanttProvider';
import { GanttTask } from '../types';

const makeTasks = (startIso: string, endIso: string): GanttTask[] => [
  {
    id: '1',
    name: 'Task 1',
    start: new Date(startIso),
    end: new Date(endIso),
  },
];

const wrapper = (tasks: GanttTask[], viewMode: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day') => {
  return ({ children }: { children: React.ReactNode }) => (
    <GanttProvider tasks={tasks} columns={[]} viewMode={viewMode}>
      {children}
    </GanttProvider>
  );
};

describe('TimeScale', () => {
  it('renders without crashing in day mode', () => {
    const tasks = makeTasks('2024-01-01T00:00:00Z', '2024-01-07T00:00:00Z');
    const { container } = render(<TimeScale />, { wrapper: wrapper(tasks, 'day') });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders day labels for a 7-day span', () => {
    const tasks = makeTasks('2024-01-01T00:00:00Z', '2024-01-07T00:00:00Z');
    render(<TimeScale />, { wrapper: wrapper(tasks, 'day') });
    // Expect at least one day label to appear (e.g. "1" or "Jan 1")
    const svgEl = document.querySelector('svg');
    expect(svgEl).not.toBeNull();
    // Must have some text elements
    const texts = svgEl!.querySelectorAll('text');
    expect(texts.length).toBeGreaterThan(0);
  });

  it('renders month labels in week mode', () => {
    const tasks = makeTasks('2024-01-01T00:00:00Z', '2024-02-28T00:00:00Z');
    render(<TimeScale />, { wrapper: wrapper(tasks, 'week') });
    const svgEl = document.querySelector('svg');
    expect(svgEl).not.toBeNull();
    // In week mode there should be month headers visible
    const texts = svgEl!.querySelectorAll('text');
    expect(texts.length).toBeGreaterThan(0);
  });
});
