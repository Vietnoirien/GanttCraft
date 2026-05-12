import { render, act } from '@testing-library/react';
import { GanttProvider, useGanttContext } from '../GanttProvider';
import { describe, it, expect } from 'vitest';
import { GanttTask } from '../../types';

describe('Gantt Task Hierarchy & Collapse', () => {
  it('exposes toggleGroup and visibleTasks, and filters collapsed children', () => {
    let contextValue: any;
    
    const TestConsumer = () => {
      contextValue = useGanttContext();
      return null;
    };

    const tasks: GanttTask[] = [
      { id: '1', name: 'Parent', type: 'group', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'Child 1', parentId: '1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '3', name: 'Child 2', parentId: '1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '4', name: 'Standalone', start: new Date('2024-01-01'), end: new Date('2024-01-02') }
    ];

    render(
      <GanttProvider tasks={tasks} columns={[]}>
        <TestConsumer />
      </GanttProvider>
    );

    expect(contextValue.toggleGroup).toBeDefined();
    expect(contextValue.visibleTasks).toBeDefined();

    // Initially all 4 should be visible
    expect(contextValue.visibleTasks.length).toBe(4);

    // Collapse parent 1
    act(() => {
      contextValue.toggleGroup('1');
    });

    // Children 2 and 3 should be hidden, Parent 1 and Standalone 4 remain
    expect(contextValue.visibleTasks.length).toBe(2);
    expect(contextValue.visibleTasks.some((t: GanttTask) => t.id === '2')).toBe(false);

    // Expand parent 1
    act(() => {
      contextValue.toggleGroup('1');
    });

    expect(contextValue.visibleTasks.length).toBe(4);
  });
});
