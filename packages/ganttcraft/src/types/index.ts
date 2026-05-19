/** Defines the relationship between predecessor and successor tasks in the scheduling engine. */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

/**
 * Scheduling constraint mode that restricts task date flexibility.
 * - `ASAP`: As Soon As Possible (default) — task starts as early as dependencies allow.
 * - `ALAP`: As Late As Possible — task is placed at its Latest Start, consuming all float.
 * - `MSO`: Must Start On `constraintDate` — hard pin to a specific date.
 * - `SNET`: Start No Earlier Than `constraintDate` — soft lower-bound on the start date.
 */
export type TaskConstraint = 'ASAP' | 'ALAP' | 'MSO' | 'SNET';

export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

/** Map of CSS custom property names to their values. */
export type GanttTheme = Record<string, string>;

/** Result of the virtualizer math — describes which rows to render. */
export interface VirtualWindow {
  /** Index of the first rendered row (inclusive). */
  startIndex: number;
  /** Index of the last rendered row (inclusive). */
  endIndex: number;
  /** Pixel offset to apply to the rendered rows container (top of startIndex row). */
  offsetY: number;
  /** Total scrollable height in pixels (totalTasks * rowHeight). */
  totalHeight: number;
}

export interface TaskDependency {
  /** ID of the **predecessor** task (the task that must occur first). Note: this is NOT the dependency record's own ID. */
  id: string;
  /** Dependency relationship type: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish). */
  type: DependencyType;
  /** Lag (+) or lead (-) in working days. Default: 0. */
  lag?: number;
}

/** A named resource (person, team, equipment) that can be assigned to tasks. */
export interface GanttResource {
  /** Unique identifier. Must match `TaskAssignment.resourceId` on tasks. */
  id: string;
  /** Display name shown in the Resource Panel. */
  name: string;
  /** Maximum allocation capacity (default: 1.0 = 100%). Use 0.5 for part-time resources. */
  maxUnits?: number;
}

export interface TaskAssignment {
  /** ID of the resource being assigned to the task. */
  resourceId: string;
  /**
   * Allocation fraction (0–1). 1.0 = 100% allocated, 0.5 = 50% part-time.
   * Used by the Resource Panel to detect overallocation (units sum > 1.0 for a resource in a time period).
   */
  units: number;
}

export interface GanttTask {
  /** Unique identifier for the task. Must be stable across renders. */
  id: string;
  /** Display name shown in the task bar and task list column. */
  name: string;
  /** Scheduled start date. Modified by `cascadeSchedule` when auto-scheduling is active. */
  start: Date;
  /** Scheduled end date. Modified by `cascadeSchedule` when auto-scheduling is active. */
  end: Date;
  /** Completion percentage (0–100). Renders as a dark overlay on the task bar. */
  progress?: number;
  /** List of predecessor dependencies. Each entry defines a relationship type (FS/SS/FF/SF) and optional lag. */
  dependencies?: TaskDependency[];
  /** Task rendering variant. 'group' aggregates children's date range. 'milestone' renders as a diamond. Default: 'task'. */
  type?: 'task' | 'group' | 'milestone';
  /** ID of the parent group task. Used for WBS hierarchy and rollup date calculation. */
  parentId?: string;
  /** Original planned start date. **Display-only** — does not affect scheduling calculations. Renders as a gray shadow bar below the task. */
  baselineStart?: Date;
  /** Original planned end date. **Display-only** — does not affect scheduling calculations. */
  baselineEnd?: Date;
  /** Resource assignments for this task. Used by the Resource Panel to calculate utilization. */
  assignments?: TaskAssignment[];
  /**
   * Total float in **milliseconds** (read-only — output of `backwardPass`). Zero or negative means this task is on the critical path.
   * Convert to days: `float / 86400000`.
   */
  float?: number;
  /** Scheduling constraint mode. Interacts with `constraintDate` to restrict when this task may be scheduled. Default: ASAP. */
  constraint?: TaskConstraint;
  /** The date used by `constraint` (required for MSO and SNET modes). Ignored when `constraint` is ASAP or ALAP. */
  constraintDate?: Date;
  /**
   * Optional URL slug or path for this task. When set, a "Navigate" option appears in
   * the context menu. `onTaskNavigate` callback is invoked when the user clicks it.
   */
  slug?: string;
  /** Index signature enabling custom data fields for use with custom column `accessor` functions. */
  [key: string]: any;
}

export interface GanttColumn {
  /** Unique column identifier. Used as the React key for column rendering. */
  id: string;
  /** Column header label displayed in the task list panel. */
  header: string;
  /** Function that extracts the cell value from a task. Used as the default renderer when `renderCell` is not provided. */
  accessor: (task: GanttTask) => string | React.ReactNode;
  /** Optional custom renderer for cell content. Supersedes `accessor` when provided. */
  renderCell?: (task: GanttTask) => React.ReactNode;
  width?: number;
}

export interface LayoutTask extends GanttTask {
  /** Horizontal pixel offset from the left edge of the Gantt chart viewport. Output of `calculateTaskLayout`. */
  x: number;
  /** Vertical pixel offset from the top of the Gantt chart viewport (row index * rowHeight). */
  y: number;
  /** Pixel width of the task bar, proportional to task duration at the current zoom level. */
  width: number;
  /** Pixel height of the task bar row. */
  height: number;
  /** True when the task falls within the current virtual/scroll window. */
  isVisible?: boolean;
}
