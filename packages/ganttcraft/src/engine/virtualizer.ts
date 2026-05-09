import { VirtualWindow } from '../types';

/**
 * Computes the virtual scroll window for Y-axis row virtualization.
 *
 * Only the rows in [startIndex, endIndex] should be rendered. `offsetY`
 * is the pixel distance from the top of the scrollable content to the
 * first rendered row — apply it as a `paddingTop` or `translateY` on
 * the row container.
 *
 * @param scrollTop     - Current vertical scroll position in pixels
 * @param viewportHeight - Height of the visible scroll area in pixels
 * @param rowHeight      - Fixed height of each row in pixels
 * @param totalTasks     - Total number of tasks (rows) in the list
 * @param bufferRows     - Number of extra rows to render above/below the viewport (default: 5)
 */
export function computeVirtualWindow(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalTasks: number,
  bufferRows = 5
): VirtualWindow {
  const totalHeight = totalTasks * rowHeight;

  if (totalTasks === 0) {
    return { startIndex: 0, endIndex: -1, offsetY: 0, totalHeight: 0 };
  }

  const viewportRows = Math.ceil(viewportHeight / rowHeight);
  const firstVisibleIndex = Math.floor(scrollTop / rowHeight);

  const startIndex = Math.max(0, firstVisibleIndex - bufferRows);
  const endIndex = Math.min(totalTasks - 1, firstVisibleIndex + viewportRows + bufferRows - 1);
  const offsetY = startIndex * rowHeight;

  return { startIndex, endIndex, offsetY, totalHeight };
}

/**
 * Returns true if the task rectangle overlaps the horizontal viewport.
 *
 * Uses a simple interval-overlap check:
 *   task range   = [taskX, taskX + taskWidth]
 *   viewport     = [scrollLeft, scrollLeft + viewportWidth]
 * They overlap iff taskX < viewportRight AND taskRight > viewportLeft.
 *
 * @param taskX        - Left edge of the task in SVG canvas coordinates
 * @param taskWidth    - Width of the task in pixels
 * @param scrollLeft   - Current horizontal scroll position in pixels
 * @param viewportWidth - Width of the visible scroll area in pixels
 */
export function isTaskVisible(
  taskX: number,
  taskWidth: number,
  scrollLeft: number,
  viewportWidth: number
): boolean {
  const taskRight = taskX + taskWidth;
  const viewportRight = scrollLeft + viewportWidth;
  return taskX < viewportRight && taskRight > scrollLeft;
}
