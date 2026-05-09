import { describe, it, expect } from 'vitest';
import { AllDayCalendar, StandardCalendar } from './calendar';

describe('AllDayCalendar', () => {
  describe('addWorkingDays', () => {
    it('adds 3 days from a Monday — returns Thursday', () => {
      // 2024-01-01 is a Monday
      const result = AllDayCalendar.addWorkingDays(new Date('2024-01-01T00:00:00Z'), 3);
      expect(result).toEqual(new Date('2024-01-04T00:00:00Z'));
    });

    it('adds 3 days from Friday — crosses weekend (AllDay ignores weekends)', () => {
      // 2024-01-05 is a Friday; AllDayCalendar adds raw ms so result is Monday 2024-01-08
      const result = AllDayCalendar.addWorkingDays(new Date('2024-01-05T00:00:00Z'), 3);
      expect(result).toEqual(new Date('2024-01-08T00:00:00Z'));
    });

    it('adds 0 days — returns same date', () => {
      const date = new Date('2024-01-03T00:00:00Z');
      const result = AllDayCalendar.addWorkingDays(date, 0);
      expect(result).toEqual(new Date('2024-01-03T00:00:00Z'));
    });

    it('adds negative days — moves backwards', () => {
      // Subtract 2 days from 2024-01-05 (Friday) → 2024-01-03 (Wednesday)
      const result = AllDayCalendar.addWorkingDays(new Date('2024-01-05T00:00:00Z'), -2);
      expect(result).toEqual(new Date('2024-01-03T00:00:00Z'));
    });
  });

  describe('workingDaysBetween', () => {
    it('calculates total calendar days (no weekend skipping)', () => {
      // Monday 2024-01-01 to Monday 2024-01-08 = 7 calendar days
      const result = AllDayCalendar.workingDaysBetween(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-08T00:00:00Z')
      );
      expect(result).toBe(7);
    });
  });
});

describe('StandardCalendar', () => {
  describe('addWorkingDays', () => {
    it('adds 1 working day from Friday — returns Monday (skips weekend)', () => {
      // 2024-01-05 is a Friday; adding 1 working day skips Sat+Sun → 2024-01-08 Monday
      const result = StandardCalendar.addWorkingDays(new Date('2024-01-05T00:00:00Z'), 1);
      expect(result).toEqual(new Date('2024-01-08T00:00:00Z'));
    });

    it('adds 5 working days from Monday — returns next Monday', () => {
      // 2024-01-01 (Mon) + 5 working days = 2024-01-08 (Mon)
      const result = StandardCalendar.addWorkingDays(new Date('2024-01-01T00:00:00Z'), 5);
      expect(result).toEqual(new Date('2024-01-08T00:00:00Z'));
    });

    it('adds 0 days — returns same date', () => {
      const date = new Date('2024-01-03T00:00:00Z');
      const result = StandardCalendar.addWorkingDays(date, 0);
      expect(result).toEqual(new Date('2024-01-03T00:00:00Z'));
    });

    it('adds negative days — moves backwards skipping weekends', () => {
      // 2024-01-08 (Mon) - 1 working day = 2024-01-05 (Fri), skips weekend
      const result = StandardCalendar.addWorkingDays(new Date('2024-01-08T00:00:00Z'), -1);
      expect(result).toEqual(new Date('2024-01-05T00:00:00Z'));
    });
  });

  describe('workingDaysBetween', () => {
    it('counts Mon to Mon as 5 working days (skipping weekend)', () => {
      // 2024-01-01 (Mon) to 2024-01-08 (Mon): Mon Tue Wed Thu Fri = 5 working days
      const result = StandardCalendar.workingDaysBetween(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-08T00:00:00Z')
      );
      expect(result).toBe(5);
    });

    it('counts only M-F days in a span spanning a full week', () => {
      // 2024-01-01 (Mon) to 2024-01-15 (Mon) = 10 working days (2 full weeks)
      const result = StandardCalendar.workingDaysBetween(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-15T00:00:00Z')
      );
      expect(result).toBe(10);
    });
  });

  describe('nextWorkingDay', () => {
    it('returns same date for a weekday', () => {
      // 2024-01-01 (Mon) — already a working day
      const result = StandardCalendar.nextWorkingDay(new Date('2024-01-01T00:00:00Z'));
      expect(result).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('advances Saturday to Monday', () => {
      // 2024-01-06 (Sat) → 2024-01-08 (Mon)
      const result = StandardCalendar.nextWorkingDay(new Date('2024-01-06T00:00:00Z'));
      expect(result).toEqual(new Date('2024-01-08T00:00:00Z'));
    });

    it('advances Sunday to Monday', () => {
      // 2024-01-07 (Sun) → 2024-01-08 (Mon)
      const result = StandardCalendar.nextWorkingDay(new Date('2024-01-07T00:00:00Z'));
      expect(result).toEqual(new Date('2024-01-08T00:00:00Z'));
    });
  });
});
