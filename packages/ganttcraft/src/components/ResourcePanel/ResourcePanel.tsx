import React, { useMemo } from 'react';
import { useGanttContext } from '../GanttProvider';
import { calculateResourceUtilization } from '../../engine/resource';
import { MS_PER_DAY } from '../../engine/layout';
import { GanttTask } from '../../types';

interface ResourceRowProps {
  resId: string;
  tasks: GanttTask[];
  startMs: number;
  days: number;
  pixelsPerMs: number;
  yOffset: number;
}

const ResourceRow = React.memo(({ resId, tasks, startMs, days, pixelsPerMs, yOffset }: ResourceRowProps) => {
  const utilizations = useMemo(() => {
    const utils = new Float32Array(days);
    for (let i = 0; i < days; i++) {
      const dayDate = new Date(startMs + i * MS_PER_DAY);
      utils[i] = calculateResourceUtilization(tasks, resId, dayDate);
    }
    return utils;
  }, [tasks, resId, startMs, days]);

  const elements = [];
  


  for (let i = 0; i < days; i++) {
    const util = utilizations[i];
    if (util > 0) {
      const isOverAllocated = util > 1;
      const x = i * MS_PER_DAY * pixelsPerMs;
      const barWidth = MS_PER_DAY * pixelsPerMs;
      const barHeight = Math.min(util * 20, 40);
      elements.push(
        <rect
          key={`${resId}-${i}`}
          x={x}
          y={yOffset + 40 - barHeight}
          width={barWidth}
          height={barHeight}
          fill={isOverAllocated ? 'var(--gantt-critical, #ef4444)' : 'var(--gantt-task-fill, #3b82f6)'}
          opacity={0.8}
        />
      );
    }
  }
  
  return <g>{elements}</g>;
}, (prev, next) => {
  if (prev.startMs !== next.startMs ||
      prev.days !== next.days ||
      prev.pixelsPerMs !== next.pixelsPerMs ||
      prev.yOffset !== next.yOffset) {
    return false;
  }
  if (prev.tasks === next.tasks) return true;
  if (prev.tasks.length !== next.tasks.length) {
    return false;
  }
  for (let i = 0; i < prev.tasks.length; i++) {
    const p = prev.tasks[i];
    const n = next.tasks[i];
    if (p.start.getTime() !== n.start.getTime()) {
      return false;
    }
    if (p.end.getTime() !== n.end.getTime()) {
      return false;
    }
    if (p.assignments !== n.assignments) {
      return false;
    }
  }
  return true;
});

export const ResourcePanel: React.FC = () => {
  const { tasks, startDate, endDate, pixelsPerMs, showResourcePanel } = useGanttContext();

  // NOTE: All hooks must be called unconditionally before any early return (Rules of Hooks).
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const totalMs = endMs - startMs + MS_PER_DAY * 7;

  // Find unique resources — must be called before the early return guard
  const resources = useMemo(() => {
    const res = new Set<string>();
    tasks.forEach(t => {
      t.assignments?.forEach(a => res.add(a.resourceId));
    });
    return Array.from(res);
  }, [tasks]);

  if (!showResourcePanel) return null;

  const width = Math.max(totalMs * pixelsPerMs, 800);
  const height = Math.max(resources.length * 50, 150); // Dynamic height based on resources

  const days = Math.ceil(totalMs / MS_PER_DAY);
  
  return (
    <div 
      className="gantt-resource-panel" 
      style={{ 
        height, 
        width, 
        borderTop: '2px solid var(--gantt-border, #eee)',
        position: 'relative',
        backgroundColor: 'var(--gantt-bg, #f9f9f9)'
      }}
    >
      <svg width={width} height={height} style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}>
        {resources.map((resId, rIdx) => (
          <ResourceRow
            key={resId}
            resId={resId}
            tasks={tasks}
            startMs={startMs}
            days={days}
            pixelsPerMs={pixelsPerMs}
            yOffset={rIdx * 50}
          />
        ))}
      </svg>
    </div>
  );
};
