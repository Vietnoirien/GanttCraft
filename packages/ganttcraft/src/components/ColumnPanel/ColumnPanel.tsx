import React, { useMemo } from 'react';
import { useGanttContext } from '../GanttProvider';
import { ROW_HEIGHT } from '../../engine/layout';
import { taskAccessibleLabel } from '../taskAccessibility';

export const ColumnPanel: React.FC = () => {
  const { tasks, visibleTasks, columns, showResourcePanel, toggleGroup, collapsedGroupIds, i18n } = useGanttContext();

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, taskId: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const rows = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>('[data-list-task-id]') || []);
      const index = rows.indexOf(event.currentTarget);
      rows[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
      const chart = event.currentTarget.closest('.gantt-chart-container');
      const chartTask = Array.from((chart || document).querySelectorAll<SVGElement>('[data-chart-task-id]'))
        .find(element => element.getAttribute('data-chart-task-id') === taskId);
      if (chartTask) {
        event.preventDefault();
        chartTask.focus();
      } else {
        if (chart) {
          event.preventDefault();
          chart.dispatchEvent(new CustomEvent('gantt-focus-chart-task', { detail: taskId }));
        }
      }
    }
  };

  const uniqueResources = useMemo(() => {
    if (!showResourcePanel) return [];
    const res = new Set<string>();
    tasks.forEach(t => {
      t.assignments?.forEach(a => res.add(a.resourceId));
    });
    return Array.from(res);
  }, [tasks, showResourcePanel]);

  const getDepth = (taskId: string): number => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.parentId) return 0;
    return 1 + getDepth(task.parentId);
  };

  return (
    <div className="gantt-column-panel" style={{ borderRight: '1px solid var(--gantt-border, #e2e8f0)', backgroundColor: 'var(--gantt-bg, #ffffff)', minWidth: 250, maxWidth: 400 }}>
      <table style={{ borderCollapse: 'collapse', width: 'max-content', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                style={{
                  padding: '0 12px',
                  borderBottom: '1px solid var(--gantt-border, #e2e8f0)',
                  textAlign: 'left',
                  width: col.width,
                  height: 48,
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--gantt-surface, #f8f9fa)',
                  zIndex: 30,
                  boxSizing: 'border-box',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--gantt-text-primary, #1a202c)'
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((task) => (
            <tr
              key={task.id}
              style={{ height: ROW_HEIGHT }}
              tabIndex={0}
              data-list-task-id={task.id}
              aria-label={taskAccessibleLabel(task, i18n)}
              onKeyDown={event => handleRowKeyDown(event, task.id)}
            >
              {columns.map((col, colIndex) => (
                <td key={col.id} style={{ 
                  padding: '0 12px', 
                  borderBottom: '1px solid var(--gantt-border, #e2e8f0)', 
                  height: ROW_HEIGHT, 
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  fontSize: '0.875rem',
                  color: 'var(--gantt-text-primary, #1a202c)'
                }}>
                  {colIndex === 0 ? (
                    <div style={{ paddingLeft: getDepth(task.id) * 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {task.type === 'group' ? (
                        <button 
                          onClick={() => toggleGroup(task.id)} 
                          aria-label={`${collapsedGroupIds.has(task.id) ? 'Expand' : 'Collapse'} ${task.name}`}
                          aria-expanded={!collapsedGroupIds.has(task.id)}
                          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: '10px', color: '#718096', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14 }}
                        >
                          {collapsedGroupIds.has(task.id) ? '▶' : '▼'}
                        </button>
                      ) : (
                        <span style={{ width: 14 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {col.renderCell ? col.renderCell(task) : col.accessor(task)}
                      </span>
                    </div>
                  ) : (
                    col.renderCell ? col.renderCell(task) : col.accessor(task)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showResourcePanel && (
        <div style={{ height: Math.max(uniqueResources.length * 50, 150), position: 'relative', borderTop: '2px solid var(--gantt-border, #eee)', backgroundColor: 'var(--gantt-bg, #ffffff)' }}>
          {uniqueResources.map((resId, rIdx) => (
            <div 
              key={`label-${resId}`}
              style={{
                position: 'absolute',
                left: 12,
                top: rIdx * 50 + 10,
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#666',
                width: 'max-content',
                padding: '2px 4px',
                borderRadius: '4px'
              }}
            >
              {resId}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
