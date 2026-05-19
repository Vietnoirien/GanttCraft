import { render, fireEvent, act } from '@testing-library/react';
import { SVGRenderer } from './SVGRenderer';
import { GanttProvider } from '../components/GanttProvider';
import { describe, it, expect, vi } from 'vitest';
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
  it('task text uses var(--gantt-task-text) not hardcoded white (T2.3)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Task Alpha', start: new Date('2024-01-01'), end: new Date('2024-01-10') },
    ];
    const { container } = render(
      <GanttProvider tasks={tasks} columns={[]}>
        <SVGRenderer />
      </GanttProvider>
    );
    // Task label text is a <text> element inside the SVG task group
    const textEl = Array.from(container.querySelectorAll('text')).find(
      (el) => el.textContent === 'Task Alpha'
    );
    expect(textEl).not.toBeUndefined();
    expect(textEl!.getAttribute('fill')).toBe('var(--gantt-task-text, #ffffff)');
  });
});

describe('SVGRenderer slug navigation', () => {
  it('shows "Navigate" context menu item when task has a slug (T1.5)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Slug Task', start: new Date('2024-01-01'), end: new Date('2024-01-10'), slug: '/tasks/slug-task' },
    ];
    const { container, queryByRole, getByText, queryByText } = render(
      <GanttProvider tasks={tasks} columns={[]}>
        <SVGRenderer />
      </GanttProvider>
    );
    const taskGroup = container.querySelector('[role="row"]')!;
    expect(queryByRole('menu')).toBeNull();

    act(() => { fireEvent.contextMenu(taskGroup); });

    expect(queryByRole('menu')).not.toBeNull();
    expect(queryByText('Navigate')).not.toBeNull();
    // Sanity: Delete still present
    expect(getByText('Delete Task')).not.toBeNull();
  });

  it('does NOT show Navigate when task has no slug (T1.5)', () => {
    const tasks: GanttTask[] = [
      { id: '2', name: 'No Slug', start: new Date('2024-01-01'), end: new Date('2024-01-10') },
    ];
    const { container, queryByRole, queryByText } = render(
      <GanttProvider tasks={tasks} columns={[]}>
        <SVGRenderer />
      </GanttProvider>
    );
    act(() => { fireEvent.contextMenu(container.querySelector('[role="row"]')!); });
    expect(queryByRole('menu')).not.toBeNull();
    expect(queryByText('Navigate')).toBeNull();
  });

  it('calls onTaskNavigate with the full task when Navigate clicked (T1.5)', () => {
    const tasks: GanttTask[] = [
      { id: '3', name: 'Nav Task', start: new Date('2024-01-01'), end: new Date('2024-01-10'), slug: '/tasks/nav-task' },
    ];
    const onNavigate = vi.fn();
    const { container, getByText } = render(
      <GanttProvider tasks={tasks} columns={[]} onTaskNavigate={onNavigate}>
        <SVGRenderer />
      </GanttProvider>
    );
    act(() => { fireEvent.contextMenu(container.querySelector('[role="row"]')!); });
    act(() => { fireEvent.click(getByText('Navigate')); });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: '3', slug: '/tasks/nav-task' }));
  });
});


