import { GanttTask, TaskDependency } from '../types';
import { WorkingCalendar, AllDayCalendar } from './calendar';

/**
 * Applies a dependency constraint and returns the new start and end dates if they changed.
 */
function applyDependencyConstraint(
  predecessor: GanttTask,
  successor: GanttTask,
  dep: TaskDependency,
  calendar: WorkingCalendar
): { newStart: Date; newEnd: Date } | null {
  const lag = dep.lag || 0;
  const durationDays = calendar.workingDaysBetween(successor.start, successor.end);

  let newStart: Date;
  let newEnd: Date;

  switch (dep.type) {
    case 'FS': {
      newStart = calendar.addWorkingDays(predecessor.end, lag);
      newEnd = calendar.addWorkingDays(newStart, durationDays);
      break;
    }
    case 'SS': {
      newStart = calendar.addWorkingDays(predecessor.start, lag);
      newEnd = calendar.addWorkingDays(newStart, durationDays);
      break;
    }
    case 'FF': {
      newEnd = calendar.addWorkingDays(predecessor.end, lag);
      newStart = calendar.addWorkingDays(newEnd, -durationDays);
      break;
    }
    case 'SF': {
      newEnd = calendar.addWorkingDays(predecessor.start, lag);
      newStart = calendar.addWorkingDays(newEnd, -durationDays);
      break;
    }
    default:
      return null;
  }

  if (successor.start.getTime() !== newStart.getTime() || successor.end.getTime() !== newEnd.getTime()) {
    return { newStart, newEnd };
  }
  return null;
}

function applyConstraint(task: GanttTask, proposedStart: Date): Date {
  if (task.constraint === 'SNET' && task.constraintDate) {
    return proposedStart < task.constraintDate ? task.constraintDate : proposedStart;
  }
  if (task.constraint === 'MSO' && task.constraintDate) {
    return task.constraintDate;
  }
  return proposedStart;
}

/**
 * Detects cycles using Kahn's algorithm or simple DFS.
 * Returns true if a cycle exists.
 */
export function hasCycles(tasks: GanttTask[]): boolean {
  const adjList = new Map<string, string[]>();
  
  for (const task of tasks) {
    if (!adjList.has(task.id)) adjList.set(task.id, []);
    for (const dep of task.dependencies || []) {
      // dependency id is the task it depends ON
      if (!adjList.has(dep.id)) adjList.set(dep.id, []);
      adjList.get(dep.id)!.push(task.id);
    }
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    if (recStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);

    const neighbors = adjList.get(node) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack.delete(node);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) return true;
    }
  }

  return false;
}

/**
 * Forward pass cascade.
 * Given a modified task, updates all successors that depend on it.
 *
 * @param tasks - All tasks in the project.
 * @param modifiedTask - The task whose dates have changed.
 * @param calendar - Working calendar to use for date arithmetic. Defaults to AllDayCalendar (24/7).
 */
export function cascadeSchedule(
  tasks: GanttTask[],
  modifiedTask: GanttTask,
  calendar: WorkingCalendar = AllDayCalendar,
): GanttTask[] {
  if (hasCycles(tasks)) {
    console.warn('Cannot cascade schedule: Cycle detected in dependencies');
    return tasks;
  }

  const tasksMap = new Map<string, GanttTask>();
  tasks.forEach((t) => tasksMap.set(t.id, t.id === modifiedTask.id ? modifiedTask : { ...t }));

  // Create an adjacency list: Map<taskId, dependentTasksIds>
  const successorsMap = new Map<string, string[]>();
  tasks.forEach((t) => {
    t.dependencies?.forEach((dep) => {
      if (!successorsMap.has(dep.id)) successorsMap.set(dep.id, []);
      successorsMap.get(dep.id)!.push(t.id);
    });
  });

  // BFS topological traversal starting from the modified task.
  // Each iteration processes the current task's direct successors, applies dependency constraints,
  // updates their dates if necessary, and re-queues them for further propagation.
  // The `processed` set prevents re-visiting tasks in diamond-dependency graphs.
  const queue = [modifiedTask.id];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const currentTask = tasksMap.get(currentId)!;
    const successors = successorsMap.get(currentId) || [];

    for (const succId of successors) {
      const succTask = tasksMap.get(succId)!;
      const depDef = succTask.dependencies?.find(d => d.id === currentId);
      
      if (depDef) {
        const constraint = applyDependencyConstraint(currentTask, succTask, depDef, calendar);
        if (constraint) {
          const durationDays = calendar.workingDaysBetween(succTask.start, succTask.end);
          const finalStart = applyConstraint(succTask, constraint.newStart);
          
          succTask.start = new Date(finalStart);
          succTask.end = calendar.addWorkingDays(finalStart, durationDays);
          queue.push(succId); // Re-evaluate its successors
        }
      }
    }
  }

  return Array.from(tasksMap.values());
}


/**
 * Backward pass of the Critical Path Method (CPM).
 *
 * **Algorithm overview:**
 * 1. **Sink identification:** Tasks with no successors are assigned Latest Finish (LF) = project end date.
 * 2. **Recursive LF propagation:** For each task, LF is the minimum Latest Start (LS) imposed
 *    by all successors, computed recursively with memoization (lsMap/lfMap).
 * 3. **Float calculation:** Total Float = LS − Early Start (ES). Zero or negative float means
 *    the task is on the critical path.
 * 4. **ALAP placement:** Tasks with `constraint === 'ALAP'` are moved to their Latest Start
 *    position (consuming all available float).
 *
 * **Note:** This implementation uses calendar-agnostic millisecond arithmetic.
 * Working-day awareness (injecting a WorkingCalendar) is tracked as a known limitation — see CR-2.A.
 *
 * @param tasks - All tasks in the project.
 * @returns A new array of tasks with `float` (in milliseconds) populated on each task.
 *          Tasks on the critical path have `float <= 0`.
 */
export function backwardPass(tasks: GanttTask[]): GanttTask[] {
  if (hasCycles(tasks)) {
    console.warn('Cannot calculate backward pass: Cycle detected');
    return tasks;
  }

  const tasksMap = new Map<string, GanttTask>();
  tasks.forEach((t) => tasksMap.set(t.id, { ...t }));

  // Precompute maximum end date across all tasks
  let projectEnd = new Date(0);
  tasks.forEach(t => {
    if (t.end > projectEnd) projectEnd = new Date(t.end);
  });

  // Calculate successors map (which tasks depend on this one)
  const successorsMap = new Map<string, string[]>();
  tasks.forEach((t) => {
    t.dependencies?.forEach((dep) => {
      if (!successorsMap.has(dep.id)) successorsMap.set(dep.id, []);
      successorsMap.get(dep.id)!.push(t.id);
    });
  });

  // We need Latest Finish (LF) and Latest Start (LS) internally
  const lfMap = new Map<string, Date>(); // Latest Finish Map: taskId → latest date the task may finish without delaying the project
  const lsMap = new Map<string, Date>(); // Latest Start Map: taskId → latest date the task may start (lfMap[id] - duration)

  // Helper to get duration
  const getDuration = (t: GanttTask) => t.end.getTime() - t.start.getTime();

  // Find sink nodes (tasks with no successors) and set LF to projectEnd
  tasks.forEach(t => {
    if (!successorsMap.has(t.id) || successorsMap.get(t.id)!.length === 0) {
      lfMap.set(t.id, projectEnd);
      lsMap.set(t.id, new Date(projectEnd.getTime() - getDuration(t)));
    }
  });

  // Topo sort from end to start to process backwards
  // Using memoized recursive DFS (see calculateLS below) — simpler than Kahn's for backward traversal
  const calculateLS = (id: string): Date => {
    if (lsMap.has(id)) return lsMap.get(id)!;
    
    const task = tasksMap.get(id)!;
    const successors = successorsMap.get(id) || [];
    
    // Minimum LS of all successors is our LF
    let minSuccessorLS = new Date(8640000000000000); // max date
    for (const succId of successors) {
      // Find the dependency definition on the successor
      const succTask = tasksMap.get(succId)!;
      const depDef = succTask.dependencies?.find(d => d.id === id);
      
      const succLS = calculateLS(succId);
      const succDuration = getDuration(succTask);
      const succLF = new Date(succLS.getTime() + succDuration);
      
      if (depDef) {
        const lag = depDef.lag || 0;
        let requiredLF: Date | null = null;
        
        switch (depDef.type) {
          case 'FS':
            // succLS >= LF + lag => LF <= succLS - lag
            // KNOWN LIMITATION: Lag subtraction uses calendar-agnostic ms arithmetic (lag * 86400000).
            // Working-day-aware lag requires a WorkingCalendar injection — tracked in CR-2.A (Epic CR-2.A).
            requiredLF = new Date(succLS.getTime() - lag * 86400000);
            break;
          case 'SS':
            // succLS >= LS + lag => LS <= succLS - lag => LF <= succLS - lag + getDuration(task)
            requiredLF = new Date(succLS.getTime() - lag * 86400000 + getDuration(task));
            break;
          case 'FF':
            // succLF >= LF + lag => LF <= succLF - lag
            requiredLF = new Date(succLF.getTime() - lag * 86400000);
            break;
          case 'SF':
            // succLF >= LS + lag => LS <= succLF - lag => LF <= succLF - lag + getDuration(task)
            requiredLF = new Date(succLF.getTime() - lag * 86400000 + getDuration(task));
            break;
        }

        if (requiredLF && requiredLF < minSuccessorLS) {
          minSuccessorLS = requiredLF;
        }
      }
    }

    const lf = minSuccessorLS;
    lfMap.set(id, lf);
    const ls = new Date(lf.getTime() - getDuration(task));
    lsMap.set(id, ls);
    return ls;
  };

  tasksMap.forEach((t) => {
    calculateLS(t.id);
    
    // float = LS - ES (or LF - EF)
    const ls = lsMap.get(t.id)!;
    const floatMs = ls.getTime() - t.start.getTime();
    t.float = floatMs;

    if (t.constraint === 'ALAP' && floatMs > 0) {
      t.start = new Date(ls);
      t.end = new Date(ls.getTime() + getDuration(t));
    }
  });

  return Array.from(tasksMap.values());
}

/**
 * Calculates start and end dates for group tasks based on their children.
 */
export function rollupGroups(tasks: GanttTask[]): GanttTask[] {
  const tasksMap = new Map<string, GanttTask>();
  tasks.forEach((t) => tasksMap.set(t.id, { ...t }));

  const childrenMap = new Map<string, string[]>();
  tasks.forEach(t => {
    if (t.parentId) {
      if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
      childrenMap.get(t.parentId)!.push(t.id);
    }
  });

  // Recursive bottom-up traversal: for each group, recursively compute the min start and max end
  // of all descendant tasks. Group tasks with no children return null (no bounds to roll up).
  // This handles arbitrary nesting depth without a separate topological sort.
  const computeGroupBounds = (id: string): { start: Date, end: Date } | null => {
    const task = tasksMap.get(id)!;
    if (task.type !== 'group') {
      return { start: task.start, end: task.end };
    }

    const children = childrenMap.get(id) || [];
    if (children.length === 0) return null; // Empty group

    let minStart = new Date(8640000000000000);
    let maxEnd = new Date(-8640000000000000);

    children.forEach(childId => {
      const bounds = computeGroupBounds(childId);
      if (bounds) {
        if (bounds.start < minStart) minStart = new Date(bounds.start);
        if (bounds.end > maxEnd) maxEnd = new Date(bounds.end);
      }
    });

    if (minStart.getTime() !== 8640000000000000) {
      task.start = minStart;
      task.end = maxEnd;
      return { start: minStart, end: maxEnd };
    }
    return null;
  };

  tasksMap.forEach((t) => {
    if (t.type === 'group') {
      computeGroupBounds(t.id);
    }
  });

  return Array.from(tasksMap.values());
}
