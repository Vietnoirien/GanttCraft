/** Number of milliseconds in one calendar day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Abstraction over working-time rules.
 * Implementations determine which days count as "working" days.
 */
export interface WorkingCalendar {
  /**
   * Add N working days to a date, returning the new date.
   * Negative values move the date backwards.
   */
  addWorkingDays(date: Date, days: number): Date;

  /**
   * Count working days between two dates (exclusive end).
   * Returns the number of working days from `start` up to (not including) `end`.
   */
  workingDaysBetween(start: Date, end: Date): number;

  /**
   * Snap a raw Date to the next working-day boundary.
   * If the date is already a working day, it is returned unchanged.
   */
  nextWorkingDay(date: Date): Date;
}

/**
 * AllDayCalendar treats every calendar day as a working day (24/7).
 * This preserves the library's original raw-millisecond behaviour as the
 * safe default — no existing tests or consumers are affected when this
 * calendar is used.
 */
export const AllDayCalendar: WorkingCalendar = {
  addWorkingDays: (date: Date, days: number): Date =>
    new Date(date.getTime() + days * MS_PER_DAY),

  workingDaysBetween: (start: Date, end: Date): number =>
    (end.getTime() - start.getTime()) / MS_PER_DAY,

  nextWorkingDay: (date: Date): Date => new Date(date),
};

/**
 * Returns true if the given UTC day-of-week represents a weekend.
 * 0 = Sunday, 6 = Saturday.
 */
function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * StandardCalendar treats Monday–Friday as working days and skips
 * Saturday (6) and Sunday (0) in all date arithmetic.
 */
export const StandardCalendar: WorkingCalendar = {
  addWorkingDays(date: Date, days: number): Date {
    const step = days >= 0 ? 1 : -1;
    let remaining = Math.abs(days);
    let current = new Date(date);

    while (remaining > 0) {
      current = new Date(current.getTime() + step * MS_PER_DAY);
      if (!isWeekend(current)) {
        remaining--;
      }
    }

    return current;
  },

  workingDaysBetween(start: Date, end: Date): number {
    const step = end >= start ? 1 : -1;
    let count = 0;
    let current = new Date(start);

    while (
      step > 0 ? current < end : current > end
    ) {
      if (!isWeekend(current)) {
        count++;
      }
      current = new Date(current.getTime() + step * MS_PER_DAY);
    }

    return count;
  },

  nextWorkingDay(date: Date): Date {
    let current = new Date(date);
    while (isWeekend(current)) {
      current = new Date(current.getTime() + MS_PER_DAY);
    }
    return current;
  },
};
