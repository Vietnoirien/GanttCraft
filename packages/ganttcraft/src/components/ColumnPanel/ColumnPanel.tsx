import React, { useMemo, useCallback } from 'react';
import { useGanttContext } from '../GanttProvider';
import { ROW_HEIGHT } from '../../engine/layout';

export const ColumnPanel: React.FC = () => {
  const { tasks, visibleTasks, columns, showResourcePanel, toggleGroup, collapsedGroupIds } = useGanttContext();

  const uniqueResources = useMemo(() => {
    if (!showResourcePanel) return [];
    const res = new Set<string>();
    tasks.forEach(t => {
      t.assignments?.forEach(a => res.add(a.resourceId));
    });
    return Array.from(res);
  }, [tasks, showResourcePanel]);

  const getDepth = useCallback((taskId: string): number => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.parentId) return 0;
    return 1 + getDepth(task.parentId);
  }, [tasks]);

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
          {visibleTasks.map((task) => (
            <tr key={task.id} style={{ height: ROW_HEIGHT }}>
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
