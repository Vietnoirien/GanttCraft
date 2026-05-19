import React, { useMemo } from 'react';
import { useGanttContext } from '../components/GanttProvider';
import { calculateTaskLayout, ROW_HEIGHT } from '../engine/layout';
import { LayoutTask, TaskDependency } from '../types';

function renderPath(source: LayoutTask, target: LayoutTask, _type: TaskDependency['type']): string {
  // Simple orthogonal routing
  const startX = source.x + source.width;
  const startY = source.y + ROW_HEIGHT / 2;
  const endX = target.x;
  const endY = target.y + ROW_HEIGHT / 2;

  // Draw line from right edge of source, then down/up, then to left edge of target
  return `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${endY} L ${endX} ${endY}`;
}

export interface DependencyLayerProps {
  linkState?: { sourceId: string; cursorX: number; cursorY: number } | null;
}

export const DependencyLayer: React.FC<DependencyLayerProps> = ({ linkState }) => {
  const { tasks, startDate, showCriticalPath, pixelsPerMs, virtualWindow } = useGanttContext();
  const { offsetY } = virtualWindow;

  const layoutTasksMap = useMemo(() => {
    const map = new Map<string, LayoutTask>();
    tasks.forEach((t, i) => map.set(t.id, calculateTaskLayout(t, i, startDate, pixelsPerMs)));
    return map;
  }, [tasks, startDate, pixelsPerMs]);

  const paths = useMemo(() => {
    const elements: React.ReactNode[] = [];
    tasks.forEach((task) => {
      task.dependencies?.forEach((dep) => {
        const source = layoutTasksMap.get(dep.id);
        const target = layoutTasksMap.get(task.id);
        if (source && target) {
          const isCritical = showCriticalPath && target.float !== undefined && target.float <= 0;
          const color = isCritical ? 'var(--gantt-critical, #ef4444)' : '#cbd5e1';
          const markerId = isCritical ? 'url(#arrow-critical)' : 'url(#arrow)';
          
          const d = renderPath(source, target, dep.type);
          elements.push(
            <path
              key={`${source.id}-${target.id}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="2"
              markerEnd={markerId}
            />
          );
        }
      });
    });
    return elements;
  }, [tasks, layoutTasksMap, showCriticalPath]);

  return (
    <g className="dependency-layer">
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker
          id="arrow-critical"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--gantt-critical, #ef4444)" />
        </marker>
      </defs>
      {paths}
      {linkState && (() => {
        const source = layoutTasksMap.get(linkState.sourceId);
        if (!source) return null;
        const startX = source.x + source.width;
        const startY = source.y + ROW_HEIGHT / 2;
        return (
          <line
            x1={startX}
            y1={startY}
            x2={linkState.cursorX}
            y2={linkState.cursorY - offsetY}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="2"
            pointerEvents="none"
          />
        );
      })()}
    </g>
  );
};
