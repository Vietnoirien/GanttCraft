import { GanttTask } from '../types';

export interface Conflict {
  type: 'overlap' | 'missing_dependency';
  message: string;
}

export type ConflictMap = Record<string, Conflict[]>;

export const detectConflicts = (tasks: GanttTask[]): ConflictMap => {
  const conflicts: ConflictMap = {};
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  tasks.forEach(task => {
    if (!task.dependencies) return;
    
    task.dependencies.forEach(dep => {
      const predecessor = taskMap.get(dep.id);
      if (!predecessor) {
        if (!conflicts[task.id]) conflicts[task.id] = [];
        conflicts[task.id].push({ type: 'missing_dependency', message: `Missing dependency: ${dep.id}` });
        return;
      }

      const lagMs = (dep.lag || 0) * 86400000;

      switch (dep.type) {
        case 'FS':
          if (task.start.getTime() < predecessor.end.getTime() + lagMs) {
            if (!conflicts[task.id]) conflicts[task.id] = [];
            conflicts[task.id].push({ type: 'overlap', message: `Task ${task.id} starts before predecessor ${predecessor.id} ends` });
          }
          break;
        case 'SS':
          if (task.start.getTime() < predecessor.start.getTime() + lagMs) {
            if (!conflicts[task.id]) conflicts[task.id] = [];
            conflicts[task.id].push({ type: 'overlap', message: `Task ${task.id} starts before predecessor ${predecessor.id} starts` });
          }
          break;
        case 'FF':
          if (task.end.getTime() < predecessor.end.getTime() + lagMs) {
            if (!conflicts[task.id]) conflicts[task.id] = [];
            conflicts[task.id].push({ type: 'overlap', message: `Task ${task.id} ends before predecessor ${predecessor.id} ends` });
          }
          break;
        case 'SF':
          if (task.end.getTime() < predecessor.start.getTime() + lagMs) {
            if (!conflicts[task.id]) conflicts[task.id] = [];
            conflicts[task.id].push({ type: 'overlap', message: `Task ${task.id} ends before predecessor ${predecessor.id} starts` });
          }
          break;
      }
    });
  });

  return conflicts;
};
