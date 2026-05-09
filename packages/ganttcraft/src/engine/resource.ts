import { GanttTask } from '../types';

/**
 * Calculates the total utilization of a specific resource on a specific date.
 * Intersects all tasks to find overlaps.
 */
export function calculateResourceUtilization(
  tasks: GanttTask[],
  resourceId: string,
  date: Date
): number {
  let totalUtilization = 0;
  const time = date.getTime();

  tasks.forEach(task => {
    // Check if task is active during this date
    // Note: this assumes date is within [start, end)
    if (time >= task.start.getTime() && time < task.end.getTime()) {
      const assignment = task.assignments?.find(a => a.resourceId === resourceId);
      if (assignment) {
        totalUtilization += assignment.units;
      }
    }
  });

  return totalUtilization;
}
