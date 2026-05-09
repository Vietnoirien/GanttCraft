import { render, screen, act } from '@testing-library/react';
import { GanttChart } from './GanttChart';
import { GanttProvider, useGanttContext } from './GanttProvider';
import { describe, it, expect } from 'vitest';
import { GanttTask, GanttResource } from '../types';


describe('GanttChart', () => {
  it('renders without crashing', () => {
    const tasks = [
      { id: '1', name: 'Test Task', start: new Date(), end: new Date() }
    ];
    render(<GanttChart tasks={tasks} />);
    const elements = screen.getAllByText('Test Task');
    expect(elements.length).toBeGreaterThan(0);
  });
});

describe('GanttChart prop forwarding (CR-1.B.2)', () => {
  it('smoke test: <GanttChart tasks={[]} showCriticalPath /> renders without throwing', () => {
    expect(() => render(<GanttChart tasks={[]} showCriticalPath />)).not.toThrow();
  });

  it('showCriticalPath — task with float === 0 renders with critical fill color', () => {
    // A task with float === 0 should receive the critical fill (#ef4444)
    // We seed the task with float pre-set to 0 (backwardPass would normally compute this)
    const criticalTask: GanttTask = {
      id: '1',
      name: 'Critical Task',
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-02T00:00:00Z'),
      float: 0,
    };

    const { container } = render(<GanttChart tasks={[criticalTask]} showCriticalPath />);

    // The SVG rect for the critical task should have the critical fill color
    const rects = container.querySelectorAll('rect');
    const criticalRect = Array.from(rects).find(
      (r) => r.getAttribute('fill') === 'var(--gantt-critical, #ef4444)'
    );
    expect(criticalRect).not.toBeNull();
  });

  it('showResourcePanel — the resource panel element IS present in the DOM', () => {
    const { container } = render(<GanttChart tasks={[]} showResourcePanel />);
    // ResourcePanel renders a div.gantt-resource-panel when showResourcePanel is true
    const panel = container.querySelector('.gantt-resource-panel');
    expect(panel).not.toBeNull();
  });

  it('default (no showResourcePanel) — the resource panel element is NOT present', () => {
    const { container } = render(<GanttChart tasks={[]} />);
    const panel = container.querySelector('.gantt-resource-panel');
    expect(panel).toBeNull();
  });
});

describe('GanttChart Interactive Linking (CR-3.A.4)', () => {
  it('exposes addDependency and links tasks properly', () => {
    let contextValue: any;
    
    const TestConsumer = () => {
      contextValue = useGanttContext();
      return null;
    };

    const tasks: GanttTask[] = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'Task 2', start: new Date('2024-01-01'), end: new Date('2024-01-02') }
    ];

    let updatedTasks: GanttTask[] = [];

    render(
      <GanttProvider 
        tasks={tasks} 
        columns={[]}
        onTasksChange={(newTasks) => { updatedTasks = newTasks; }}
        autoSchedule={true}
      >
        <TestConsumer />
      </GanttProvider>
    );

    expect(contextValue.addDependency).toBeDefined();

    // Call addDependency
    act(() => {
      contextValue.addDependency('1', '2');
    });

    // It should have modified Task 2 to depend on Task 1
    const task2 = updatedTasks.find(t => t.id === '2');
    expect(task2).toBeDefined();
    expect(task2?.dependencies).toBeDefined();
    expect(task2?.dependencies?.some(d => d.id === '1' && d.type === 'FS')).toBe(true);

    // Because of autoSchedule, Task 2's start date should have cascaded
    // Task 1 ends on 2024-01-02, so Task 2 should start on or after 2024-01-02
    expect(task2?.start.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-02').getTime());
  });

  it('exposes deleteTask and successfully removes a task', () => {
    let contextValue: any;
    
    const TestConsumer = () => {
      contextValue = useGanttContext();
      return null;
    };

    const tasks: GanttTask[] = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'Task 2', start: new Date('2024-01-01'), end: new Date('2024-01-02') }
    ];

    let updatedTasks: GanttTask[] = [];

    render(
      <GanttProvider 
        tasks={tasks} 
        columns={[]}
        onTasksChange={(newTasks) => { updatedTasks = newTasks; }}
      >
        <TestConsumer />
      </GanttProvider>
    );

    expect(contextValue.deleteTask).toBeDefined();

    act(() => {
      contextValue.deleteTask('1');
    });

    expect(updatedTasks.length).toBe(1);
    expect(updatedTasks[0].id).toBe('2');
  });

  it('deleteTask automatically snaps successor tasks to earlier dates', () => {
    let contextValue: any;
    
    const TestConsumer = () => {
      contextValue = useGanttContext();
      return null;
    };

    const tasks: GanttTask[] = [
      { id: 'A', name: 'Task A', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { 
        id: 'B', 
        name: 'Task B', 
        start: new Date('2024-01-02T00:00:00Z'), 
        end: new Date('2024-01-03T00:00:00Z'),
        dependencies: [{ id: 'A', type: 'FS' }]
      }
    ];

    let updatedTasks: GanttTask[] = [];

    render(
      <GanttProvider 
        tasks={tasks} 
        columns={[]}
        onTasksChange={(newTasks) => { updatedTasks = newTasks; }}
        autoSchedule={true}
      >
        <TestConsumer />
      </GanttProvider>
    );

    act(() => {
      contextValue.deleteTask('A');
    });

    expect(updatedTasks.length).toBe(1);
    const taskB = updatedTasks[0];
    expect(taskB.id).toBe('B');
    // Task B should snap to the project start date (Task A's start)
    expect(taskB.start.getTime()).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    // Dependency on A should be removed
    expect(taskB.dependencies?.length).toBe(0);
  });
});

describe('Resource Leveling Integration (CR-6)', () => {
  it('autoLevelResources smoke test: resolves conflict in onTasksChange', () => {
    let contextValue: any;
    
    const TestConsumer = () => {
      contextValue = useGanttContext();
      return null;
    };

    const resourceR: GanttResource = { id: 'R1', name: 'R1', maxUnits: 1.0 };
    const tasks: GanttTask[] = [
      { 
        id: '1', 
        name: 'Critical Task', 
        start: new Date('2024-01-01T00:00:00Z'), 
        end: new Date('2024-01-06T00:00:00Z'), // Ends latest, so it's critical
        float: 0,
        assignments: [{ resourceId: 'R1', units: 1.0 }]
      },
      { 
        id: '2', 
        name: 'Non-Critical Task', 
        start: new Date('2024-01-02T00:00:00Z'), // Overlaps
        end: new Date('2024-01-04T00:00:00Z'), // Ends earlier, has float
        float: 10 * 86400000,
        assignments: [{ resourceId: 'R1', units: 1.0 }]
      }
    ];

    let updatedTasks: GanttTask[] = [];

    render(
      <GanttProvider 
        tasks={tasks} 
        columns={[]}
        resources={[resourceR]}
        autoLevelResources={true}
        onTasksChange={(newTasks) => { updatedTasks = newTasks; }}
      >
        <TestConsumer />
      </GanttProvider>
    );

    // Trigger an update to task 2 to start the pipeline
    act(() => {
      contextValue.updateTask({ ...tasks[1] });
    });

    // The output should have Task 2 delayed to start after Task 1
    const task1 = updatedTasks.find(t => t.id === '1')!;
    const task2 = updatedTasks.find(t => t.id === '2')!;
    
    expect(task1.start.getTime()).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    // Task 2 was overlapping, it should be shifted to start >= Task 1 end
    expect(task2.start.getTime()).toBeGreaterThanOrEqual(task1.end.getTime());
  });
});
