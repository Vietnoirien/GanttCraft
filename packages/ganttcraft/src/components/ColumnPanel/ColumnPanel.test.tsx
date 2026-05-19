import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColumnPanel } from './ColumnPanel';
import { GanttProvider } from '../GanttProvider';
import { GanttTask, GanttColumn, GanttResource } from '../../types';

const tasks: GanttTask[] = [
  { id: '1', name: 'Task Alpha', start: new Date('2024-01-01'), end: new Date('2024-01-05') },
];

describe('ColumnPanel renderCell support', () => {
  it('renders the accessor value when renderCell is not provided', () => {
    const columns: GanttColumn[] = [
      { id: 'name', header: 'Name', accessor: (t) => t.name },
    ];
    const { getByText } = render(
      <GanttProvider tasks={tasks} columns={columns}>
        <ColumnPanel />
      </GanttProvider>
    );
    expect(getByText('Task Alpha')).toBeTruthy();
  });

  it('renders the renderCell output instead of accessor when renderCell is provided', () => {
    const columns: GanttColumn[] = [
      {
        id: 'name',
        header: 'Name',
        accessor: (t) => t.name,
        renderCell: (t) => <span data-testid={`custom-${t.id}`}>Custom: {t.name}</span>,
      },
    ];
    const { getByTestId } = render(
      <GanttProvider tasks={tasks} columns={columns}>
        <ColumnPanel />
      </GanttProvider>
    );
    const el = getByTestId('custom-1');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('Custom: Task Alpha');
  });

  it('renders column headers regardless of renderCell', () => {
    const columns: GanttColumn[] = [
      {
        id: 'name',
        header: 'Task Name',
        accessor: (t) => t.name,
        renderCell: (t) => <b>{t.name}</b>,
      },
    ];
    const { getByText } = render(
      <GanttProvider tasks={tasks} columns={columns}>
        <ColumnPanel />
      </GanttProvider>
    );
    expect(getByText('Task Name')).toBeTruthy();
  });
});

const resources: GanttResource[] = [{ id: 'r1', name: 'Alice' }];

describe('ColumnPanel theming', () => {
  const columns: GanttColumn[] = [
    { id: 'name', header: 'Name', accessor: (t) => t.name },
  ];

  it('root panel div uses var(--gantt-bg) not hardcoded white', () => {
    const { container } = render(
      <GanttProvider tasks={tasks} columns={columns}>
        <ColumnPanel />
      </GanttProvider>
    );
    const panel = container.querySelector('.gantt-column-panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.style.backgroundColor).toBe('var(--gantt-bg, #ffffff)');
    expect(panel.style.backgroundColor).not.toBe('white');
  });

  it('resource panel div uses var(--gantt-bg) not hardcoded white', () => {
    const tasksWithAssignments: GanttTask[] = [
      {
        id: '2',
        name: 'Task B',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
        assignments: [{ resourceId: 'r1', units: 1 }],
      },
    ];
    const { container } = render(
      <GanttProvider tasks={tasksWithAssignments} columns={columns} resources={resources} showResourcePanel>
        <ColumnPanel />
      </GanttProvider>
    );
    // The resource panel is a sibling div inside .gantt-column-panel
    const panel = container.querySelector('.gantt-column-panel') as HTMLElement;
    const resourceDiv = panel?.querySelector('div[style*="border-top"]') as HTMLElement | null;
    expect(resourceDiv).not.toBeNull();
    expect(resourceDiv!.style.backgroundColor).toBe('var(--gantt-bg, #ffffff)');
    expect(resourceDiv!.style.backgroundColor).not.toBe('white');
  });
});
