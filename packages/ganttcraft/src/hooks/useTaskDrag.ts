import { useState, useCallback, useRef } from 'react';
import { GanttTask } from '../types';
import { PIXELS_PER_DAY, MS_PER_DAY } from '../engine/layout';
import { WorkingCalendar, AllDayCalendar } from '../engine/calendar';

export type DragMode = 'move' | 'resize-left' | 'resize-right' | 'link';

interface UseTaskDragOptions {
  onTaskUpdate?: (task: GanttTask) => void;
  onLinkCreate?: (sourceId: string, targetId: string) => void;
  /** Working calendar used to snap move-drag dates to working days. Defaults to AllDayCalendar (24/7). */
  calendar?: WorkingCalendar;
}

export function useTaskDrag({ onTaskUpdate, onLinkCreate, calendar = AllDayCalendar }: UseTaskDragOptions) {
  const [draggingTask, setDraggingTask] = useState<GanttTask | null>(null);
  const draggingTaskRef = useRef<GanttTask | null>(null);
  
  const [linkState, setLinkState] = useState<{ sourceId: string; cursorX: number; cursorY: number } | null>(null);
  const linkStateRef = useRef<{ sourceId: string; cursorX: number; cursorY: number } | null>(null);
  const linkTargetIdRef = useRef<string | null>(null);

  const setLinkTargetId = useCallback((id: string | null) => {
    linkTargetIdRef.current = id;
  }, []);

  const dragStateRef = useRef<{
    startX: number;
    initialTask: GanttTask;
    mode: DragMode;
  } | null>(null);

  const handleMouseDown = useCallback((task: GanttTask, mode: DragMode) => (e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    
    if (mode === 'link') {
      const newLinkState = { sourceId: task.id, cursorX: e.clientX, cursorY: e.clientY };
      setLinkState(newLinkState);
      linkStateRef.current = newLinkState;
      linkTargetIdRef.current = null;
      dragStateRef.current = { startX: e.clientX, initialTask: { ...task }, mode };
    } else {
      dragStateRef.current = {
        startX: e.clientX,
        initialTask: { ...task },
        mode,
      };
      setDraggingTask(task);
      draggingTaskRef.current = task;
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStateRef.current) return;
      
      const { startX, initialTask, mode } = dragStateRef.current;
      
      if (mode === 'link') {
        const updatedLinkState = { 
          sourceId: initialTask.id, 
          cursorX: moveEvent.clientX, 
          cursorY: moveEvent.clientY 
        };
        setLinkState(updatedLinkState);
        linkStateRef.current = updatedLinkState;
        return;
      }

      const deltaX = moveEvent.clientX - startX;
      
      // Calculate days delta based on pixels per day
      // Round to nearest day for snapping
      const daysDelta = Math.round(deltaX / PIXELS_PER_DAY);
      const msDelta = daysDelta * MS_PER_DAY;

      const updated = { ...initialTask };
        
      if (mode === 'move') {
        // Use calendar-aware working-day addition for moves
        const duration = initialTask.end.getTime() - initialTask.start.getTime();
        updated.start = calendar.addWorkingDays(initialTask.start, daysDelta);
        updated.end = new Date(updated.start.getTime() + duration);
      } else if (mode === 'resize-left') {
        const newStartMs = initialTask.start.getTime() + msDelta;
        // Prevent negative duration
        if (newStartMs < initialTask.end.getTime()) {
          updated.start = new Date(newStartMs);
        }
      } else if (mode === 'resize-right') {
        const newEndMs = initialTask.end.getTime() + msDelta;
        if (newEndMs > initialTask.start.getTime()) {
          updated.end = new Date(newEndMs);
        }
      }
      
      setDraggingTask(updated);
      draggingTaskRef.current = updated;
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      const initial = dragStateRef.current?.initialTask;
      const mode = dragStateRef.current?.mode;
      const finalTask = draggingTaskRef.current;
      
      if (mode === 'link') {
        const targetId = linkTargetIdRef.current;
        if (targetId && initial && targetId !== initial.id && onLinkCreate) {
          onLinkCreate(initial.id, targetId);
        }
        setLinkState(null);
        linkStateRef.current = null;
        linkTargetIdRef.current = null;
      } else if (finalTask && onTaskUpdate && initial) {
        // If the task actually changed
        if (initial.start.getTime() !== finalTask.start.getTime() || initial.end.getTime() !== finalTask.end.getTime()) {
           onTaskUpdate(finalTask);
        }
      }
      
      setDraggingTask(null);
      draggingTaskRef.current = null;
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onTaskUpdate, onLinkCreate, calendar]);

  return {
    draggingTask,
    handleMouseDown,
    linkState,
    setLinkTargetId,
  };
}

