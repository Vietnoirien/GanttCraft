import { useCallback } from 'react';
import { GanttTask } from '../types';

export interface TaskInteractions {
  onTaskClick?: (task: GanttTask) => void;
  onTaskDoubleClick?: (task: GanttTask) => void;
}

export function useTaskInteractions({ onTaskClick, onTaskDoubleClick }: TaskInteractions) {
  const handleClick = useCallback(
    (task: GanttTask) => {
      onTaskClick?.(task);
    },
    [onTaskClick]
  );

  const handleDoubleClick = useCallback(
    (task: GanttTask) => {
      onTaskDoubleClick?.(task);
    },
    [onTaskDoubleClick]
  );

  return {
    handleClick,
    handleDoubleClick,
  };
}
