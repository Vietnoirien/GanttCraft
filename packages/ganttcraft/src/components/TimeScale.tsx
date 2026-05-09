import React, { useMemo } from 'react';
import { useGanttContext } from './GanttProvider';
import { MS_PER_DAY } from '../engine/layout';
import { ViewMode } from '../types';

const TIME_SCALE_HEIGHT = 48; // pixels for the whole header

/** Number of milliseconds per time unit. */
const MS_PER = {
  day:     MS_PER_DAY,
  week:    MS_PER_DAY * 7,
  month:   MS_PER_DAY * 30.44, // average
  quarter: MS_PER_DAY * 91.31,
  year:    MS_PER_DAY * 365.25,
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns the cell definitions for each row of the multi-tier header.
 * Each cell has a { label, xStart, width } in canvas pixels.
 */
function buildTiers(
  startDate: Date,
  endDate: Date,
  pixelsPerMs: number,
  viewMode: ViewMode
): { upper: Array<{ label: string; x: number; width: number }>; lower: Array<{ label: string; x: number; width: number }> } {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime() + MS_PER_DAY * 7; // add buffer

  const upper: Array<{ label: string; x: number; width: number }> = [];
  const lower: Array<{ label: string; x: number; width: number }> = [];

  if (viewMode === 'day') {
    // Upper: months, Lower: days
    let cursor = new Date(startDate);
    cursor.setUTCDate(1);

    while (cursor.getTime() < endMs) {
      const monthStart = cursor.getTime();
      const nextMonth = new Date(cursor);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      const monthEnd = Math.min(nextMonth.getTime(), endMs);

      upper.push({
        label: `${SHORT_MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
        x: Math.max(0, (monthStart - startMs) * pixelsPerMs),
        width: (monthEnd - Math.max(monthStart, startMs)) * pixelsPerMs,
      });
      cursor = nextMonth;
    }

    // Lower: individual day numbers
    const dayCursor = new Date(startMs);
    dayCursor.setUTCHours(0, 0, 0, 0);
    while (dayCursor.getTime() < endMs) {
      const dayMs = dayCursor.getTime();
      lower.push({
        label: String(dayCursor.getUTCDate()),
        x: (dayMs - startMs) * pixelsPerMs,
        width: MS_PER_DAY * pixelsPerMs,
      });
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }
  } else if (viewMode === 'week') {
    // Upper: months, Lower: week numbers (ISO)
    let mCursor = new Date(startDate);
    mCursor.setUTCDate(1);
    while (mCursor.getTime() < endMs) {
      const mStart = mCursor.getTime();
      const mNext = new Date(mCursor);
      mNext.setUTCMonth(mNext.getUTCMonth() + 1);
      upper.push({
        label: `${SHORT_MONTHS[mCursor.getUTCMonth()]} ${mCursor.getUTCFullYear()}`,
        x: Math.max(0, (mStart - startMs) * pixelsPerMs),
        width: (Math.min(mNext.getTime(), endMs) - Math.max(mStart, startMs)) * pixelsPerMs,
      });
      mCursor = mNext;
    }

    // Lower: weeks starting on Monday
    const wCursor = new Date(startMs);
    const dow = wCursor.getUTCDay();
    wCursor.setUTCDate(wCursor.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    let weekNum = 1;
    while (wCursor.getTime() < endMs) {
      const wMs = wCursor.getTime();
      lower.push({
        label: `W${weekNum}`,
        x: Math.max(0, (wMs - startMs) * pixelsPerMs),
        width: MS_PER.week * pixelsPerMs,
      });
      wCursor.setUTCDate(wCursor.getUTCDate() + 7);
      weekNum++;
    }
  } else if (viewMode === 'month') {
    // Upper: years, Lower: months
    let yCursor = new Date(startDate);
    yCursor.setUTCMonth(0, 1);
    while (yCursor.getTime() < endMs) {
      const yStart = yCursor.getTime();
      const yNext = new Date(yCursor);
      yNext.setUTCFullYear(yNext.getUTCFullYear() + 1);
      upper.push({
        label: String(yCursor.getUTCFullYear()),
        x: Math.max(0, (yStart - startMs) * pixelsPerMs),
        width: (Math.min(yNext.getTime(), endMs) - Math.max(yStart, startMs)) * pixelsPerMs,
      });
      yCursor = yNext;
    }

    let mCursor2 = new Date(startDate);
    mCursor2.setUTCDate(1);
    while (mCursor2.getTime() < endMs) {
      const mStart2 = mCursor2.getTime();
      const mNext2 = new Date(mCursor2);
      mNext2.setUTCMonth(mNext2.getUTCMonth() + 1);
      lower.push({
        label: SHORT_MONTHS[mCursor2.getUTCMonth()],
        x: Math.max(0, (mStart2 - startMs) * pixelsPerMs),
        width: (mNext2.getTime() - mCursor2.getTime()) * pixelsPerMs,
      });
      mCursor2 = mNext2;
    }
  } else if (viewMode === 'quarter') {
    // Upper: years, Lower: Q1-Q4
    let qYearCursor = new Date(startDate);
    qYearCursor.setUTCMonth(0, 1);
    while (qYearCursor.getTime() < endMs) {
      const qYStart = qYearCursor.getTime();
      const qYNext = new Date(qYearCursor);
      qYNext.setUTCFullYear(qYNext.getUTCFullYear() + 1);
      upper.push({
        label: String(qYearCursor.getUTCFullYear()),
        x: Math.max(0, (qYStart - startMs) * pixelsPerMs),
        width: (Math.min(qYNext.getTime(), endMs) - Math.max(qYStart, startMs)) * pixelsPerMs,
      });
      qYearCursor = qYNext;
    }

    const quarters = [
      { label: 'Q1', month: 0 }, { label: 'Q2', month: 3 },
      { label: 'Q3', month: 6 }, { label: 'Q4', month: 9 },
    ];
    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear() + 1;
    for (let y = startYear; y <= endYear; y++) {
      for (const q of quarters) {
        const qStart = Date.UTC(y, q.month, 1);
        const qEnd = Date.UTC(y, q.month + 3, 1);
        if (qStart >= endMs) continue;
        lower.push({
          label: q.label,
          x: Math.max(0, (qStart - startMs) * pixelsPerMs),
          width: (qEnd - qStart) * pixelsPerMs,
        });
      }
    }
  } else {
    // year mode: Upper: decades (rough), Lower: years
    let yCursor2 = new Date(startDate);
    yCursor2.setUTCFullYear(Math.floor(yCursor2.getUTCFullYear() / 10) * 10, 0, 1);
    while (yCursor2.getTime() < endMs) {
      const dStart = yCursor2.getTime();
      const dNext = new Date(yCursor2);
      dNext.setUTCFullYear(dNext.getUTCFullYear() + 10);
      upper.push({
        label: `${yCursor2.getUTCFullYear()}s`,
        x: Math.max(0, (dStart - startMs) * pixelsPerMs),
        width: (Math.min(dNext.getTime(), endMs) - Math.max(dStart, startMs)) * pixelsPerMs,
      });
      yCursor2 = dNext;
    }

    let yCursor3 = new Date(startDate);
    yCursor3.setUTCMonth(0, 1);
    while (yCursor3.getTime() < endMs) {
      const yStart3 = yCursor3.getTime();
      const yNext3 = new Date(yCursor3);
      yNext3.setUTCFullYear(yNext3.getUTCFullYear() + 1);
      lower.push({
        label: String(yCursor3.getUTCFullYear()),
        x: Math.max(0, (yStart3 - startMs) * pixelsPerMs),
        width: (yNext3.getTime() - yCursor3.getTime()) * pixelsPerMs,
      });
      yCursor3 = yNext3;
    }
  }

  return { upper, lower };
}

/** Multi-tier sticky SVG header that renders the time scale for the current viewMode. */
export const TimeScale: React.FC = () => {
  const { startDate, endDate, pixelsPerMs, viewMode } = useGanttContext();

  const { upper, lower } = useMemo(
    () => buildTiers(startDate, endDate, pixelsPerMs, viewMode),
    [startDate, endDate, pixelsPerMs, viewMode]
  );

  const startMs = startDate.getTime();
  const endMs = endDate.getTime() + MS_PER_DAY * 7;
  const totalWidth = Math.max((endMs - startMs) * pixelsPerMs, 800);
  const tierH = TIME_SCALE_HEIGHT / 2;

  return (
    <svg
      width={totalWidth}
      height={TIME_SCALE_HEIGHT}
      style={{
        display: 'block',
        backgroundColor: 'var(--gantt-surface, #f8f9fa)',
        borderBottom: '1px solid var(--gantt-border, #e2e8f0)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* Upper tier cells */}
      {upper.map((cell, i) => (
        <g key={`upper-${i}`}>
          <rect
            x={cell.x}
            y={0}
            width={cell.width}
            height={tierH}
            fill="none"
            stroke="var(--gantt-border, #e2e8f0)"
            strokeWidth={1}
          />
          <text
            x={cell.x + 6}
            y={tierH - 8}
            fontSize={11}
            fontWeight="600"
            fill="var(--gantt-text-primary, #1a202c)"
            clipPath={`url(#clip-upper-${i})`}
          >
            {cell.label}
          </text>
        </g>
      ))}

      {/* Lower tier cells */}
      {lower.map((cell, i) => (
        <g key={`lower-${i}`}>
          <rect
            x={cell.x}
            y={tierH}
            width={cell.width}
            height={tierH}
            fill="none"
            stroke="var(--gantt-border, #e2e8f0)"
            strokeWidth={1}
          />
          <text
            x={cell.x + 4}
            y={TIME_SCALE_HEIGHT - 8}
            fontSize={10}
            fill="var(--gantt-text-muted, #718096)"
          >
            {cell.label}
          </text>
        </g>
      ))}
    </svg>
  );
};
