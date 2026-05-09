import { describe, it, expect } from 'vitest';
import { levelResources } from './resourceLeveling';
import { GanttTask, GanttResource } from '../types';

describe('levelResources', () => {
  const resourceR: GanttResource = { id: 'R1', name: 'Resource 1', maxUnits: 1.0 };
  const resourceR2: GanttResource = { id: 'R2', name: 'Resource 2', maxUnits: 0.5 };

  it('no-op test: no overlap, no overallocation', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Task 1',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-02T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
      {
        id: 'T2',
        name: 'Task 2',
        start: new Date('2023-01-03T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
    ];

    const leveled = levelResources(tasks, [resourceR]);
    expect(leveled).toEqual(tasks);
  });

  it('no-op test: same resource, combined units <= maxUnits', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Task 1',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-03T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 0.5 }],
      },
      {
        id: 'T2',
        name: 'Task 2',
        start: new Date('2023-01-02T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 0.5 }],
      },
    ];

    const leveled = levelResources(tasks, [resourceR]);
    expect(leveled).toEqual(tasks);
  });

  it('delay test: delay non-critical task to resolve conflict', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Critical Task',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-03T00:00:00Z'),
        float: 0,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
      {
        id: 'T2',
        name: 'Non-Critical Task',
        start: new Date('2023-01-02T00:00:00Z'), // Overlaps by 1 day
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10 * 86400000,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
    ];

    const leveled = levelResources(tasks, [resourceR]);
    
    // T1 is critical, should not move
    const t1 = leveled.find(t => t.id === 'T1')!;
    expect(t1.start.getTime()).toBe(new Date('2023-01-01T00:00:00Z').getTime());
    expect(t1.end.getTime()).toBe(new Date('2023-01-03T00:00:00Z').getTime());

    // T2 is non-critical, should move to end of T1
    const t2 = leveled.find(t => t.id === 'T2')!;
    expect(t2.start.getTime()).toBeGreaterThanOrEqual(new Date('2023-01-03T00:00:00Z').getTime());
    // Duration was 2 days, should stay 2 days
    const duration = new Date('2023-01-04T00:00:00Z').getTime() - new Date('2023-01-02T00:00:00Z').getTime();
    expect(t2.end.getTime()).toBe(t2.start.getTime() + duration);
  });

  it('preserve critical test: do not move critical tasks even if overallocated', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Critical Task 1',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-03T00:00:00Z'),
        float: -1000,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
      {
        id: 'T2',
        name: 'Critical Task 2',
        start: new Date('2023-01-02T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 0,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
    ];

    const leveled = levelResources(tasks, [resourceR]);
    expect(leveled).toEqual(tasks);
  });

  it('edge case: ignore tasks with empty assignments', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Task 1',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-03T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
      {
        id: 'T2',
        name: 'Task 2',
        start: new Date('2023-01-02T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10,
        assignments: [],
      },
      {
        id: 'T3',
        name: 'Task 3',
        start: new Date('2023-01-02T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10,
        // no assignments array
      },
    ];

    const leveled = levelResources(tasks, [resourceR]);
    expect(leveled).toEqual(tasks);
  });

  it('part-time resource test: overallocation when units > maxUnits', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Critical Part-Time',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-03T00:00:00Z'),
        float: 0,
        assignments: [{ resourceId: 'R2', units: 0.5 }],
      },
      {
        id: 'T2',
        name: 'Non-Critical Part-Time',
        start: new Date('2023-01-02T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R2', units: 0.5 }],
      },
    ];

    const leveled = levelResources(tasks, [resourceR2]);
    // maxUnits = 0.5. T1(0.5) + T2(0.5) = 1.0 > 0.5 => Conflict. T2 should be delayed.
    const t2 = leveled.find(t => t.id === 'T2')!;
    expect(t2.start.getTime()).toBeGreaterThanOrEqual(new Date('2023-01-03T00:00:00Z').getTime());
  });

  it('iteration guard test: prevent infinite loop with degenerate input', () => {
    const tasks: GanttTask[] = [
      {
        id: 'T1',
        name: 'Task 1',
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-03T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
      {
        id: 'T2',
        name: 'Task 2',
        start: new Date('2023-01-02T00:00:00Z'),
        end: new Date('2023-01-04T00:00:00Z'),
        float: 10,
        assignments: [{ resourceId: 'R1', units: 1.0 }],
      },
    ];
    // In a real degenerate case, they might infinitely push each other. We simulate this in the implementation by a maxIterations guard. 
    // Here we just make sure it doesn't hang forever.
    const leveled = levelResources(tasks, [resourceR]);
    expect(leveled).toBeDefined();
  });
});
