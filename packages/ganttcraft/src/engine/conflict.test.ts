import { expect, test, describe } from 'vitest';
import { detectConflicts } from './conflict';
import { GanttTask } from '../types';

describe('Conflict Detection Engine', () => {
  test('detects no conflicts for a valid schedule', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-06T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z'), dependencies: [{ id: '1', type: 'FS' }] }
    ];

    const result = detectConflicts(tasks);
    expect(result['1']).toBeUndefined();
    expect(result['2']).toBeUndefined();
  });

  test('detects FS conflict when successor starts before predecessor ends', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-04T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z'), dependencies: [{ id: '1', type: 'FS' }] }
    ];

    const result = detectConflicts(tasks);
    expect(result['2']).toBeDefined();
    expect(result['2'][0].type).toBe('overlap');
    expect(result['2'][0].message).toContain('starts before predecessor');
  });

  test('detects SS conflict when successor starts before predecessor starts', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-04T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z'), dependencies: [{ id: '1', type: 'SS' }] }
    ];
    const result = detectConflicts(tasks);
    expect(result['2']).toBeDefined();
  });

  test('SS satisfied: successor starts after or at predecessor start', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z'), dependencies: [{ id: '1', type: 'SS' }] }
    ];
    const result = detectConflicts(tasks);
    expect(result['2']).toBeUndefined();
  });

  test('detects FF conflict when successor ends before predecessor ends', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-04T00:00:00Z'), dependencies: [{ id: '1', type: 'FF' }] }
    ];
    const result = detectConflicts(tasks);
    expect(result['2']).toBeDefined();
  });

  test('detects SF conflict when successor ends before predecessor starts', () => {
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-05T00:00:00Z'), end: new Date('2024-01-10T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-04T00:00:00Z'), dependencies: [{ id: '1', type: 'SF' }] }
    ];
    const result = detectConflicts(tasks);
    expect(result['2']).toBeDefined();
  });

  test('Lag: FS + lag 2 flags conflict when task starts only 1 day after predecessor', () => {
    // A ends 01-01. B must start at least 01-03 (assuming 1 day = 24h lag in simple conflict logic)
    // Actually, detectConflicts does not currently use WorkingCalendar. The task says "Add equivalent checks: SS → task.start < predecessor.start + lag". Wait, if lag is in working days, then `conflict.ts` should use `WorkingCalendar`? The phase file says "Each branch reads dep.lag ?? 0 for the lag offset", but `conflict.ts` does not have access to calendar! Wait. "Add equivalent checks... Each branch reads dep.lag ?? 0 for the lag offset".
    // I will write the test using a literal day offset (86400000 ms).
    const tasks: GanttTask[] = [
      { id: '1', name: 'A', start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-01T00:00:00Z') },
      { id: '2', name: 'B', start: new Date('2024-01-02T00:00:00Z'), end: new Date('2024-01-05T00:00:00Z'), dependencies: [{ id: '1', type: 'FS', lag: 2 }] }
    ];
    const result = detectConflicts(tasks);
    expect(result['2']).toBeDefined();
  });
});
