import { GanttTask, LayoutTask, ViewMode } from '../types';

export const PIXELS_PER_DAY = 50;
export const ROW_HEIGHT = 40;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Maps a ViewMode zoom level to a pixels-per-millisecond scale factor. */
export function viewModeToPixelsPerMs(viewMode: ViewMode): number {
  switch (viewMode) {
    case 'day':     return PIXELS_PER_DAY / MS_PER_DAY;
    case 'week':    return (PIXELS_PER_DAY * 7) / (MS_PER_DAY * 7 * 7);   // ~1/7 of day
    case 'month':   return (PIXELS_PER_DAY * 30) / (MS_PER_DAY * 30 * 30); // ~1/30 of day
    case 'quarter': return (PIXELS_PER_DAY * 90) / (MS_PER_DAY * 90 * 90); // ~1/90 of day
    case 'year':    return (PIXELS_PER_DAY * 365) / (MS_PER_DAY * 365 * 365); // ~1/365 of day
  }
}

/**
 * Converts a Date to an SVG pixel X-coordinate relative to the timeline start.
 * This is the canonical date-to-pixel function for the GanttCraft rendering pipeline.
 * All renderers must use this function — do NOT inline this arithmetic elsewhere.
 *
 * @param date - The date to convert.
 * @param timelineStart - The leftmost date of the visible timeline (x=0).
 * @param pixelsPerMs - Scale factor from `viewModeToPixelsPerMs`.
 * @returns Pixel offset from the left edge of the timeline SVG.
 */
export function dateToPixelX(date: Date, timelineStart: Date, pixelsPerMs: number): number {
  return (date.getTime() - timelineStart.getTime()) * pixelsPerMs;
}

export function calculateTaskLayout(
  task: GanttTask,
  index: number,
  timelineStart: Date,
  pixelsPerMs: number = PIXELS_PER_DAY / MS_PER_DAY
): LayoutTask {
  const x = dateToPixelX(task.start, timelineStart, pixelsPerMs);
  const xEnd = dateToPixelX(task.end, timelineStart, pixelsPerMs);
  
  const width = xEnd - x;
  const y = index * ROW_HEIGHT;

  return {
    ...task,
    x,
    y,
    width: Math.max(width, 1), // ensure min width
    height: ROW_HEIGHT * 0.8 // slight padding inside the row
  };
}
