import { GanttTask, GanttResource } from '../types';
import { cascadeSchedule } from './scheduler';
import { WorkingCalendar, AllDayCalendar } from './calendar';

/**
 * Resolves resource overallocation by delaying non-critical tasks.
 *
 * **Algorithm: Greedy ALAP Shift**
 * 1. For each resource, build a timeline of assigned tasks sorted by start date.
 * 2. Detect periods where the sum of assigned units exceeds the resource's maxUnits (default 1.0).
 * 3. In each conflict, delay the non-critical task (float > 0) to start after the conflicting task ends.
 * 4. Propagate the delay through the dependency graph via cascadeSchedule.
 *
 * **Scope:** Single-resource conflicts only. Multi-resource deadlocks are not resolved.
 * **Limitation:** Does not perform ILP optimization. Result may not be globally optimal.
 *
 * @param tasks - All project tasks with `assignments` and `float` populated.
 * @param resources - Resource definitions with optional `maxUnits`.
 * @param calendar - Working calendar for date arithmetic. Defaults to AllDayCalendar.
 * @returns A new task array with non-critical tasks delayed to resolve overallocation.
 */
export function levelResources(
  tasks: GanttTask[],
  resources: GanttResource[],
  calendar: WorkingCalendar = AllDayCalendar,
): GanttTask[] {
  let currentTasks = [...tasks];
  const maxIterations = currentTasks.length * 2;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    let hasConflict = false;

    // Check each resource independently
    for (const resource of resources) {
      const maxUnits = resource.maxUnits ?? 1.0;

      // Find all tasks assigned to this resource
      const assignedTasks = currentTasks.filter(t => 
        t.assignments?.some(a => a.resourceId === resource.id)
      );

      if (assignedTasks.length < 2) continue;

      // Sort by start date (Earliest Start)
      assignedTasks.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Find first conflict
      let conflictFound = false;
      for (let i = 0; i < assignedTasks.length; i++) {
        const taskA = assignedTasks[i];
        let overlappingUnits = taskA.assignments!.find(a => a.resourceId === resource.id)!.units;
        
        let j = i + 1;
        while (j < assignedTasks.length && assignedTasks[j].start.getTime() < taskA.end.getTime()) {
          const taskB = assignedTasks[j];
          overlappingUnits += taskB.assignments!.find(a => a.resourceId === resource.id)!.units;

          if (overlappingUnits > maxUnits) {
            // Overallocation detected between taskA and taskB (and potentially others).
            // We need to resolve it by delaying one of them.
            // Prefer delaying the non-critical task, or the one starting later.
            let taskToDelay: GanttTask;
            let blockingTask: GanttTask;

            if ((taskB.float || 0) > 0 && (taskA.float || 0) <= 0) {
              taskToDelay = taskB;
              blockingTask = taskA;
            } else if ((taskA.float || 0) > 0 && (taskB.float || 0) <= 0) {
              taskToDelay = taskA;
              blockingTask = taskB;
            } else if ((taskB.float || 0) > 0 && (taskA.float || 0) > 0) {
              // Both non-critical, delay the one with more float, or if equal, the one starting later.
              if ((taskB.float || 0) > (taskA.float || 0)) {
                taskToDelay = taskB;
                blockingTask = taskA;
              } else {
                taskToDelay = taskB;
                blockingTask = taskA;
              }
            } else {
              // Both are critical. Do NOT move them. Break and accept overallocation.
              j++;
              continue;
            }

            // Perform the delay
            const duration = taskToDelay.end.getTime() - taskToDelay.start.getTime();
            const newStart = new Date(Math.max(taskToDelay.start.getTime(), blockingTask.end.getTime()));
            const newEnd = new Date(newStart.getTime() + duration);

            let updatedTask = {
              ...taskToDelay,
              start: newStart,
              end: newEnd,
            };

            currentTasks = currentTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
            
            // Cascade schedule to move its successors
            currentTasks = cascadeSchedule(currentTasks, updatedTask, calendar);

            hasConflict = true;
            conflictFound = true;
            break;
          }
          j++;
        }
        if (conflictFound) break;
      }
      if (hasConflict) break; // Break out to restart the timeline evaluation with new dates
    }

    if (!hasConflict) {
      break; // Fully leveled
    }
  }

  if (iteration >= maxIterations) {
    console.warn('levelResources: Maximum iterations reached. Cycle or deadlock detected.');
  }

  return currentTasks;
}
