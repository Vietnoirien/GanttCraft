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

/** A non-working day identified by its UTC calendar date. */
export interface HolidayException {
  date: string;
  name: string;
}

export interface StandardCalendarOptions {
  holidays?: HolidayException[];
}

/** Create a Monday–Friday calendar that also skips the supplied holidays. */
export function createStandardCalendar({ holidays = [] }: StandardCalendarOptions = {}): WorkingCalendar {
  const holidayDates = new Set(holidays.map(holiday => {
    const parsed = new Date(`${holiday.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday.date) ||
        Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== holiday.date ||
        !holiday.name.trim()) {
      throw new RangeError('Holidays require a valid YYYY-MM-DD date and a name');
    }
    return holiday.date;
  }));

  const isWorkingDay = (date: Date) =>
    !isWeekend(date) && !holidayDates.has(date.toISOString().slice(0, 10));

  const snapToNextWorkingDay = (date: Date): Date => {
    let current = new Date(date);
    while (!isWorkingDay(current)) {
      current = new Date(current.getTime() + MS_PER_DAY);
    }
    return current;
  };

  return {
    addWorkingDays(date: Date, days: number): Date {
      if (!Number.isFinite(days)) throw new RangeError('Working days must be finite');
      const step = days >= 0 ? 1 : -1;
      let remaining = Math.trunc(Math.abs(days));
      let current = new Date(date);

      while (remaining > 0) {
        current = new Date(current.getTime() + step * MS_PER_DAY);
        if (isWorkingDay(current)) remaining--;
      }

      // Whole-day moves retain the caller's time of day. For a partial day,
      // consume only working hours, crossing excluded dates when necessary.
      let remainingMs = Math.round((Math.abs(days) - Math.trunc(Math.abs(days))) * MS_PER_DAY);
      while (remainingMs > 0) {
        if (step > 0) {
          const dayStart = new Date(current).setUTCHours(0, 0, 0, 0);
          if (!isWorkingDay(current)) {
            current = new Date(dayStart + MS_PER_DAY);
            continue;
          }
          const consumed = Math.min(remainingMs, dayStart + MS_PER_DAY - current.getTime());
          current = new Date(current.getTime() + consumed);
          remainingMs -= consumed;
          if (remainingMs === 0 && !isWorkingDay(current)) {
            current = snapToNextWorkingDay(current);
          }
        } else {
          const preceding = new Date(current.getTime() - 1);
          const dayStart = preceding.setUTCHours(0, 0, 0, 0);
          if (!isWorkingDay(preceding)) {
            current = new Date(dayStart);
            continue;
          }
          const consumed = Math.min(remainingMs, current.getTime() - dayStart);
          current = new Date(current.getTime() - consumed);
          remainingMs -= consumed;
        }
      }

      return current;
    },

    workingDaysBetween(start: Date, end: Date): number {
      const reversed = end < start;
      let count = 0;
      let current = (reversed ? end : start).getTime();
      const endMs = (reversed ? start : end).getTime();

      while (current < endMs) {
        const dayStart = new Date(current).setUTCHours(0, 0, 0, 0);
        const next = Math.min(endMs, dayStart + MS_PER_DAY);
        if (isWorkingDay(new Date(current))) count += (next - current) / MS_PER_DAY;
        current = next;
      }

      return reversed ? -count : count;
    },

    nextWorkingDay: snapToNextWorkingDay,
  };
}

/** Monday–Friday calendar with no holiday exceptions. */
export const StandardCalendar: WorkingCalendar = createStandardCalendar();
