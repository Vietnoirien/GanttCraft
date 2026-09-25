import { describe, it, expect } from 'vitest';
import { cascadeSchedule, hasCycles, backwardPass, rollupGroups } from './scheduler';
import { GanttTask } from '../types';
import { AllDayCalendar, StandardCalendar, createStandardCalendar } from './calendar';

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

describe('converging dependency cascades', () => {
  const date = (day: number) => new Date(`2024-01-${String(day).padStart(2, '0')}T00:00:00Z`);

  it.each([
    ['earlier constraint listed first', ['early', 'late']],
    ['later constraint listed first', ['late', 'early']],
  ])('keeps the strongest predecessor constraint when the %s', (_label, order) => {
    const branches: Record<string, GanttTask> = {
      early: { id: 'early', name: 'Early', start: date(2), end: date(3), dependencies: [{ id: 'root', type: 'FS' }] },
      late: { id: 'late', name: 'Late', start: date(2), end: date(3), dependencies: [{ id: 'root', type: 'FS', lag: 3 }] },
    };
    const tasks: GanttTask[] = [
      { id: 'root', name: 'Root', start: date(1), end: date(2) },
      ...order.map(id => branches[id]),
      { id: 'join', name: 'Join', start: date(3), end: date(4), dependencies: order.map(id => ({ id, type: 'FS' as const })) },
      { id: 'tail', name: 'Tail', start: date(4), end: date(5), dependencies: [{ id: 'join', type: 'FS' }] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0], end: date(4) });
    expect(result.find(task => task.id === 'early')?.end).toEqual(date(5));
    expect(result.find(task => task.id === 'late')?.end).toEqual(date(8));
    expect(result.find(task => task.id === 'join')?.start).toEqual(date(8));
    expect(result.find(task => task.id === 'tail')?.start).toEqual(date(9));
  });

  it('waits for a longer branch before propagating past a join', () => {
    const tasks: GanttTask[] = [
      { id: 'root', name: 'Root', start: date(1), end: date(2) },
      { id: 'short', name: 'Short', start: date(2), end: date(3), dependencies: [{ id: 'root', type: 'FS' }] },
      { id: 'long1', name: 'Long 1', start: date(2), end: date(3), dependencies: [{ id: 'root', type: 'FS' }] },
      { id: 'long2', name: 'Long 2', start: date(3), end: date(4), dependencies: [{ id: 'long1', type: 'FS' }] },
      { id: 'join', name: 'Join', start: date(4), end: date(5), dependencies: [{ id: 'short', type: 'FS' }, { id: 'long2', type: 'FS' }] },
      { id: 'tail', name: 'Tail', start: date(5), end: date(6), dependencies: [{ id: 'join', type: 'FS' }] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0], end: date(5) });
    expect(result.find(task => task.id === 'join')?.start).toEqual(date(7));
    expect(result.find(task => task.id === 'tail')?.start).toEqual(date(8));
  });

  it('respects a stricter predecessor outside the changed branch', () => {
    const tasks: GanttTask[] = [
      { id: 'changed', name: 'Changed', start: date(1), end: date(2) },
      { id: 'fixed', name: 'Fixed', start: date(1), end: date(10) },
      { id: 'join', name: 'Join', start: date(3), end: date(4), dependencies: [
        { id: 'fixed', type: 'FS' },
        { id: 'changed', type: 'FS' },
      ] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0], end: date(5) });
    expect(result.find(task => task.id === 'join')?.start).toEqual(date(10));
  });

  it.each([
    ['FS', 1, 8],
    ['SS', 2, 8],
    ['FF', 3, 8],
    ['SF', 4, 8],
    ['FF', -1, 5],
  ])('combines a %s link with lag %i against another predecessor', (type, lag, expectedDay) => {
    const tasks: GanttTask[] = [
      { id: 'root', name: 'Root', start: date(1), end: date(2) },
      { id: 'first', name: 'First', start: date(1), end: date(2), dependencies: [{ id: 'root', type: 'FS' }] },
      { id: 'second', name: 'Second', start: date(1), end: date(2), dependencies: [{ id: 'root', type: 'SS', lag: 5 }] },
      { id: 'join', name: 'Join', start: date(1), end: date(3), dependencies: [
        { id: 'first', type: 'FS' },
        { id: 'second', type: type as import('../types').TaskDependency['type'], lag },
      ] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0], end: date(4) });
    expect(result.find(task => task.id === 'join')?.start).toEqual(date(expectedDay));
  });

  it('combines FS, SS, FF, and SF constraints with positive and negative lag', () => {
    const tasks: GanttTask[] = [
      { id: 'root', name: 'Root', start: date(1), end: date(2) },
      { id: 'fs', name: 'FS', start: date(1), end: date(2), dependencies: [{ id: 'root', type: 'FS', lag: 1 }] },
      { id: 'ss', name: 'SS', start: date(1), end: date(2), dependencies: [{ id: 'root', type: 'SS', lag: 5 }] },
      { id: 'ff', name: 'FF', start: date(1), end: date(2), dependencies: [{ id: 'root', type: 'FF', lag: 4 }] },
      { id: 'sf', name: 'SF', start: date(1), end: date(2), dependencies: [{ id: 'root', type: 'SF', lag: 7 }] },
      { id: 'join', name: 'Join', start: date(1), end: date(3), dependencies: [
        { id: 'sf', type: 'SF', lag: -1 },
        { id: 'ff', type: 'FF', lag: 2 },
        { id: 'ss', type: 'SS', lag: 1 },
        { id: 'fs', type: 'FS', lag: 1 },
      ] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0], end: date(4) });
    const join = result.find(task => task.id === 'join')!;
    // FF on "ff" requires join.end >= Jan 10, so its two-day duration starts Jan 8.
    expect(join.start).toEqual(date(8));
    expect(join.end).toEqual(date(10));
  });

  it('returns the original tasks when a cycle is present', () => {
    const tasks: GanttTask[] = [
      { id: 'a', name: 'A', start: date(1), end: date(2), dependencies: [{ id: 'b', type: 'FS' }] },
      { id: 'b', name: 'B', start: date(2), end: date(3), dependencies: [{ id: 'a', type: 'FS' }] },
    ];
    expect(cascadeSchedule(tasks, { ...tasks[0], end: date(4) })).toBe(tasks);
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
  it('skips a named Monday holiday when a dependency crosses the weekend', () => {
    const calendar = createStandardCalendar({ holidays: [{ date: '2024-01-08', name: 'Team holiday' }] });
    const tasks: GanttTask[] = [
      { id: 'a', name: 'A', start: new Date('2024-01-04T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: 'b', name: 'B', start: new Date('2024-01-04T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z'), dependencies: [{ id: 'a', type: 'FS', lag: 1 }] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0] }, calendar);
    expect(result[1].start).toEqual(new Date('2024-01-09T00:00:00Z'));
    expect(result[1].end).toEqual(new Date('2024-01-10T00:00:00Z'));
  });

  it('snaps an FS successor after a predecessor ends on a holiday', () => {
    const calendar = createStandardCalendar({ holidays: [{ date: '2024-01-08', name: 'Team holiday' }] });
    const tasks: GanttTask[] = [
      { id: 'a', name: 'A', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-08T00:00:00Z') },
      { id: 'b', name: 'B', start: new Date('2024-01-04T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z'), dependencies: [{ id: 'a', type: 'FS' }] },
    ];

    const result = cascadeSchedule(tasks, { ...tasks[0] }, calendar);
    expect(result[1].start).toEqual(new Date('2024-01-09T00:00:00Z'));
  });

  it('keeps a one-hour successor one hour long', () => {
    const calendar = createStandardCalendar({ holidays: [{ date: '2024-01-08', name: 'Team holiday' }] });
    const tasks: GanttTask[] = [
      { id: 'a', name: 'A', start: new Date('2024-01-05T14:00:00Z'), end: new Date('2024-01-05T15:00:00Z') },
      { id: 'b', name: 'B', start: new Date('2024-01-05T14:00:00Z'), end: new Date('2024-01-05T15:00:00Z'), dependencies: [{ id: 'a', type: 'FS' }] },
    ];
    const result = cascadeSchedule(tasks, { ...tasks[0] }, calendar);
    expect(result[1].start).toEqual(new Date('2024-01-05T15:00:00Z'));
    expect(result[1].end).toEqual(new Date('2024-01-05T16:00:00Z'));
  });

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
