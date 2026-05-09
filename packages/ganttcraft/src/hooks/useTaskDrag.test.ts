import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskDrag } from './useTaskDrag';
import { PIXELS_PER_DAY } from '../engine/layout';
import { GanttTask } from '../types';
import { AllDayCalendar, StandardCalendar } from '../engine/calendar';

describe('useTaskDrag', () => {
  it('updates dates based on drag delta', () => {
    const onTaskUpdate = vi.fn();
    const task: GanttTask = { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-03T00:00:00Z') };

    const { result } = renderHook(() => useTaskDrag({ onTaskUpdate }));

    // Mock mouse events
    act(() => {
      result.current.handleMouseDown(task, 'move')({ clientX: 0, stopPropagation: () => {} } as any);
    });
    
    act(() => {
      // Simulate moving exactly 1 day to the right
      const moveEvent = new Event('mousemove') as any;
      moveEvent.clientX = PIXELS_PER_DAY;
      window.dispatchEvent(moveEvent);
    });

    act(() => {
      window.dispatchEvent(new Event('mouseup'));
    });


    expect(onTaskUpdate).toHaveBeenCalled();
    const updatedTask = onTaskUpdate.mock.calls[0][0];
    
    // Start and end should be shifted by 1 day
    expect(updatedTask.start).toEqual(new Date('2024-01-02T00:00:00Z'));
    expect(updatedTask.end).toEqual(new Date('2024-01-04T00:00:00Z'));
  });
});

describe('useTaskDrag with WorkingCalendar (CR-1.A.5 + CR-1.A.6)', () => {
  it('AllDayCalendar — move drag of 1 day shifts start +1 raw calendar day', () => {
    const onTaskUpdate = vi.fn();
    // 2024-01-01 (Mon)
    const task: GanttTask = { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-03T00:00:00Z') };

    const { result } = renderHook(() => useTaskDrag({ onTaskUpdate, calendar: AllDayCalendar }));

    act(() => {
      result.current.handleMouseDown(task, 'move')({ clientX: 0, stopPropagation: () => {} } as any);
    });
    act(() => {
      const moveEvent = new Event('mousemove') as any;
      moveEvent.clientX = PIXELS_PER_DAY; // exactly 1 day right
      window.dispatchEvent(moveEvent);
    });
    act(() => { window.dispatchEvent(new Event('mouseup')); });

    expect(onTaskUpdate).toHaveBeenCalled();
    const updatedTask = onTaskUpdate.mock.calls[0][0];
    // AllDayCalendar: +1 day raw ms → 2024-01-02
    expect(updatedTask.start).toEqual(new Date('2024-01-02T00:00:00Z'));
    expect(updatedTask.end).toEqual(new Date('2024-01-04T00:00:00Z'));
  });

  it('StandardCalendar — move drag of 2 days from Friday lands on Tuesday (skips weekend)', () => {
    const onTaskUpdate = vi.fn();
    // 2024-01-05 is a Friday; drag +2 working days → Mon (1) + Tue (2) = 2024-01-09 (Tue)
    const task: GanttTask = {
      id: '1', name: 'T1',
      start: new Date('2024-01-05T00:00:00Z'), // Friday
      end: new Date('2024-01-08T00:00:00Z'),   // Mon (3 calendar days)
    };

    const { result } = renderHook(() => useTaskDrag({ onTaskUpdate, calendar: StandardCalendar }));

    act(() => {
      result.current.handleMouseDown(task, 'move')({ clientX: 0, stopPropagation: () => {} } as any);
    });
    act(() => {
      const moveEvent = new Event('mousemove') as any;
      moveEvent.clientX = 2 * PIXELS_PER_DAY; // 2 working days right
      window.dispatchEvent(moveEvent);
    });
    act(() => { window.dispatchEvent(new Event('mouseup')); });

    expect(onTaskUpdate).toHaveBeenCalled();
    const updatedTask = onTaskUpdate.mock.calls[0][0];
    // StandardCalendar: Fri + 2 working days = Mon (1) + Tue (2) = Tue 2024-01-09
    expect(updatedTask.start).toEqual(new Date('2024-01-09T00:00:00Z'));
  });

  it('resize-left — cannot produce start >= end', () => {
    const onTaskUpdate = vi.fn();
    const task: GanttTask = { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-03T00:00:00Z') };

    const { result } = renderHook(() => useTaskDrag({ onTaskUpdate }));

    act(() => {
      result.current.handleMouseDown(task, 'resize-left')({ clientX: 0, stopPropagation: () => {} } as any);
    });
    act(() => {
      // Drag so far right that start would exceed end (+100 days)
      const moveEvent = new Event('mousemove') as any;
      moveEvent.clientX = 100 * PIXELS_PER_DAY;
      window.dispatchEvent(moveEvent);
    });
    act(() => { window.dispatchEvent(new Event('mouseup')); });

    // onTaskUpdate should NOT be called if position didn't actually change from initial
    // OR if called, start must be < end
    if (onTaskUpdate.mock.calls.length > 0) {
      const updatedTask = onTaskUpdate.mock.calls[0][0];
      expect(updatedTask.start.getTime()).toBeLessThan(updatedTask.end.getTime());
    }
  });

  it('resize-right — cannot produce end <= start', () => {
    const onTaskUpdate = vi.fn();
    const task: GanttTask = { id: '1', name: 'T1', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-07T00:00:00Z') };

    const { result } = renderHook(() => useTaskDrag({ onTaskUpdate }));

    act(() => {
      result.current.handleMouseDown(task, 'resize-right')({ clientX: 0, stopPropagation: () => {} } as any);
    });
    act(() => {
      // Drag far left so end would go before start (-100 days)
      const moveEvent = new Event('mousemove') as any;
      moveEvent.clientX = -100 * PIXELS_PER_DAY;
      window.dispatchEvent(moveEvent);
    });
    act(() => { window.dispatchEvent(new Event('mouseup')); });

    // If onTaskUpdate was called, end must be > start
    if (onTaskUpdate.mock.calls.length > 0) {
      const updatedTask = onTaskUpdate.mock.calls[0][0];
      expect(updatedTask.end.getTime()).toBeGreaterThan(updatedTask.start.getTime());
    }
  });
});

describe('useTaskDrag link mode (CR-3.A.1)', () => {
  it('calls onLinkCreate with (sourceId, targetId) on mouseup over valid target', () => {
    const onLinkCreate = vi.fn();
    const task: GanttTask = { id: 't1', name: 'T1', start: new Date('2024-01-01'), end: new Date('2024-01-03') };

    const { result } = renderHook(() => useTaskDrag({ onLinkCreate }));

    act(() => {
      // Cast 'link' to any to avoid TS error before DragMode is updated
      result.current.handleMouseDown(task, 'link' as any)({ clientX: 10, clientY: 20, stopPropagation: () => {} } as any);
    });

    // Check linkState is active
    expect(result.current.linkState).toEqual({ sourceId: 't1', cursorX: 10, cursorY: 20 });

    act(() => {
      // Mouse move
      const moveEvent = new Event('mousemove') as any;
      moveEvent.clientX = 50;
      moveEvent.clientY = 60;
      window.dispatchEvent(moveEvent);
    });

    // linkState should update
    expect(result.current.linkState).toEqual({ sourceId: 't1', cursorX: 50, cursorY: 60 });

    act(() => {
      // Simulate setting targetId via hover
      if (result.current.setLinkTargetId) {
        result.current.setLinkTargetId('t2');
      }
    });

    act(() => {
      window.dispatchEvent(new Event('mouseup'));
    });

    expect(onLinkCreate).toHaveBeenCalledWith('t1', 't2');
    expect(result.current.linkState).toBeNull();
  });

  it('does NOT call onLinkCreate for self-link (sourceId === targetId)', () => {
    const onLinkCreate = vi.fn();
    const task: GanttTask = { id: 't1', name: 'T1', start: new Date('2024-01-01'), end: new Date('2024-01-03') };

    const { result } = renderHook(() => useTaskDrag({ onLinkCreate }));

    act(() => {
      result.current.handleMouseDown(task, 'link' as any)({ clientX: 10, clientY: 20, stopPropagation: () => {} } as any);
    });

    act(() => {
      if (result.current.setLinkTargetId) {
        result.current.setLinkTargetId('t1'); // self
      }
    });

    act(() => {
      window.dispatchEvent(new Event('mouseup'));
    });

    expect(onLinkCreate).not.toHaveBeenCalled();
    expect(result.current.linkState).toBeNull();
  });
});

