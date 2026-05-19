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
  const [linkTargetId, setLinkTargetIdState] = useState<string | null>(null);
  const linkTargetIdRef = useRef<string | null>(null);

  const setLinkTargetId = useCallback((id: string | null) => {
    linkTargetIdRef.current = id;
    setLinkTargetIdState(id);
  }, []);

  const dragStateRef = useRef<{
    startX: number;
    initialTask: GanttTask;
    mode: DragMode;
    svgElement?: SVGSVGElement | null;
  } | null>(null);

  const handleMouseDown = useCallback((task: GanttTask, mode: DragMode) => (e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    let svgElement: SVGSVGElement | null = null;
    if (e.currentTarget) {
      const target = e.currentTarget as any;
      svgElement = target.ownerSVGElement || (target.tagName === 'svg' ? target : null);
    }

    if (mode === 'link') {
      let cursorX = e.clientX;
      let cursorY = e.clientY;
      if (svgElement) {
        if (typeof svgElement.createSVGPoint === 'function' && typeof svgElement.getScreenCTM === 'function') {
          const pt = svgElement.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const ctm = svgElement.getScreenCTM();
          if (ctm) {
            const transformed = pt.matrixTransform(ctm.inverse());
            cursorX = transformed.x;
            cursorY = transformed.y;
          } else {
            const rect = svgElement.getBoundingClientRect();
            cursorX = e.clientX - rect.left;
            cursorY = e.clientY - rect.top;
          }
        } else {
          const rect = typeof svgElement.getBoundingClientRect === 'function' ? svgElement.getBoundingClientRect() : { left: 0, top: 0 };
          cursorX = e.clientX - rect.left;
          cursorY = e.clientY - rect.top;
        }
      }
      const newLinkState = { sourceId: task.id, cursorX, cursorY };
      setLinkState(newLinkState);
      linkStateRef.current = newLinkState;
      setLinkTargetId(null);
      dragStateRef.current = { startX: e.clientX, initialTask: { ...task }, mode, svgElement };
    } else {
      dragStateRef.current = {
        startX: e.clientX,
        initialTask: { ...task },
        mode,
        svgElement,
      };
      setDraggingTask(task);
      draggingTaskRef.current = task;
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStateRef.current) return;
      
      const { startX, initialTask, mode, svgElement } = dragStateRef.current;
      
      if (mode === 'link') {
        let cursorX = moveEvent.clientX;
        let cursorY = moveEvent.clientY;
        if (svgElement) {
          if (typeof svgElement.createSVGPoint === 'function' && typeof svgElement.getScreenCTM === 'function') {
            const pt = svgElement.createSVGPoint();
            pt.x = moveEvent.clientX;
            pt.y = moveEvent.clientY;
            const ctm = svgElement.getScreenCTM();
            if (ctm) {
              const transformed = pt.matrixTransform(ctm.inverse());
              cursorX = transformed.x;
              cursorY = transformed.y;
            } else {
              const rect = svgElement.getBoundingClientRect();
              cursorX = moveEvent.clientX - rect.left;
              cursorY = moveEvent.clientY - rect.top;
            }
          } else {
            const rect = typeof svgElement.getBoundingClientRect === 'function' ? svgElement.getBoundingClientRect() : { left: 0, top: 0 };
            cursorX = moveEvent.clientX - rect.left;
            cursorY = moveEvent.clientY - rect.top;
          }
        }
        const updatedLinkState = { 
          sourceId: initialTask.id, 
          cursorX, 
          cursorY 
        };
        setLinkState(updatedLinkState);
        linkStateRef.current = updatedLinkState;

        // Detect hover target using elementFromPoint
        if (typeof document.elementFromPoint === 'function') {
          const elem = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          if (elem) {
            const dropZone = elem.closest('.gantt-task-drop-zone, [data-task-id]');
            if (dropZone) {
              const targetId = dropZone.getAttribute('data-task-id');
              setLinkTargetId(targetId);
            } else {
              setLinkTargetId(null);
            }
          } else {
            setLinkTargetId(null);
          }
        }
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
        setLinkTargetId(null);
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
  }, [onTaskUpdate, onLinkCreate, calendar, setLinkTargetId]);

  return {
    draggingTask,
    handleMouseDown,
    linkState,
    linkTargetId,
    setLinkTargetId,
  };
}

