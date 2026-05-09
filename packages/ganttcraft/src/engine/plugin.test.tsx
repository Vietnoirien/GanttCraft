import { expect, test, describe } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { GanttProvider, useGanttContext } from '../components/GanttProvider';
import { GanttTask } from '../types';
import { GanttPlugin } from './plugin';

const TestComponent = ({ onUpdate }: { onUpdate: (task: GanttTask) => void }) => {
  const { updateTask } = useGanttContext();
  
  React.useEffect(() => {
    // Just assigning to satisfy TS, though we pass an empty func
    onUpdate({ id: 'dummy', name: 'dummy', start: new Date(), end: new Date() });
  }, [onUpdate]);

  return <button onClick={() => updateTask({ id: '1', name: 'Updated', start: new Date(), end: new Date() })}>Update</button>;
};

describe('Plugin Architecture', () => {
  test('beforeUpdateTask plugin hook can cancel mutation', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Original', start: new Date('2024-01-01'), end: new Date('2024-01-05') }
    ];

    const mockPlugin: GanttPlugin = {
      name: 'TestBlocker',
      beforeUpdateTask: () => {
        // Block all updates
        return false;
      }
    };

    let contextTasks: GanttTask[] = [];

    const ContextReader = () => {
      const { tasks } = useGanttContext();
      contextTasks = tasks;
      return null;
    };

    const { getByText } = render(
      <GanttProvider tasks={tasks} columns={[]} plugins={[mockPlugin]}>
        <ContextReader />
        <TestComponent onUpdate={() => {}} />
      </GanttProvider>
    );

    act(() => {
      getByText('Update').click();
    });

    // The update should have been cancelled by the plugin
    expect(contextTasks[0].name).toBe('Original');
  });
});
