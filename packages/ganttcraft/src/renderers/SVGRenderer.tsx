import React, { useMemo } from 'react';
import { useGanttContext } from '../components/GanttProvider';
import { calculateTaskLayout, ROW_HEIGHT, MS_PER_DAY, dateToPixelX } from '../engine/layout';
import { isTaskVisible } from '../engine/virtualizer';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';
import { DependencyLayer } from './DependencyLayer';
import { taskAccessibleLabel } from '../components/taskAccessibility';
import { GanttTask } from '../types';

// Default navigation supports same-origin relative paths and absolute HTTP(S) URLs.
export const isSafeTaskDestination = (destination: string, baseUrl: string): boolean => {
  if (!destination || /[\s\\]/.test(destination)) return false;

  const isAbsoluteHttpUrl = /^https?:\/\//i.test(destination);
  if (!isAbsoluteHttpUrl && (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//'))) {
    return false;
  }

  try {
    const base = new URL(baseUrl);
    const url = new URL(destination, base);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (isAbsoluteHttpUrl || url.origin === base.origin);
  } catch {
    return false;
  }
};

export const SVGRenderer: React.FC = () => {
  const keyboardHelpId = React.useId();
  const {
    visibleTasks,
    startDate,
    endDate,
    updateTask,
    pixelsPerMs,
    renderTask,
    scrollLeft,
    viewportWidth,
    viewportHeight,
    virtualWindow,
    setScrollState,
    i18n,
    addDependency,
    deleteTask,
    showCriticalPath,
    conflicts,
    onTaskNavigate,
    calendar,
  } = useGanttContext();

  const { draggingTask, handleMouseDown, setLinkTargetId, linkState, linkTargetId } = useTaskDrag({
    onTaskUpdate: updateTask,
    onLinkCreate: addDependency,
    calendar,
  });

  const [hoveredTaskId, setHoveredTaskId] = React.useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = React.useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = React.useState<{ taskId: string, x: number, y: number, isGroup: boolean } | null>(null);
  const [linkSourceId, setLinkSourceId] = React.useState<string | null>(null);
  const [keyboardMessage, setKeyboardMessage] = React.useState('');
  const [pendingFocusTaskId, setPendingFocusTaskId] = React.useState<string | null>(null);
  const menuTriggerRef = React.useRef<HTMLElement | SVGElement | null>(null);
  const rendererRef = React.useRef<HTMLDivElement | null>(null);

  const focusChartTask = React.useCallback((taskId: string) => {
    const rendered = Array.from(rendererRef.current?.querySelectorAll<SVGGElement>('[data-chart-task-id]') || [])
      .find(element => element.getAttribute('data-chart-task-id') === taskId);
    if (rendered) {
      rendered.focus();
      return;
    }

    const index = visibleTasks.findIndex(task => task.id === taskId);
    const scrollContainer = rendererRef.current?.closest<HTMLElement>('[data-gantt-scroll-container]');
    if (index < 0 || !scrollContainer) return;
    const layout = calculateTaskLayout(visibleTasks[index], index, startDate, pixelsPerMs);
    const top = Math.max(0, index * ROW_HEIGHT - viewportHeight / 2);
    const left = Math.max(0, layout.x - viewportWidth / 2);
    setPendingFocusTaskId(taskId);
    scrollContainer.scrollTop = top;
    scrollContainer.scrollLeft = left;
    setScrollState(top, left, viewportHeight, viewportWidth);
  }, [visibleTasks, startDate, pixelsPerMs, viewportHeight, viewportWidth, setScrollState]);

  React.useEffect(() => {
    const chart = rendererRef.current?.closest('.gantt-chart-container');
    if (!chart) return;
    const onFocusTask = (event: Event) => focusChartTask((event as CustomEvent<string>).detail);
    chart.addEventListener('gantt-focus-chart-task', onFocusTask);
    return () => chart.removeEventListener('gantt-focus-chart-task', onFocusTask);
  }, [focusChartTask]);

  const openTaskMenu = (taskId: string, isGroup: boolean, trigger: SVGGElement, x: number, y: number) => {
    menuTriggerRef.current = trigger;
    setContextMenuState({ taskId, x, y, isGroup });
  };

  const handleContextMenu = (e: React.MouseEvent<SVGGElement>, taskId: string, isGroup: boolean) => {
    e.preventDefault();
    openTaskMenu(taskId, isGroup, e.currentTarget, e.clientX, e.clientY);
  };

  const closeTaskMenu = () => {
    setContextMenuState(null);
    if (menuTriggerRef.current?.isConnected) menuTriggerRef.current.focus();
  };

  const handleDeleteTask = (taskId: string) => {
    const nextTask = visibleTasks.find(task => task.id !== taskId);
    menuTriggerRef.current = nextTask
      ? Array.from(rendererRef.current?.querySelectorAll<SVGGElement>('[data-chart-task-id]') || [])
        .find(element => element.getAttribute('data-chart-task-id') === nextTask.id)
        || Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-list-task-id]'))
          .find(element => element.getAttribute('data-list-task-id') === nextTask.id)
        || rendererRef.current
      : rendererRef.current;
    deleteTask(taskId);
  };

  const handleTaskKeyDown = (event: React.KeyboardEvent<SVGGElement>, task: GanttTask) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' && linkSourceId) {
      event.preventDefault();
      setLinkSourceId(null);
      setKeyboardMessage('Dependency selection cancelled.');
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const index = visibleTasks.findIndex(candidate => candidate.id === task.id);
      const next = visibleTasks[index + (event.key === 'ArrowDown' ? 1 : -1)];
      if (next) focusChartTask(next.id);
      return;
    }

    if (linkSourceId && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (linkSourceId !== task.id) {
        addDependency(linkSourceId, task.id);
        setKeyboardMessage(`Dependency added to ${task.name}.`);
        setLinkSourceId(null);
      }
      return;
    }

    if ((event.key === 'l' || event.key === 'L') && !event.altKey && !event.ctrlKey && !event.metaKey && task.type !== 'group') {
      event.preventDefault();
      setLinkSourceId(task.id);
      setKeyboardMessage(`Choose a target for ${task.name} with Arrow Up or Arrow Down, then press Enter. Escape cancels.`);
      return;
    }

    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && task.type !== 'group') {
      event.preventDefault();
      const days = event.key === 'ArrowRight' ? 1 : -1;
      if (event.ctrlKey && task.type !== 'milestone') {
        const start = calendar.nextWorkingDay(calendar.addWorkingDays(task.start, days));
        if (start < task.end) updateTask({ ...task, start });
      } else if (event.shiftKey && task.type !== 'milestone') {
        const end = calendar.nextWorkingDay(calendar.addWorkingDays(task.end, days));
        if (end > task.start) updateTask({ ...task, end });
      } else if (!event.ctrlKey && !event.shiftKey) {
        const duration = calendar.workingDaysBetween(task.start, task.end);
        const start = calendar.nextWorkingDay(calendar.addWorkingDays(task.start, days));
        updateTask({ ...task, start, end: calendar.addWorkingDays(start, duration) });
      }
      return;
    }

    if (event.key === 'ArrowLeft' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const chart = rendererRef.current?.closest('.gantt-chart-container');
      const listTask = Array.from((chart || document).querySelectorAll<HTMLTableRowElement>('[data-list-task-id]'))
        .find(element => element.getAttribute('data-list-task-id') === task.id);
      if (listTask) {
        event.preventDefault();
        listTask.focus();
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      openTaskMenu(task.id, task.type === 'group', event.currentTarget, rect.left, rect.bottom);
    }
  };

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const totalMs = endMs - startMs + MS_PER_DAY * 7;
  const width = Math.max(totalMs * pixelsPerMs, 800);
  const height = Math.max(visibleTasks.length * ROW_HEIGHT, 400);

  // Only render rows inside the virtual window
  const { startIndex, endIndex, offsetY } = virtualWindow;

  const slicedTasks = useMemo(() => {
    return visibleTasks.slice(startIndex, endIndex + 1);
  }, [visibleTasks, startIndex, endIndex]);

  // Map only the sliced virtual window rows + apply X-axis culling
  const visibleLayoutTasks = useMemo(() => {
    return slicedTasks.map((task, relativeIdx) => {
      const absoluteIdx = startIndex + relativeIdx;
      const source = draggingTask && draggingTask.id === task.id ? draggingTask : task;
      return calculateTaskLayout(source, absoluteIdx, startDate, pixelsPerMs);
    }).filter(t => isTaskVisible(t.x, t.width, scrollLeft, viewportWidth));
  }, [slicedTasks, draggingTask, startDate, pixelsPerMs, startIndex, scrollLeft, viewportWidth]);

  React.useEffect(() => {
    if (!pendingFocusTaskId) return;
    const rendered = Array.from(rendererRef.current?.querySelectorAll<SVGGElement>('[data-chart-task-id]') || [])
      .find(element => element.getAttribute('data-chart-task-id') === pendingFocusTaskId);
    if (rendered) {
      rendered.focus();
      setPendingFocusTaskId(null);
    }
  }, [pendingFocusTaskId, visibleLayoutTasks]);

  // Grid lines — also virtualized to visible rows only
  const visibleGridLines = visibleTasks
    .slice(startIndex, endIndex + 1)
    .map((_, i) => startIndex + i);

  return (
    <div ref={rendererRef} tabIndex={-1} className="gantt-svg-container" style={{ overflow: 'visible', flexGrow: 1, flexShrink: 0, position: 'relative' }}>
      <div id={keyboardHelpId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
        Use Up and Down to move between chart tasks. Left returns to the task list. Enter opens task actions. Alt with Left or Right moves a task; add Shift to resize its end or Control to resize its start. Press L to link tasks.
      </div>
      <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
        {keyboardMessage}
      </div>
      {/* Spacer to maintain total scroll height */}
      <div style={{ height: virtualWindow.totalHeight, position: 'relative' }}>
        <svg
          className="gantt-svg"
          role="group"
          aria-label="Timeline"
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
                  <g
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={taskAccessibleLabel(t, i18n)}
                    aria-describedby={keyboardHelpId}
                    aria-haspopup="menu"
                    data-chart-task-id={t.id}
                    onKeyDown={event => handleTaskKeyDown(event, t)}
                    onContextMenu={event => handleContextMenu(event, t.id, t.type === 'group')}
                    onFocus={() => setFocusedTaskId(t.id)}
                    onBlur={() => setFocusedTaskId(null)}
                    style={{ outline: focusedTaskId === t.id ? '2px solid var(--gantt-focus, #1d4ed8)' : undefined }}
                  >
                    <foreignObject
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
                  </g>
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
                const ariaLabel = taskAccessibleLabel(t, i18n);

                return (
                  <g 
                    key={t.id} 
                    style={{ cursor: 'move', outline: focusedTaskId === t.id ? '2px solid var(--gantt-focus, #1d4ed8)' : undefined }}
                    onMouseDown={(e) => handleMouseDown(t, 'move')(e)}
                    onContextMenu={(e) => handleContextMenu(e, t.id, false)}
                    onKeyDown={event => handleTaskKeyDown(event, t)}
                    onFocus={() => setFocusedTaskId(t.id)}
                    onBlur={() => setFocusedTaskId(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={ariaLabel}
                    aria-describedby={keyboardHelpId}
                    aria-haspopup="menu"
                    data-task-id={t.id}
                    data-chart-task-id={t.id}
                  >
                    <rect
                      className="gantt-task-drop-zone"
                      x={0}
                      y={localY}
                      width={width}
                      height={ROW_HEIGHT}
                      fill={linkTargetId === t.id ? "rgba(59, 130, 246, 0.1)" : "transparent"}
                      data-task-id={t.id}
                      onMouseEnter={() => setLinkTargetId(t.id)}
                      onMouseLeave={() => setLinkTargetId(null)}
                    />
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
                const ariaLabel = taskAccessibleLabel(t, i18n);
                const taskConflicts = conflicts[t.id];

                return (
                  <g 
                    key={t.id}
                    tabIndex={0}
                    role="button"
                    aria-label={ariaLabel}
                    aria-describedby={keyboardHelpId}
                    aria-haspopup="menu"
                    onContextMenu={(e) => handleContextMenu(e, t.id, true)}
                    onKeyDown={event => handleTaskKeyDown(event, t)}
                    onFocus={() => setFocusedTaskId(t.id)}
                    onBlur={() => setFocusedTaskId(null)}
                    style={{ outline: focusedTaskId === t.id ? '2px solid var(--gantt-focus, #1d4ed8)' : undefined }}
                    data-task-id={t.id}
                    data-chart-task-id={t.id}
                  >
                    <rect
                      className="gantt-task-drop-zone"
                      x={0}
                      y={localY}
                      width={width}
                      height={ROW_HEIGHT}
                      fill={linkTargetId === t.id ? "rgba(59, 130, 246, 0.1)" : "transparent"}
                      data-task-id={t.id}
                      onMouseEnter={() => setLinkTargetId(t.id)}
                      onMouseLeave={() => setLinkTargetId(null)}
                    />
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
              const ariaLabel = taskAccessibleLabel(t, i18n);

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
                    style={{ cursor: 'move', outline: focusedTaskId === t.id ? '2px solid var(--gantt-focus, #1d4ed8)' : undefined }}
                    onMouseDown={(e) => handleMouseDown(t, 'move')(e)}
                    onMouseEnter={() => setHoveredTaskId(t.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onContextMenu={(e) => handleContextMenu(e, t.id, false)}
                    onKeyDown={event => handleTaskKeyDown(event, t)}
                    onFocus={() => setFocusedTaskId(t.id)}
                    onBlur={() => setFocusedTaskId(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={ariaLabel}
                    aria-describedby={keyboardHelpId}
                    aria-haspopup="menu"
                    data-task-id={t.id}
                    data-chart-task-id={t.id}
                  >
                    <rect
                      className="gantt-task-drop-zone"
                      x={0}
                      y={localY}
                      width={width}
                      height={ROW_HEIGHT}
                      fill={linkTargetId === t.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}
                      data-task-id={t.id}
                      onMouseEnter={() => setLinkTargetId(t.id)}
                      onMouseLeave={() => setLinkTargetId(null)}
                    />
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
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(t, 'resize-left')(e); }}
                    />
                    <rect
                      x={t.x + t.width - 6}
                      y={localY + (ROW_HEIGHT - t.height) / 2}
                      width={6}
                      height={t.height}
                      fill="transparent"
                      style={{ cursor: 'col-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(t, 'resize-right')(e); }}
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
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(t, 'link')(e); }}
                    />
                    <text x={t.x + 8} y={localY + ROW_HEIGHT / 2 + 4} fill="var(--gantt-task-text, #ffffff)" fontSize="12" pointerEvents="none">
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

      {contextMenuState && (() => {
        const targetTask = visibleTasks.find(t => t.id === contextMenuState.taskId);
        return (
          <ContextMenu
            x={contextMenuState.x}
            y={contextMenuState.y}
            onClose={closeTaskMenu}
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
                  setLinkSourceId(contextMenuState.taskId);
                  setKeyboardMessage(`Choose a target for ${targetTask?.name || 'this task'} with Arrow Up or Arrow Down, then press Enter. Escape cancels.`);
                }
              }] : []),
              ...(targetTask?.slug ? [{
                id: 'navigate',
                label: 'Navigate',
                onClick: () => {
                  if (onTaskNavigate && targetTask) {
                    onTaskNavigate(targetTask);
                  } else if (targetTask?.slug && isSafeTaskDestination(targetTask.slug, window.location.href)) {
                    window.location.href = targetTask.slug;
                  }
                }
              }] : []),
              {
                id: 'delete',
                label: i18n.strings.deleteTask || 'Delete Task',
                variant: 'danger',
                onClick: () => {
                  handleDeleteTask(contextMenuState.taskId);
                }
              }
            ]}
          />
        );
      })()}
    </div>
  );
};
