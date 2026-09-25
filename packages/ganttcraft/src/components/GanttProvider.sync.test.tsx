import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GanttProvider, useGanttContext } from './GanttProvider';
import { GanttResource, GanttTask } from '../types';
import { createStandardCalendar } from '../engine/calendar';

const day = (value: string) => new Date(`${value}T00:00:00Z`);

function TaskState() {
  const { tasks, deleteTask, undo, redo } = useGanttContext();
  return (
    <>
      <output data-testid="tasks">{JSON.stringify(tasks.map(task => ({
        id: task.id,
        name: task.name,
        start: task.start.toISOString(),
        end: task.end.toISOString(),
        dependencies: task.dependencies,
        float: task.float,
      })))}</output>
      <button onClick={() => deleteTask('A')}>Delete A</button>
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
    </>
  );
}

function renderedTasks() {
  return JSON.parse(screen.getByTestId('tasks').textContent || '[]') as Array<{
    id: string;
    name: string;
    start: string;
    end: string;
    dependencies?: GanttTask['dependencies'];
    float?: number;
  }>;
}

describe('GanttProvider task state', () => {
  it('reflects replacement task props without remounting', () => {
    const first: GanttTask[] = [{ id: 'A', name: 'First', start: day('2024-01-01'), end: day('2024-01-02') }];
    const second: GanttTask[] = [{ id: 'B', name: 'Second', start: day('2024-02-01'), end: day('2024-02-02') }];
    const { rerender } = render(<GanttProvider tasks={first} columns={[]}><TaskState /></GanttProvider>);
    expect(renderedTasks().map(task => task.name)).toEqual(['First']);
    rerender(<GanttProvider tasks={second} columns={[]}><TaskState /></GanttProvider>);
    expect(renderedTasks().map(task => task.name)).toEqual(['Second']);
  });

  it('shows group rollups and calculated float on initial render', () => {
    const tasks: GanttTask[] = [
      { id: 'A', name: 'Group', type: 'group', start: day('2024-01-10'), end: day('2024-01-11') },
      { id: 'B', name: 'Child', parentId: 'A', start: day('2024-01-01'), end: day('2024-01-03') },
    ];
    render(<GanttProvider tasks={tasks} columns={[]} showCriticalPath><TaskState /></GanttProvider>);
    const group = renderedTasks().find(task => task.id === 'A');
    expect(group?.start).toBe(day('2024-01-01').toISOString());
    expect(group?.end).toBe(day('2024-01-03').toISOString());
    expect(renderedTasks().every(task => typeof task.float === 'number')).toBe(true);
  });

  it('shows initial resource leveling in the chart task state', () => {
    const resources: GanttResource[] = [{ id: 'R', name: 'Resource', maxUnits: 1 }];
    const tasks: GanttTask[] = [
      { id: 'A', name: 'Long', start: day('2024-01-01'), end: day('2024-01-06'), assignments: [{ resourceId: 'R', units: 1 }] },
      { id: 'B', name: 'Short', start: day('2024-01-02'), end: day('2024-01-04'), assignments: [{ resourceId: 'R', units: 1 }] },
    ];
    render(<GanttProvider tasks={tasks} columns={[]} resources={resources} autoLevelResources><TaskState /></GanttProvider>);
    expect(renderedTasks().find(task => task.id === 'B')?.start).toBe(day('2024-01-06').toISOString());
  });

  it('deletes and restores tasks with automatic scheduling disabled', () => {
    const tasks: GanttTask[] = [
      { id: 'A', name: 'Predecessor', start: day('2024-01-01'), end: day('2024-01-02') },
      { id: 'B', name: 'Successor', start: day('2024-01-02'), end: day('2024-01-03'), dependencies: [{ id: 'A', type: 'FS' }] },
    ];
    render(<GanttProvider tasks={tasks} columns={[]} autoSchedule={false}><TaskState /></GanttProvider>);
    fireEvent.click(screen.getByText('Delete A'));
    expect(renderedTasks().map(task => task.id)).toEqual(['B']);
    expect(renderedTasks()[0].dependencies).toEqual([]);
    fireEvent.click(screen.getByText('Undo'));
    expect(renderedTasks().map(task => task.id)).toEqual(['A', 'B']);
    expect(renderedTasks()[1].dependencies).toEqual([{ id: 'A', type: 'FS' }]);
    fireEvent.click(screen.getByText('Redo'));
    expect(renderedTasks().map(task => task.id)).toEqual(['B']);
  });

  it('keeps undo history when a controlled parent clones the emitted task array', () => {
    const initial: GanttTask[] = [
      { id: 'A', name: 'First', start: day('2024-01-01'), end: day('2024-01-02') },
      { id: 'B', name: 'Second', start: day('2024-01-02'), end: day('2024-01-03') },
    ];
    function ControlledChart() {
      const [tasks, setTasks] = useState(initial);
      return <GanttProvider tasks={tasks} columns={[]} autoSchedule={false}
        onTasksChange={next => setTasks([...next])}><TaskState /></GanttProvider>;
    }
    render(<ControlledChart />);
    fireEvent.click(screen.getByText('Delete A'));
    expect(renderedTasks().map(task => task.id)).toEqual(['B']);
    fireEvent.click(screen.getByText('Undo'));
    expect(renderedTasks().map(task => task.id)).toEqual(['A', 'B']);
  });

  it('snaps an unblocked successor to a working day after deleting its predecessor', () => {
    const tasks: GanttTask[] = [
      { id: 'A', name: 'Predecessor', start: day('2024-01-05'), end: day('2024-01-06') },
      { id: 'B', name: 'Successor', start: day('2024-01-08'), end: day('2024-01-09'), dependencies: [{ id: 'A', type: 'FS' }] },
    ];
    const calendar = createStandardCalendar({ holidays: [{ date: '2024-01-05', name: 'Holiday' }] });
    render(<GanttProvider tasks={tasks} columns={[]} calendar={calendar}><TaskState /></GanttProvider>);
    fireEvent.click(screen.getByText('Delete A'));
    expect(renderedTasks()[0].start).toBe(day('2024-01-08').toISOString());
  });
});
