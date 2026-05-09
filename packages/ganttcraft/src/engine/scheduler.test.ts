import { describe, it, expect } from 'vitest';
import { cascadeSchedule, hasCycles, backwardPass, rollupGroups } from './scheduler';
import { GanttTask } from '../types';
import { AllDayCalendar, StandardCalendar } from './calendar';

describe('scheduler cycle detection', () => {
  it('detects a simple cycle', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date(), end: new Date(), dependencies: [{ id: '2', type: 'FS' }] },
      { id: '2', name: 'T2', start: new Date(), end: new Date(), dependencies: [{ id: '1', type: 'FS' }] }
    ];
    expect(hasCycles(tasks)).toBe(true);
  });

  it('detects no cycles', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date(), end: new Date(), dependencies: [{ id: '2', type: 'FS' }] },
      { id: '2', name: 'T2', start: new Date(), end: new Date() }
    ];
    expect(hasCycles(tasks)).toBe(false);
  });
});

describe('scheduler cascade', () => {
  it('cascades a Finish-to-Start dependency forward', () => {
    const d1Start = new Date('2024-01-01T00:00:00Z');
    const d1End = new Date('2024-01-02T00:00:00Z');
    const d2Start = new Date('2024-01-02T00:00:00Z'); // Assuming instantaneous
    const d2End = new Date('2024-01-03T00:00:00Z');

    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: d1Start, end: d1End },
      { id: '2', name: 'T2', start: d2Start, end: d2End, dependencies: [{ id: '1', type: 'FS' }] }
    ];

    // Simulate modifying T1 to end a day later
    const updatedT1 = { ...tasks[0], end: new Date('2024-01-03T00:00:00Z') };
    const newTasks = cascadeSchedule(tasks, updatedT1);

    expect(newTasks.find((t) => t.id === '1')?.end).toEqual(updatedT1.end);
    expect(newTasks.find((t) => t.id === '2')?.start).toEqual(updatedT1.end);
    expect(newTasks.find((t) => t.id === '2')?.end).toEqual(new Date('2024-01-04T00:00:00Z'));
  });
});

describe('backwardPass and critical path', () => {
  it('calculates total float and identifies critical path', () => {
    const d1Start = new Date('2024-01-01T00:00:00Z');
    const d1End = new Date('2024-01-02T00:00:00Z');
    const d2End = new Date('2024-01-03T00:00:00Z');
    const d3End = new Date('2024-01-04T00:00:00Z');
    
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: d1Start, end: d1End },
      { id: '2', name: 'B', start: d1End, end: d2End, dependencies: [{ id: '1', type: 'FS' }] },
      { id: '3', name: 'C', start: d2End, end: d3End, dependencies: [{ id: '2', type: 'FS' }] },
      { id: '4', name: 'D', start: d1End, end: d2End, dependencies: [{ id: '1', type: 'FS' }] }
    ];

    const result = backwardPass(tasks);
    expect(result.find(t => t.id === '3')?.float).toBe(0); // Critical
    expect(result.find(t => t.id === '4')?.float).toBeGreaterThan(0); // Not critical
  });
});

describe('WBS rollup', () => {
  it('calculates group start and end from children', () => {
    const tasks: GanttTask[] = [
      { id: 'group1', name: 'G1', type: 'group', start: new Date(), end: new Date() },
      { id: '1', parentId: 'group1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { id: '2', parentId: 'group1', name: 'T2', start: new Date('2024-01-03T00:00:00Z'), end: new Date('2024-01-04T00:00:00Z') }
    ];

    const rolledUp = rollupGroups(tasks);
    const group = rolledUp.find(t => t.id === 'group1');
    expect(group?.start).toEqual(new Date('2024-01-01T00:00:00Z'));
    expect(group?.end).toEqual(new Date('2024-01-04T00:00:00Z'));
  });
});

describe('cascadeSchedule with WorkingCalendar (CR-1.A.3 + CR-1.A.4)', () => {
  it('AllDayCalendar (no args) — baseline FS cascade is unchanged', () => {
    // 2024-01-01 Mon → 2024-01-02 Tue (1 day task T1)
    // T2: 2024-01-02 → 2024-01-03 (1 day), depends on T1 FS
    // Move T1 end to 2024-01-03 → T2 should start 2024-01-03, end 2024-01-04
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-02T00:00:00Z'), end: new Date('2024-01-03T00:00:00Z'), dependencies: [{ id: '1', type: 'FS' }] }
    ];
    const updatedT1 = { ...tasks[0], end: new Date('2024-01-03T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, AllDayCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-03T00:00:00Z'));
    expect(result.find(t => t.id === '2')?.end).toEqual(new Date('2024-01-04T00:00:00Z'));
  });

  it('StandardCalendar — predecessor ends Friday, successor start snaps to same day, duration preserved in working days', () => {
    // T2: Mon 2024-01-08 → Mon 2024-01-15: 5 working days (Mon–Fri)
    // After T1 ends Fri 2024-01-12:
    //   T2 new start = 2024-01-12 (Fri — same as T1 end)
    //   T2 new end   = addWorkingDays(Fri Jan 12, 5) = Mon 13, Tue 14, Wed 15, Thu 16, Fri 17 = Fri 2024-01-17
    const t2Start = new Date('2024-01-08T00:00:00Z'); // Mon
    const t2End = new Date('2024-01-15T00:00:00Z');   // Mon (5 working days span)
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: '2', name: 'T2', start: t2Start, end: t2End, dependencies: [{ id: '1', type: 'FS' }] }
    ];
    // Move T1 end to Friday 2024-01-12
    const updatedT1 = { ...tasks[0], end: new Date('2024-01-12T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    const t2 = result.find(t => t.id === '2')!;
    // T2 start = T1 end = Fri Jan 12
    expect(t2.start).toEqual(new Date('2024-01-12T00:00:00Z'));
    // T2 duration = 5 working days; from Fri Jan 12: Mon 15, Tue 16, Wed 17, Thu 18, Fri 19 = Fri Jan 19
    expect(t2.end).toEqual(new Date('2024-01-19T00:00:00Z'));
  });

  it('StandardCalendar chain of 3 tasks — all end dates land on working days', () => {
    // T1: Mon 2024-01-01 → Fri 2024-01-05 (4 working days)
    // T2: Mon 2024-01-08 → Fri 2024-01-12 (5 working days), depends T1 FS
    // T3: Mon 2024-01-15 → Fri 2024-01-19 (5 working days), depends T2 FS
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-08T00:00:00Z'), end: new Date('2024-01-15T00:00:00Z'), dependencies: [{ id: '1', type: 'FS' }] },
      { id: '3', name: 'T3', start: new Date('2024-01-15T00:00:00Z'), end: new Date('2024-01-22T00:00:00Z'), dependencies: [{ id: '2', type: 'FS' }] }
    ];
    // Move T1 end to Wed 2024-01-10 (+5 days)
    const updatedT1 = { ...tasks[0], end: new Date('2024-01-10T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);

    // All task end dates should be Mon-Fri (not Sat/Sun)
    for (const t of result) {
      const dow = t.end.getUTCDay();
      expect(dow).not.toBe(0); // Not Sunday
      expect(dow).not.toBe(6); // Not Saturday
    }
  });

  it('StandardCalendar — successor already starts Monday, cascade still correct', () => {
    // T1 Mon → T1 Mon (same day), T2 Mon → Tue, no shift expected
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-08T00:00:00Z'), end: new Date('2024-01-08T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-08T00:00:00Z'), end: new Date('2024-01-09T00:00:00Z'), dependencies: [{ id: '1', type: 'FS' }] }
    ];
    // T1 already at boundary — no change expected
    const updatedT1 = { ...tasks[0] };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-08T00:00:00Z'));
  });
});

describe('TaskDependency type contract', () => {
  it('allows TaskDependency without lag', () => {
    const dep: import('../types').TaskDependency = { id: 'x', type: 'FS' };
    expect(dep.id).toBe('x');
  });

  it('allows TaskDependency with positive lag', () => {
    const dep: import('../types').TaskDependency = { id: 'x', type: 'FS', lag: 2 };
    expect(dep.lag).toBe(2);
  });

  it('allows TaskDependency with negative lag', () => {
    const dep: import('../types').TaskDependency = { id: 'x', type: 'FS', lag: -1 };
    expect(dep.lag).toBe(-1);
  });
});

describe('SS/FF/SF cascade', () => {
  it('SS: predecessor start moves forward -> successor start moves forward by same amount', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-03T00:00:00Z'), dependencies: [{ id: '1', type: 'SS' }] }
    ];
    const updatedT1 = { ...tasks[0], start: new Date('2024-01-03T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-03T00:00:00Z'));
  });

  it('FF: predecessor end moves forward -> successor end moves forward (duration preserved)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z'), dependencies: [{ id: '1', type: 'FF' }] }
    ];
    const updatedT1 = { ...tasks[0], end: new Date('2024-01-04T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.end).toEqual(new Date('2024-01-04T00:00:00Z'));
  });

  it('SF: predecessor start moves -> successor end moves (duration preserved)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-02T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z'), dependencies: [{ id: '1', type: 'SF' }] }
    ];
    const updatedT1 = { ...tasks[0], start: new Date('2024-01-03T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.end).toEqual(new Date('2024-01-03T00:00:00Z'));
  });

  it('FS + lag 2: predecessor ends Monday -> successor starts Wednesday', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-01T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z'), dependencies: [{ id: '1', type: 'FS', lag: 2 }] }
    ];
    const updatedT1 = { ...tasks[0] };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-03T00:00:00Z'));
  });

  it('FS + lag -1: predecessor ends Tuesday -> successor starts Monday (1-day lead)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-03T00:00:00Z'), end: new Date('2024-01-04T00:00:00Z'), dependencies: [{ id: '1', type: 'FS', lag: -1 }] }
    ];
    const updatedT1 = { ...tasks[0] };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-01T00:00:00Z'));
  });

  it('Chain of 3 tasks with SS dependencies — all cascade correctly', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') },
      { id: '2', name: 'T2', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-03T00:00:00Z'), dependencies: [{ id: '1', type: 'SS' }] },
      { id: '3', name: 'T3', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-04T00:00:00Z'), dependencies: [{ id: '2', type: 'SS' }] }
    ];
    const updatedT1 = { ...tasks[0], start: new Date('2024-01-04T00:00:00Z') };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-04T00:00:00Z'));
    expect(result.find(t => t.id === '3')?.start).toEqual(new Date('2024-01-04T00:00:00Z'));
  });
});

describe('task constraints', () => {
  it('SNET: cascade would place task on Monday, constraint is Wednesday -> task starts Wednesday', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') }, // ends Tuesday
      // T2 is FS to T1, so it wants to start Tuesday (01-02), but has SNET Wednesday (01-03)
      { 
        id: '2', 
        name: 'T2', 
        start: new Date('2024-01-01T00:00:00Z'), 
        end: new Date('2024-01-02T00:00:00Z'), 
        dependencies: [{ id: '1', type: 'FS' }],
        constraint: 'SNET',
        constraintDate: new Date('2024-01-03T00:00:00Z')
      }
    ];
    const updatedT1 = { ...tasks[0] }; // trigger cascade
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-03T00:00:00Z'));
  });

  it('SNET: cascade places task on Friday, constraint is Wednesday -> task starts Friday (constraint not violated)', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') }, // ends Friday
      { 
        id: '2', 
        name: 'T2', 
        start: new Date('2024-01-01T00:00:00Z'), 
        end: new Date('2024-01-02T00:00:00Z'), 
        dependencies: [{ id: '1', type: 'FS' }],
        constraint: 'SNET',
        constraintDate: new Date('2024-01-03T00:00:00Z') // Wed
      }
    ];
    const updatedT1 = { ...tasks[0] }; // trigger cascade
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-05T00:00:00Z'));
  });

  it('MSO: task always starts on constraint date regardless of cascade', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') }, // ends Friday
      { 
        id: '2', 
        name: 'T2', 
        start: new Date('2024-01-01T00:00:00Z'), 
        end: new Date('2024-01-02T00:00:00Z'), 
        dependencies: [{ id: '1', type: 'FS' }],
        constraint: 'MSO',
        constraintDate: new Date('2024-01-03T00:00:00Z') // Wed
      }
    ];
    const updatedT1 = { ...tasks[0] }; // trigger cascade
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    // Even though FS to Friday, MSO says Wednesday
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-03T00:00:00Z'));
  });

  it('ALAP: task with 2-day float placed at LS (2 days later than ES)', () => {
    // A -> B, A -> C -> D. B and D are sink nodes.
    // Let's make A = 1 day (01-01 -> 01-02)
    // C = 3 days (01-02 -> 01-05)
    // D = 1 day (01-05 -> 01-08)
    // So project end is 01-08.
    // B depends on A, takes 1 day. LF of B is 01-08. LS of B is 01-07.
    // ES of B is 01-02. Float is 5 days.
    // If B is ALAP, its start should be its LS (01-07).
    const d1 = new Date('2024-01-01T00:00:00Z');
    const d2 = new Date('2024-01-02T00:00:00Z');
    const d5 = new Date('2024-01-05T00:00:00Z');
    const d8 = new Date('2024-01-08T00:00:00Z');

    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: d1, end: d2 },
      { 
        id: '2', 
        name: 'B', 
        start: d2, 
        end: d5, 
        dependencies: [{ id: '1', type: 'FS' }],
        constraint: 'ALAP'
      },
      { id: '3', name: 'C', start: d2, end: d5, dependencies: [{ id: '1', type: 'FS' }] },
      { id: '4', name: 'D', start: d5, end: d8, dependencies: [{ id: '3', type: 'FS' }] }
    ];

    const result = backwardPass(tasks);
    // B's LS is 01-05 (because LF is 01-08 and duration is 3 days). So float is 01-05 minus 01-02 = 3 days float.
    // After backwardPass, B's start should be modified to be equal to its LS (01-05).
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-05T00:00:00Z'));
  });

  it('ASAP (default): behavior identical to current unconstrained behavior', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'T1', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-02T00:00:00Z') }, // ends Tuesday
      { 
        id: '2', 
        name: 'T2', 
        start: new Date('2024-01-01T00:00:00Z'), 
        end: new Date('2024-01-02T00:00:00Z'), 
        dependencies: [{ id: '1', type: 'FS' }],
        constraint: 'ASAP'
      }
    ];
    const updatedT1 = { ...tasks[0] };
    const result = cascadeSchedule(tasks, updatedT1, StandardCalendar);
    expect(result.find(t => t.id === '2')?.start).toEqual(new Date('2024-01-02T00:00:00Z'));
  });
});
