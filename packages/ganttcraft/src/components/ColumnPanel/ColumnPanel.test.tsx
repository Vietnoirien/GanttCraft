import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColumnPanel } from './ColumnPanel';
import { GanttProvider } from '../GanttProvider';
import { GanttTask, GanttColumn } from '../../types';

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
