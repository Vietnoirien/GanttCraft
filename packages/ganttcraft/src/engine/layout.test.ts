import { describe, it, expect } from 'vitest';
import { calculateTaskLayout, PIXELS_PER_DAY, ROW_HEIGHT, dateToPixelX, MS_PER_DAY } from './layout';

describe('calculateTaskLayout', () => {
  it('should calculate x, width and y correctly', () => {
    const timelineStart = new Date('2024-01-01T00:00:00Z');
    const task = {
      id: '1',
      name: 'Task 1',
      start: new Date('2024-01-02T00:00:00Z'),
      end: new Date('2024-01-04T00:00:00Z'),
    };
    const index = 2;

    const layout = calculateTaskLayout(task, index, timelineStart);

    expect(layout.x).toBe(PIXELS_PER_DAY); // 1 day diff
    expect(layout.width).toBe(PIXELS_PER_DAY * 2); // 2 days diff
    expect(layout.y).toBe(ROW_HEIGHT * 2);
  });

  it('zero-duration task (start === end) produces at least 1px width (CR-3.D.2)', () => {
    const timelineStart = new Date('2024-01-01T00:00:00Z');
    const task = {
      id: 'z',
      name: 'Zero',
      start: new Date('2024-01-05T00:00:00Z'),
      end: new Date('2024-01-05T00:00:00Z'), // same as start
    };

    const layout = calculateTaskLayout(task, 0, timelineStart);
    expect(layout.width).toBeGreaterThanOrEqual(1);
  });

  it('task at index 5 has y === 5 * ROW_HEIGHT (CR-3.D.2)', () => {
    const timelineStart = new Date('2024-01-01T00:00:00Z');
    const task = {
      id: 'x',
      name: 'X',
      start: new Date('2024-01-02T00:00:00Z'),
      end: new Date('2024-01-03T00:00:00Z'),
    };

    const layout = calculateTaskLayout(task, 5, timelineStart);
    expect(layout.y).toBe(5 * ROW_HEIGHT);
  });
});

describe('dateToPixelX', () => {
  it('CR-5.A.1: should calculate correct pixel offset for a date', () => {
    const timelineStart = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const ppm = PIXELS_PER_DAY / MS_PER_DAY;
    
    const x = dateToPixelX(date, timelineStart, ppm);
    expect(x).toBe(PIXELS_PER_DAY);
  });

  describe('CR-5.A.3 Regression Tests: Baseline-Task Alignment', () => {
    const timelineStart = new Date('2024-01-01T00:00:00Z');
    const ppm = PIXELS_PER_DAY / MS_PER_DAY;

    it('Alignment test: baseline equals task.x when dates match', () => {
      const task = {
        id: '1',
        name: 'T1',
        start: new Date('2024-01-10T00:00:00Z'),
        end: new Date('2024-01-15T00:00:00Z')
      };
      const layout = calculateTaskLayout(task, 0, timelineStart, ppm);
      const baselineX = dateToPixelX(task.start, timelineStart, ppm);
      
      expect(baselineX).toBe(layout.x);
    });

    it('Offset test: baseline before task.start produces correct relative X', () => {
      const taskStart = new Date('2024-01-10T00:00:00Z');
      const baselineStart = new Date('2024-01-08T00:00:00Z'); // 2 days earlier
      const task = {
        id: '2',
        name: 'T2',
        start: taskStart,
        end: new Date('2024-01-15T00:00:00Z')
      };
      
      const layout = calculateTaskLayout(task, 0, timelineStart, ppm);
      const baselineX = dateToPixelX(baselineStart, timelineStart, ppm);
      
      expect(baselineX).toBe(layout.x - 2 * MS_PER_DAY * ppm);
    });

    it('Width test: 5 days baseline difference matches 5 days worth of pixels', () => {
      const baselineStart = new Date('2024-01-10T00:00:00Z');
      const baselineEnd = new Date('2024-01-15T00:00:00Z');
      
      const startX = dateToPixelX(baselineStart, timelineStart, ppm);
      const endX = dateToPixelX(baselineEnd, timelineStart, ppm);
      const width = endX - startX;
      
      expect(width).toBe(5 * MS_PER_DAY * ppm);
    });

    it('Zero test: dateToPixelX at timeline origin is 0', () => {
      const x = dateToPixelX(timelineStart, timelineStart, ppm);
      expect(x).toBe(0);
    });
  });
});
