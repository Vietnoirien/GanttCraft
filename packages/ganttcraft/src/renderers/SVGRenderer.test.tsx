import { render, fireEvent, act } from '@testing-library/react';
import { SVGRenderer } from './SVGRenderer';
import { GanttProvider } from '../components/GanttProvider';
import { describe, it, expect } from 'vitest';
import { GanttTask } from '../types';


describe('SVGRenderer', () => {
  it('renders SVG rects for tasks', () => {
    const tasks = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'Task 2', start: new Date('2024-01-03'), end: new Date('2024-01-04') }
    ];
    
    const { container } = render(
      <GanttProvider tasks={tasks} columns={[]}>
        <SVGRenderer />
      </GanttProvider>
    );

    const rects = container.querySelectorAll('rect');
    // 2 tasks * 4 rects (main + left resize + right resize + left drop zone)
    expect(rects.length).toBe(8);
  });

  it('renders link handles (circle) and drop zones for tasks (CR-3.A.2)', () => {
    const tasks = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
    ];
    
    const { container } = render(
      <GanttProvider tasks={tasks} columns={[]}>
        <SVGRenderer />
      </GanttProvider>
    );

    // Should have a link handle circle
    const circles = container.querySelectorAll('circle.gantt-task-link-handle');
    expect(circles.length).toBe(1);

    // Should have a drop zone rect
    const dropZones = container.querySelectorAll('rect.gantt-task-drop-zone');
    expect(dropZones.length).toBe(1);
  });

  it('integration: dragging from link handle to drop zone adds dependency (CR-3.A.5)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
      { id: '2', name: 'Task 2', start: new Date('2024-01-03'), end: new Date('2024-01-04') },
    ];
    let updatedTasks = [...tasks];

    const { container } = render(
      <GanttProvider tasks={tasks} columns={[]} onTasksChange={(t) => { updatedTasks = t; }}>
        <SVGRenderer />
      </GanttProvider>
    );

    const circles = container.querySelectorAll('circle.gantt-task-link-handle');
    const dropZones = container.querySelectorAll('rect.gantt-task-drop-zone');

    expect(circles.length).toBe(2);
    expect(dropZones.length).toBe(2);

    const sourceHandle = circles[0]; // Task 1 link handle
    const targetDropZone = dropZones[1]; // Task 2 drop zone

    // 1. Mouse down on source handle
    act(() => {
      fireEvent.mouseDown(sourceHandle, { clientX: 100, clientY: 50 });
    });

    // 2. Mouse move (window)
    act(() => {
      fireEvent.mouseMove(window, { clientX: 150, clientY: 50 });
    });

    // 3. Mouse enter on target drop zone
    act(() => {
      fireEvent.mouseEnter(targetDropZone);
    });

    // 4. Mouse up (window)
    act(() => {
      fireEvent.mouseUp(window);
    });

    // Expect Task 2 to now depend on Task 1
    const task2 = updatedTasks.find(t => t.id === '2');
    expect(task2?.dependencies).toBeDefined();
    expect(task2?.dependencies?.length).toBe(1);
    expect(task2?.dependencies![0].id).toBe('1');
    expect(task2?.dependencies![0].type).toBe('FS');
  });

  it('integration: right-clicking a task opens context menu (CR-3.B.2)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Task 1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
    ];
    let updatedTasks = [...tasks];

    const { container, queryByRole, getByText } = render(
      <GanttProvider tasks={tasks} columns={[]} onTasksChange={(t) => { updatedTasks = t; }}>
        <SVGRenderer />
      </GanttProvider>
    );

    const taskGroup = container.querySelector('[role="row"]');
    expect(taskGroup).not.toBeNull();

    // 1. Context menu should not be present initially
    expect(queryByRole('menu')).toBeNull();

    // 2. Right click the task
    act(() => {
      fireEvent.contextMenu(taskGroup!);
    });

    // 3. Context menu should be present
    expect(queryByRole('menu')).not.toBeNull();
    expect(getByText('Delete Task')).not.toBeNull();

    // 4. Click Delete Task
    act(() => {
      fireEvent.click(getByText('Delete Task'));
    });

    // 5. Context menu should be closed
    expect(queryByRole('menu')).toBeNull();
    
    // Task 1 should be deleted
    expect(updatedTasks.length).toBe(0);
  });
});


