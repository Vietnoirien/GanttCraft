import React, { useMemo } from 'react';
import { useGanttContext } from '../GanttProvider';
import { ROW_HEIGHT } from '../../engine/layout';

export const ColumnPanel: React.FC = () => {
  const { tasks, columns, showResourcePanel } = useGanttContext();

  const uniqueResources = useMemo(() => {
    if (!showResourcePanel) return [];
    const res = new Set<string>();
    tasks.forEach(t => {
      t.assignments?.forEach(a => res.add(a.resourceId));
    });
    return Array.from(res);
  }, [tasks, showResourcePanel]);

  return (
    <div className="gantt-column-panel" style={{ borderRight: '1px solid var(--gantt-border, #e2e8f0)', backgroundColor: 'white', minWidth: 250, maxWidth: 400 }}>
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
          {tasks.map((task) => (
            <tr key={task.id} style={{ height: ROW_HEIGHT }}>
              {columns.map((col) => (
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
                  {/* Use renderCell when provided, fall back to accessor */}
                  {col.renderCell ? col.renderCell(task) : col.accessor(task)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showResourcePanel && (
        <div style={{ height: Math.max(uniqueResources.length * 50, 150), position: 'relative', borderTop: '2px solid var(--gantt-border, #eee)', backgroundColor: 'white' }}>
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
