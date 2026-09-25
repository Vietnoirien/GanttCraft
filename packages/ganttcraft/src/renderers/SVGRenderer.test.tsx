import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { SVGRenderer, isSafeTaskDestination } from './SVGRenderer';
import { GanttProvider } from '../components/GanttProvider';
import { describe, it, expect, vi } from 'vitest';
import { GanttTask } from '../types';
import { ColumnPanel } from '../components/ColumnPanel/ColumnPanel';
import { createStandardCalendar } from '../engine/calendar';
import { GanttChart } from '../components/GanttChart';


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

    const taskGroup = container.querySelector('[data-chart-task-id]');
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
  const baseUrl = 'https://app.example.com/projects/1';

  it.each([
    '/tasks/1',
    'tasks/1',
    './tasks/1?tab=details',
    '../tasks/1#schedule',
    'https://example.com/tasks/1',
    'http://example.com/tasks/1',
  ])('accepts safe default destination %s', (destination) => {
    expect(isSafeTaskDestination(destination, baseUrl)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:alert(1)',
    'https:example.com/tasks/1',
    '//example.com/tasks/1',
    '\\\\example.com\\tasks\\1',
    'https://',
    'https://[invalid',
    '  /tasks/1',
    '/tasks/1\n',
    '',
  ])('rejects unsafe or malformed default destination %s', (destination) => {
    expect(isSafeTaskDestination(destination, baseUrl)).toBe(false);
  });

  it('shows "Navigate" context menu item when task has a slug (T1.5)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'Slug Task', start: new Date('2024-01-01'), end: new Date('2024-01-10'), slug: '/tasks/slug-task' },
    ];
    const { container, queryByRole, getByText, queryByText } = render(
      <GanttProvider tasks={tasks} columns={[]}>
        <SVGRenderer />
      </GanttProvider>
    );
    const taskGroup = container.querySelector('[data-chart-task-id]')!;
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
    act(() => { fireEvent.contextMenu(container.querySelector('[data-chart-task-id]')!); });
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
    act(() => { fireEvent.contextMenu(container.querySelector('[data-chart-task-id]')!); });
    act(() => { fireEvent.click(getByText('Navigate')); });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: '3', slug: '/tasks/nav-task' }));
  });

  it('leaves navigation decisions to onTaskNavigate when a host callback is provided', () => {
    const tasks: GanttTask[] = [
      { id: '4', name: 'Host Task', start: new Date('2024-01-01'), end: new Date('2024-01-10'), slug: 'custom:task/4' },
    ];
    const onNavigate = vi.fn();
    const { container, getByText } = render(
      <GanttProvider tasks={tasks} columns={[]} onTaskNavigate={onNavigate}>
        <SVGRenderer />
      </GanttProvider>
    );
    fireEvent.contextMenu(container.querySelector('[data-chart-task-id]')!);
    fireEvent.click(getByText('Navigate'));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: '4', slug: 'custom:task/4' }));
  });
});

describe('keyboard task navigation', () => {
  const tasks: GanttTask[] = [
    { id: 'first', name: 'First', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-09T00:00:00Z') },
    { id: 'second', name: 'Second', start: new Date('2024-01-09T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z') },
  ];
  const columns = [{ id: 'name', header: 'Name', accessor: (task: GanttTask) => task.name }];

  it('announces matching task labels and moves focus between the list and chart', () => {
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns}>
        <ColumnPanel />
        <SVGRenderer />
      </GanttProvider>
    );
    const listRows = Array.from(container.querySelectorAll<HTMLTableRowElement>('[data-list-task-id]'));
    const chartRows = Array.from(container.querySelectorAll<SVGGElement>('[data-chart-task-id]'));

    expect(listRows[0].getAttribute('aria-label')).toBe(chartRows[0].getAttribute('aria-label'));
    listRows[0].focus();
    fireEvent.keyDown(listRows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(listRows[1]);
    fireEvent.keyDown(listRows[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(chartRows[1]);
    fireEvent.keyDown(chartRows[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(chartRows[0]);
    fireEvent.keyDown(chartRows[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(listRows[0]);
  });

  it('scrolls a chart task into view before moving focus from the list', async () => {
    const manyTasks: GanttTask[] = Array.from({ length: 25 }, (_, index) => ({
      id: `task-${index}`,
      name: `Task ${index}`,
      start: new Date(index === 20 ? '2024-03-01T00:00:00Z' : '2024-01-01T00:00:00Z'),
      end: new Date(index === 20 ? '2024-03-02T00:00:00Z' : '2024-01-02T00:00:00Z'),
    }));
    const { container } = render(<GanttChart tasks={manyTasks} columns={columns} />);
    const listRow = container.querySelector<HTMLTableRowElement>('[data-list-task-id="task-20"]')!;
    const scrollContainer = container.querySelector<HTMLElement>('[data-gantt-scroll-container]')!;
    expect(container.querySelector('[data-chart-task-id="task-20"]')).toBeNull();

    listRow.focus();
    fireEvent.keyDown(listRow, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement?.getAttribute('data-chart-task-id')).toBe('task-20'));
    expect(scrollContainer.scrollTop).toBeGreaterThan(0);
    expect(scrollContainer.scrollLeft).toBeGreaterThan(0);
  });

  it('opens pointer task actions by keyboard and restores focus after Escape', () => {
    const { container, getByRole, queryByRole } = render(
      <GanttProvider tasks={tasks} columns={columns}>
        <SVGRenderer />
      </GanttProvider>
    );
    const task = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    act(() => { task.focus(); });
    fireEvent.keyDown(task, { key: 'Enter' });
    expect(getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(task);
  });

  it('runs the public Navigate action from the keyboard menu', () => {
    const onTaskNavigate = vi.fn();
    const linkedTask = { ...tasks[0], slug: '/tasks/first' };
    const { container, getByText } = render(
      <GanttChart tasks={[linkedTask]} columns={columns} onTaskNavigate={onTaskNavigate} />
    );
    const task = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    fireEvent.keyDown(task, { key: 'Enter' });
    const menu = container.querySelector('[role="menu"]')!;
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(getByText('Navigate').parentElement);
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onTaskNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: 'first', slug: '/tasks/first' }));
  });

  it('runs Delete from the keyboard menu', () => {
    let updatedTasks = tasks;
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns} onTasksChange={next => { updatedTasks = next; }}>
        <SVGRenderer />
      </GanttProvider>
    );
    const task = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    fireEvent.keyDown(task, { key: 'Enter' });
    const menu = container.querySelector('[role="menu"]')!;
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(updatedTasks.map(item => item.id)).toEqual(['second']);
    expect(document.activeElement?.getAttribute('data-chart-task-id')).toBe('second');
  });

  it('moves and resizes a task by keyboard using the configured holiday calendar', () => {
    const calendar = createStandardCalendar({ holidays: [{ date: '2024-01-08', name: 'Team holiday' }] });
    let updatedTasks = tasks;
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns} calendar={calendar} onTasksChange={next => { updatedTasks = next; }}>
        <SVGRenderer />
      </GanttProvider>
    );
    const task = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    fireEvent.keyDown(task, { key: 'ArrowRight', altKey: true });
    expect(updatedTasks[0].start).toEqual(new Date('2024-01-09T00:00:00Z'));
    expect(updatedTasks[0].end).toEqual(new Date('2024-01-10T00:00:00Z'));

    fireEvent.keyDown(task, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(updatedTasks[0].end).toEqual(new Date('2024-01-11T00:00:00Z'));
    fireEvent.keyDown(task, { key: 'ArrowLeft', altKey: true, ctrlKey: true });
    expect(updatedTasks[0].start).toEqual(new Date('2024-01-05T00:00:00Z'));
  });

  it('passes the configured calendar to pointer drags', () => {
    const calendar = createStandardCalendar({ holidays: [{ date: '2024-01-08', name: 'Team holiday' }] });
    let updatedTasks = tasks;
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns} calendar={calendar} onTasksChange={next => { updatedTasks = next; }}>
        <SVGRenderer />
      </GanttProvider>
    );
    const task = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    fireEvent.mouseDown(task, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 50 });
    fireEvent.mouseUp(window);
    expect(updatedTasks[0].start).toEqual(new Date('2024-01-09T00:00:00Z'));
    expect(updatedTasks[0].end).toEqual(new Date('2024-01-10T00:00:00Z'));
  });

  it('creates the same FS dependency as the pointer link handle', () => {
    let updatedTasks = tasks;
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns} onTasksChange={next => { updatedTasks = next; }}>
        <SVGRenderer />
      </GanttProvider>
    );
    const source = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    const target = container.querySelector<SVGGElement>('[data-chart-task-id="second"]')!;
    act(() => { source.focus(); });
    fireEvent.keyDown(source, { key: 'l' });
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Choose a target');
    fireEvent.keyDown(source, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(target);
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(updatedTasks[1].dependencies).toEqual([{ id: 'first', type: 'FS' }]);
  });

  it('starts keyboard link selection from the task actions menu', () => {
    let updatedTasks = tasks;
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns} onTasksChange={next => { updatedTasks = next; }}>
        <SVGRenderer />
      </GanttProvider>
    );
    const source = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    const target = container.querySelector<SVGGElement>('[data-chart-task-id="second"]')!;
    fireEvent.keyDown(source, { key: 'Enter' });
    const menu = container.querySelector('[role="menu"]')!;
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(document.activeElement).toBe(source);
    fireEvent.keyDown(source, { key: 'ArrowDown' });
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(updatedTasks[1].dependencies).toEqual([{ id: 'first', type: 'FS' }]);
  });

  it('keeps custom rendered tasks keyboard accessible', () => {
    const { container, getByRole } = render(
      <GanttProvider tasks={tasks} columns={columns} renderTask={task => <div>{task.name}</div>}>
        <SVGRenderer />
      </GanttProvider>
    );
    const task = container.querySelector<SVGGElement>('[data-chart-task-id="first"]')!;
    expect(task.getAttribute('role')).toBe('button');
    fireEvent.keyDown(task, { key: ' ' });
    expect(getByRole('menu')).toBeTruthy();
  });
});
