import { describe, it, expect } from 'vitest';
import { viewModeToPixelsPerMs, PIXELS_PER_DAY, MS_PER_DAY } from './layout';

describe('viewModeToPixelsPerMs', () => {
  it('day mode returns PIXELS_PER_DAY / MS_PER_DAY', () => {
    expect(viewModeToPixelsPerMs('day')).toBeCloseTo(PIXELS_PER_DAY / MS_PER_DAY);
  });

  it('week mode returns a smaller value than day mode', () => {
    expect(viewModeToPixelsPerMs('week')).toBeLessThan(viewModeToPixelsPerMs('day'));
  });

  it('month mode returns a smaller value than week mode', () => {
    expect(viewModeToPixelsPerMs('month')).toBeLessThan(viewModeToPixelsPerMs('week'));
  });

  it('quarter mode returns a smaller value than month mode', () => {
    expect(viewModeToPixelsPerMs('quarter')).toBeLessThan(viewModeToPixelsPerMs('month'));
  });

  it('year mode returns the smallest value', () => {
    expect(viewModeToPixelsPerMs('year')).toBeLessThan(viewModeToPixelsPerMs('quarter'));
  });

  it('all modes return a positive value', () => {
    const modes = ['day', 'week', 'month', 'quarter', 'year'] as const;
    for (const mode of modes) {
      expect(viewModeToPixelsPerMs(mode)).toBeGreaterThan(0);
    }
  });
});
