import React, { useMemo } from 'react';
import { useGanttContext } from '../components/GanttProvider';
import { calculateTaskLayout, ROW_HEIGHT } from '../engine/layout';
import { LayoutTask, TaskDependency } from '../types';

const MILESTONE_SIZE = 12; // Must match SVGRenderer diamond half-size

function renderPath(source: LayoutTask, target: LayoutTask, type: TaskDependency['type']): string {
  const midSource = source.x + source.width / 2;
  const midTarget = target.x + target.width / 2;

  let startX: number;
  let endX: number;

  // Determine connection points based on dependency type
  if (type === 'SS' || type === 'SF') {
    startX = source.type === 'milestone' ? midSource - MILESTONE_SIZE : source.x;
  } else {
    startX = source.type === 'milestone' ? midSource + MILESTONE_SIZE : source.x + source.width;
  }

  if (type === 'FF' || type === 'SF') {
    endX = target.type === 'milestone' ? midTarget + MILESTONE_SIZE : target.x + target.width;
  } else {
    endX = target.type === 'milestone' ? midTarget - MILESTONE_SIZE : target.x;
  }

  const startY = source.y + ROW_HEIGHT / 2;
  const endY = target.y + ROW_HEIGHT / 2;
  const STUB = 10; // horizontal stub length

  // 1. Genuine Forward (Target is safely to the right)
  if (endX >= startX + STUB) {
    return [
      `M ${startX} ${startY}`,
      `L ${startX + STUB} ${startY}`,
      `L ${startX + STUB} ${endY}`,
      `L ${endX} ${endY}`
    ].join(' ');
  }

  // 2 & 3. Close or Backward Dependency
  if (source.y === target.y) {
    // Same row: We must route around the task bar to avoid cutting through it.
    // Route below the task row.
    const safeY = source.y + ROW_HEIGHT + ROW_HEIGHT / 2; 
    return [
      `M ${startX} ${startY}`,
      `L ${startX + STUB} ${startY}`,
      `L ${startX + STUB} ${safeY}`,
      `L ${endX - STUB} ${safeY}`,
      `L ${endX - STUB} ${endY}`,
      `L ${endX} ${endY}`
    ].join(' ');
  } else {
    // Different rows: Route precisely through the boundary (midpoint) between them.
    // This weaves the line through the natural "alley" and avoids U-turns.
    const midY = (source.y + target.y) / 2 + ROW_HEIGHT / 2;
    return [
      `M ${startX} ${startY}`,
      `L ${startX + STUB} ${startY}`,
      `L ${startX + STUB} ${midY}`,
      `L ${endX - STUB} ${midY}`,
      `L ${endX - STUB} ${endY}`,
      `L ${endX} ${endY}`
    ].join(' ');
  }
}


export interface DependencyLayerProps {
  linkState?: { sourceId: string; cursorX: number; cursorY: number } | null;
}

export const DependencyLayer: React.FC<DependencyLayerProps> = ({ linkState }) => {
  const { visibleTasks, startDate, showCriticalPath, pixelsPerMs, virtualWindow, viewportHeight } = useGanttContext();
  const { offsetY } = virtualWindow;

  const layoutTasksMap = useMemo(() => {
    const map = new Map<string, LayoutTask>();
    // Store viewport-local Y (= absolute Y - offsetY) to match SVGRenderer's localY = t.y - offsetY.
    // Paths live inside <g transform={`translate(0, ${offsetY})`}>, so using absolute Y would
    // shift arrows down by offsetY when scrolled.
    visibleTasks.forEach((t, i) => {
      const layout = calculateTaskLayout(t, i, startDate, pixelsPerMs);
      map.set(t.id, { ...layout, y: layout.y - offsetY });
    });
    return map;
  }, [visibleTasks, startDate, pixelsPerMs, offsetY]);

  const paths = useMemo(() => {
    const elements: React.ReactNode[] = [];
    visibleTasks.forEach((task) => {
      task.dependencies?.forEach((dep) => {
        const source = layoutTasksMap.get(dep.id);
        const target = layoutTasksMap.get(task.id);
        if (source && target) {
          const localMinY = Math.min(source.y, target.y);
          const localMaxY = Math.max(source.y, target.y);
          const buffer = ROW_HEIGHT * 2; // Buffer for STUB routing
          
          if (localMaxY + buffer < 0 || localMinY - buffer > viewportHeight) {
            return;
          }

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
  }, [visibleTasks, layoutTasksMap, showCriticalPath, viewportHeight]);

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
          orient="auto"
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
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--gantt-critical, #ef4444)" />
        </marker>
      </defs>
      {paths}
      {linkState && (() => {
        const source = layoutTasksMap.get(linkState.sourceId);
        if (!source) return null;
        const startX = source.type === 'milestone'
          ? source.x + source.width / 2 + MILESTONE_SIZE
          : source.x + source.width;
        // source.y is already viewport-local (offsetY already subtracted in layoutTasksMap)
        const startY = source.y + ROW_HEIGHT / 2;
        const endX = linkState.cursorX;
        const endY = linkState.cursorY - offsetY;
        const STUB = 10;
        
        return (
          <path
            d={`M ${startX} ${startY} L ${startX + STUB} ${startY} L ${startX + STUB} ${endY} L ${endX} ${endY}`}
            fill="none"
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
