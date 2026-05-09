import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ResourcePanel } from './ResourcePanel';
import { GanttProvider } from '../GanttProvider';
import { GanttTask } from '../../types';

const MockResourcePanel: React.FC<{ onRender: () => void }> = ({ onRender }) => {
  onRender();
  return <ResourcePanel />;
};

// Mock wrapper using actual GanttProvider
const TestWrapper: React.FC<{ initialTasks: GanttTask[], onRenderResourcePanel: () => void }> = ({ initialTasks, onRenderResourcePanel }) => {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <GanttProvider 
      tasks={tasks}
      columns={[]}
      showResourcePanel={true}
    >
      <input 
        data-testid="task-name-input"
        value={tasks[0].name}
        onChange={(e) => {
          const newTasks = [...tasks];
          newTasks[0] = { ...newTasks[0], name: e.target.value };
          setTasks(newTasks);
        }}
      />
      <MockResourcePanel onRender={onRenderResourcePanel} />
    </GanttProvider>
  );
};

import * as resourceEngine from '../../engine/resource';

test('ResourcePanel does not re-render when a task name is typed (memoization works)', () => {
  const spyCalc = vi.spyOn(resourceEngine, 'calculateResourceUtilization');
  
  const initialTasks: GanttTask[] = [
    {
      id: '1',
      name: 'Initial Name',
      start: new Date('2024-01-02T00:00:00Z'),
      end: new Date('2024-01-05T00:00:00Z'),
      assignments: [{ resourceId: 'Dev', units: 1 }]
    }
  ];

  render(<TestWrapper initialTasks={initialTasks} onRenderResourcePanel={() => {}} />);

  const initialCallCount = spyCalc.mock.calls.length;
  expect(initialCallCount).toBeGreaterThan(0);

  // Reset spy count before interaction
  spyCalc.mockClear();

  // Type in the input
  const input = screen.getByTestId('task-name-input');
  fireEvent.change(input, { target: { value: 'New Name' } });
  
  // Assert name changed in the DOM
  expect((input as HTMLInputElement).value).toBe('New Name');

  // Assert calculateResourceUtilization was NOT called again
  expect(spyCalc).toHaveBeenCalledTimes(0);
});
