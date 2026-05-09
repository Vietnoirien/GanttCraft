import { describe, it, expect } from 'vitest';
import { computeVirtualWindow, isTaskVisible } from './virtualizer';

describe('computeVirtualWindow', () => {
  it('returns the correct visible range when scrolled to top', () => {
    const result = computeVirtualWindow(0, 400, 40, 100, 5);
    expect(result.startIndex).toBe(0);
    // viewportRows = ceil(400 / 40) = 10, buffer = 5 -> endIndex = 10 + 5 - 1 = 14
    expect(result.endIndex).toBe(14);
    expect(result.offsetY).toBe(0);
    expect(result.totalHeight).toBe(100 * 40);
  });

  it('returns correct range when scrolled down mid-list', () => {
    // scrollTop = 400 means we've scrolled past 10 rows (row index 10 is first visible)
    // startIndex = max(0, 10 - 5) = 5 (with buffer)
    const result = computeVirtualWindow(400, 400, 40, 100, 5);
    expect(result.startIndex).toBe(5);
    // endIndex = 10 + 10 + 5 - 1 = 24  (firstVisible + viewportRows + buffer - 1)
    expect(result.endIndex).toBe(24);
    expect(result.offsetY).toBe(5 * 40); // rendered rows start at row 5
    expect(result.totalHeight).toBe(100 * 40);
  });

  it('clamps endIndex to totalTasks - 1', () => {
    // Near the end: scrollTop = (95 * 40) => firstVisible = 95
    const result = computeVirtualWindow(95 * 40, 400, 40, 100, 5);
    expect(result.startIndex).toBeGreaterThanOrEqual(0);
    expect(result.endIndex).toBe(99); // clamped to last task index
  });

  it('returns full range when task count is small', () => {
    const result = computeVirtualWindow(0, 400, 40, 5, 5);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(4); // clamped: only 5 tasks exist
    expect(result.totalHeight).toBe(5 * 40);
  });

  it('handles empty task list without error', () => {
    const result = computeVirtualWindow(0, 400, 40, 0, 5);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(-1); // nothing to render
    expect(result.totalHeight).toBe(0);
  });

  it('uses default buffer of 5 when not specified', () => {
    const withDefault = computeVirtualWindow(0, 400, 40, 100);
    const withExplicit = computeVirtualWindow(0, 400, 40, 100, 5);
    expect(withDefault).toEqual(withExplicit);
  });
});

describe('isTaskVisible', () => {
  it('returns true for a task fully inside the viewport', () => {
    // viewport: scrollLeft=0, width=800 -> [0, 800]
    // task at x=100, width=200 -> [100, 300] — fully inside
    expect(isTaskVisible(100, 200, 0, 800)).toBe(true);
  });

  it('returns true for a task partially overlapping the left edge', () => {
    // viewport: scrollLeft=200, width=800 -> [200, 1000]
    // task at x=100, width=200 -> [100, 300] — right edge (300) is inside viewport
    expect(isTaskVisible(100, 200, 200, 800)).toBe(true);
  });

  it('returns true for a task partially overlapping the right edge', () => {
    // viewport: scrollLeft=0, width=800 -> [0, 800]
    // task at x=700, width=200 -> [700, 900] — left edge (700) is inside viewport
    expect(isTaskVisible(700, 200, 0, 800)).toBe(true);
  });

  it('returns false for a task entirely to the left of the viewport', () => {
    // viewport: scrollLeft=500, width=800 -> [500, 1300]
    // task at x=100, width=200 -> [100, 300] — entirely before viewport
    expect(isTaskVisible(100, 200, 500, 800)).toBe(false);
  });

  it('returns false for a task entirely to the right of the viewport', () => {
    // viewport: scrollLeft=0, width=800 -> [0, 800]
    // task at x=900, width=200 -> [900, 1100] — entirely after viewport
    expect(isTaskVisible(900, 200, 0, 800)).toBe(false);
  });

  it('returns true for a task that spans the entire viewport', () => {
    // viewport: scrollLeft=100, width=400 -> [100, 500]
    // task at x=50, width=600 -> [50, 650] — fully contains viewport
    expect(isTaskVisible(50, 600, 100, 400)).toBe(true);
  });
});
