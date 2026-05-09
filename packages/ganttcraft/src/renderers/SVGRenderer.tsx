import React, { useMemo } from 'react';
import { useGanttContext } from '../components/GanttProvider';
import { calculateTaskLayout, ROW_HEIGHT, MS_PER_DAY, dateToPixelX } from '../engine/layout';
import { isTaskVisible } from '../engine/virtualizer';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import { DependencyLayer } from './DependencyLayer';

export const SVGRenderer: React.FC = () => {
  const {
    tasks,
    startDate,
    endDate,
    updateTask,
    pixelsPerMs,
    renderTask,
    scrollLeft,
    viewportWidth,
    virtualWindow,
    i18n,
    addDependency,
    deleteTask,
    showCriticalPath,
    conflicts,
  } = useGanttContext();

  const { draggingTask, handleMouseDown, setLinkTargetId, linkState } = useTaskDrag({
    onTaskUpdate: updateTask,
    onLinkCreate: addDependency,
  });

  const [hoveredTaskId, setHoveredTaskId] = React.useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = React.useState<{ taskId: string, x: number, y: number, isGroup: boolean } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, taskId: string, isGroup: boolean) => {
    e.preventDefault();
    setContextMenuState({
      taskId,
      x: e.clientX,
      y: e.clientY,
      isGroup
    });
  };

  const layoutTasks = useMemo(() => {
    return tasks.map((task, idx) => {
      const source = draggingTask && draggingTask.id === task.id ? draggingTask : task;
      return calculateTaskLayout(source, idx, startDate, pixelsPerMs);
    });
  }, [tasks, draggingTask, startDate, pixelsPerMs]);

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const totalMs = endMs - startMs + MS_PER_DAY * 7;
  const width = Math.max(totalMs * pixelsPerMs, 800);
  const height = Math.max(tasks.length * ROW_HEIGHT, 400);

  // Only render rows inside the virtual window
  const { startIndex, endIndex, offsetY } = virtualWindow;

  // Filter to virtual window rows + apply X-axis culling
  const visibleLayoutTasks = layoutTasks.filter((t, idx) => {
    if (idx < startIndex || idx > endIndex) return false;
    return isTaskVisible(t.x, t.width, scrollLeft, viewportWidth);
  });

  // Grid lines — also virtualized to visible rows only
  const visibleGridLines = tasks
    .slice(startIndex, endIndex + 1)
    .map((_, i) => startIndex + i);

  return (
    <div className="gantt-svg-container" style={{ overflow: 'visible', flexGrow: 1, flexShrink: 0, position: 'relative' }}>
      {/* Spacer to maintain total scroll height */}
      <div style={{ height: virtualWindow.totalHeight, position: 'relative' }}>
        <svg
          width={width}
          height={height}
          style={{
            backgroundColor: 'var(--gantt-bg, #f9f9f9)',
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* Translate the rendered content to the virtual window offset */}
          <g transform={`translate(0, ${offsetY})`}>
            {/* Grid lines — only visible rows */}
            {visibleGridLines.map((rowIdx) => (
              <line
                key={`grid-y-${rowIdx}`}
                x1={0}
                y1={(rowIdx - startIndex + 1) * ROW_HEIGHT}
                x2={width}
                y2={(rowIdx - startIndex + 1) * ROW_HEIGHT}
                stroke="var(--gantt-border, #eee)"
                strokeWidth="1"
              />
            ))}

            <DependencyLayer linkState={linkState} />

            {/* Task bars — virtualized + X-culled */}
            {visibleLayoutTasks.map((t) => {
              const localY = t.y - offsetY;

              if (renderTask) {
                // Consumer-provided renderTask: wrap in foreignObject
                return (
                  <foreignObject
                    key={t.id}
                    x={t.x}
                    y={localY + (ROW_HEIGHT - t.height) / 2}
                    width={t.width}
                    height={t.height}
                    style={{ overflow: 'visible' }}
                  >
                    <div
                      // @ts-expect-error -- xmlns needed for SVG foreignObject
                      xmlns="http://www.w3.org/1999/xhtml"
                      style={{ width: '100%', height: '100%' }}
                    >
                      {renderTask(t)}
                    </div>
                  </foreignObject>
                );
              }

              const isCritical = showCriticalPath && t.float !== undefined && t.float <= 0;
              const fill = isCritical ? 'var(--gantt-critical, #ef4444)' : 'var(--gantt-task-fill, #3b82f6)';
              const baselineY = localY + ROW_HEIGHT / 2 + 10;
              const hasBaseline = t.baselineStart && t.baselineEnd;
              let baselineStartX = 0;
              let baselineWidth = 0;
              if (hasBaseline) {
                baselineStartX = dateToPixelX(t.baselineStart!, startDate, pixelsPerMs);
                const baselineEndX = dateToPixelX(t.baselineEnd!, startDate, pixelsPerMs);
                baselineWidth = baselineEndX - baselineStartX;
              }

              if (t.type === 'milestone') {
                const cx = t.x + t.width / 2;
                const cy = localY + ROW_HEIGHT / 2;
                const size = 12;
                const taskConflicts = conflicts[t.id];
                const ariaLabel = `${t.name}, Milestone on ${t.start.toLocaleDateString(i18n.locale.code)}`;

                return (
                  <g 
                    key={t.id} 
                    style={{ cursor: 'move', outline: 'none' }} 
                    onMouseDown={(e) => handleMouseDown(t, 'move')(e as any)}
                    onContextMenu={(e) => handleContextMenu(e, t.id, false)}
                    tabIndex={0}
                    role="row"
                    aria-label={ariaLabel}
                  >
                    <polygon
                      points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
                      fill={fill}
                    />
                    <text x={cx + 16} y={cy + 4} fill="#333" fontSize="12" pointerEvents="none">
                      {t.name}
                    </text>
                    {taskConflicts && taskConflicts.length > 0 && (
                      <text x={cx - 20} y={cy + 4} fontSize="14" fill="red">⚠️</text>
                    )}
                  </g>
                );
              }

              if (t.type === 'group') {
                const cy = localY + ROW_HEIGHT / 2;
                const ariaLabel = `${t.name}, Group from ${t.start.toLocaleDateString(i18n.locale.code)} to ${t.end.toLocaleDateString(i18n.locale.code)}`;
                const taskConflicts = conflicts[t.id];

                return (
                  <g 
                    key={t.id}
                    tabIndex={0}
                    role="row"
                    aria-label={ariaLabel}
                    onContextMenu={(e) => handleContextMenu(e, t.id, true)}
                    style={{ outline: 'none' }}
                  >
                    <path
                      d={`M ${t.x} ${cy + 6} L ${t.x} ${cy - 4} L ${t.x + t.width} ${cy - 4} L ${t.x + t.width} ${cy + 6} L ${t.x + t.width - 4} ${cy} L ${t.x + 4} ${cy} Z`}
                      fill="var(--gantt-group-fill, #1f2937)"
                    />
                    <text x={t.x} y={cy - 8} fill="#333" fontSize="12" fontWeight="bold" pointerEvents="none">
                      {t.name}
                    </text>
                    {taskConflicts && taskConflicts.length > 0 && (
                      <text x={t.x - 20} y={cy} fontSize="14" fill="red">⚠️</text>
                    )}
                  </g>
                );
              }

              // Standard Task
              const taskConflicts = conflicts[t.id];
              const ariaLabel = `${i18n.strings.taskName} ${t.name}, ${i18n.strings.startDate} ${t.start.toLocaleDateString(i18n.locale.code)}, ${i18n.strings.endDate} ${t.end.toLocaleDateString(i18n.locale.code)}, ${i18n.strings.progress} ${t.progress || 0}%`;

              return (
                <g key={t.id}>
                  {hasBaseline && (
                    <rect
                      x={baselineStartX}
                      y={baselineY}
                      width={baselineWidth}
                      height={4}
                      fill="var(--gantt-baseline, #9ca3af)"
                      rx={2}
                    />
                  )}
                  <g 
                    style={{ cursor: 'move', outline: 'none' }} 
                    onMouseDown={(e) => handleMouseDown(t, 'move')(e as any)}
                    onMouseEnter={() => setHoveredTaskId(t.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onContextMenu={(e) => handleContextMenu(e, t.id, false)}
                    tabIndex={0}
                    role="row"
                    aria-label={ariaLabel}
                  >
                    <rect
                      x={t.x}
                      y={localY + (ROW_HEIGHT - t.height) / 2}
                      width={t.width}
                      height={t.height}
                      fill={fill}
                      rx={4}
                    />
                    {t.progress !== undefined && (
                      <rect
                        x={t.x}
                        y={localY + (ROW_HEIGHT - t.height) / 2}
                        width={t.width * (t.progress / 100)}
                        height={t.height}
                        fill="rgba(0,0,0,0.2)"
                        rx={4}
                        pointerEvents="none"
                      />
                    )}
                    <rect
                      x={t.x}
                      y={localY + (ROW_HEIGHT - t.height) / 2}
                      width={6}
                      height={t.height}
                      fill="transparent"
                      style={{ cursor: 'col-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(t, 'resize-left')(e as any); }}
                    />
                    <rect
                      x={t.x + t.width - 6}
                      y={localY + (ROW_HEIGHT - t.height) / 2}
                      width={6}
                      height={t.height}
                      fill="transparent"
                      style={{ cursor: 'col-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(t, 'resize-right')(e as any); }}
                    />
                    <circle
                      className="gantt-task-link-handle"
                      cx={t.x + t.width}
                      cy={localY + ROW_HEIGHT / 2}
                      r={6}
                      fill="var(--gantt-border, #94a3b8)"
                      stroke="var(--gantt-bg, #ffffff)"
                      strokeWidth={2}
                      style={{ cursor: 'crosshair', opacity: hoveredTaskId === t.id ? 1 : 0, transition: 'opacity 150ms' }}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(t, 'link')(e as any); }}
                    />
                    <rect
                      className="gantt-task-drop-zone"
                      x={t.x}
                      y={localY}
                      width={12}
                      height={ROW_HEIGHT}
                      fill="transparent"
                      onMouseEnter={() => setLinkTargetId(t.id)}
                      onMouseLeave={() => setLinkTargetId(null)}
                    />
                    <text x={t.x + 8} y={localY + ROW_HEIGHT / 2 + 4} fill="white" fontSize="12" pointerEvents="none">
                      {t.name}
                    </text>
                    {taskConflicts && taskConflicts.length > 0 && (
                      <text x={t.x - 20} y={localY + ROW_HEIGHT / 2 + 4} fontSize="14" fill="red">⚠️</text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          onClose={() => setContextMenuState(null)}
          items={[
            {
              id: 'edit',
              label: i18n.strings.editTask || 'Edit Task',
              onClick: () => {
                // Future integration point for an edit dialog
                console.log(`Edit task ${contextMenuState.taskId}`);
              }
            },
            ...(!contextMenuState.isGroup ? [{
              id: 'add-dependency',
              label: 'Add Dependency', // Can be i18n'd later
              onClick: () => {
                // Future integration for a manual dependency dialog
                console.log(`Add dependency to ${contextMenuState.taskId}`);
              }
            }] : []),
            {
              id: 'delete',
              label: i18n.strings.deleteTask || 'Delete Task',
              variant: 'danger',
              onClick: () => {
                deleteTask(contextMenuState.taskId);
              }
            }
          ]}
        />
      )}
    </div>
  );
};
