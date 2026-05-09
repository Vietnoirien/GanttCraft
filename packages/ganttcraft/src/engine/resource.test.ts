import { describe, it, expect } from 'vitest';
import { calculateResourceUtilization } from './resource';
import { GanttTask } from '../types';

describe('calculateResourceUtilization', () => {
  it('sums utilization for overlapping tasks for a resource', () => {
    const tasks: GanttTask[] = [
      { 
        id: '1', name: 'T1', 
        start: new Date('2024-01-01T00:00:00Z'), 
        end: new Date('2024-01-03T00:00:00Z'),
        assignments: [{ resourceId: 'R1', units: 1 }]
      },
      { 
        id: '2', name: 'T2', 
        start: new Date('2024-01-02T00:00:00Z'), 
        end: new Date('2024-01-04T00:00:00Z'),
        assignments: [{ resourceId: 'R1', units: 1 }]
      }
    ];
    
    // Check utilization on Jan 2nd
    const util = calculateResourceUtilization(tasks, 'R1', new Date('2024-01-02T12:00:00Z'));
    expect(util).toBe(2);
  });
});
