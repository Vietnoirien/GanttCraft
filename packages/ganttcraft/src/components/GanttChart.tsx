import React from 'react';
import { GanttProvider } from './GanttProvider';
import { GanttTask, GanttColumn, ViewMode, GanttTheme, LayoutTask, GanttResource } from '../types';
import { GanttBody } from './GanttBody';
import { GanttPlugin } from '../engine/plugin';
import { I18nOptions } from '../engine/i18n';
import { WorkingCalendar } from '../engine/calendar';

export interface GanttChartProps {
  /** The list of tasks to render. Each task must have a unique, stable `id`. */
  tasks: GanttTask[];
  /** Column definitions for the task list panel on the left. Defaults to a single "Name" column. */
  columns?: GanttColumn[];
  /** List of resources available for assignment. Required for resource leveling (`autoLevelResources`) and the Resource Panel. */
  resources?: GanttResource[];
  /** When true, runs resource leveling after each scheduling cascade. */
  autoLevelResources?: boolean;
  /** Callback fired whenever tasks are mutated (drag, resize, auto-schedule cascade). Receives the full updated task array. */
  onTasksChange?: (tasks: GanttTask[]) => void;
  /** When true, runs `cascadeSchedule` on every task change, propagating date shifts through the dependency graph. Default: false. */
  autoSchedule?: boolean;
  /** Zoom level — controls the time scale header and pixel density. Default: 'day'. */
  viewMode?: ViewMode;
  /** CSS custom property token map to theme the component. */
  theme?: GanttTheme;
  /** Custom renderer replacing the default task bar. Receives a LayoutTask. */
  renderTask?: (task: LayoutTask) => React.ReactNode;
  /** If true, suppresses the injection of theme CSS custom properties. */
  headless?: boolean;
  /** When true, highlights tasks with `float <= 0` (critical path tasks) using the `--gantt-critical` CSS custom property (default: red). Requires `autoSchedule` or manual `backwardPass` to populate `task.float`. */
  showCriticalPath?: boolean;
  /** When true, renders the resource allocation histogram panel below the Gantt chart. Requires tasks to have `assignments` populated and resources to be available in context. */
  showResourcePanel?: boolean;
  /** Plugin instances to install into the Gantt. */
  plugins?: GanttPlugin[];
  /** Partial i18n overrides for locale-specific strings. */
  i18n?: Partial<I18nOptions>;
  /** Working calendar for scheduling and drag snapping. Defaults to AllDayCalendar (24/7). */
  calendar?: WorkingCalendar;
  /** When true, enables global Ctrl+Z / Cmd+Z keyboard shortcuts for undo/redo. Default: true. */
  undoRedoEnabled?: boolean;
}

const defaultColumns: GanttColumn[] = [
  { id: 'name', header: 'Name', accessor: (task) => task.name }
];

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  columns = defaultColumns,
  resources,
  autoLevelResources,
  onTasksChange,
  autoSchedule,
  viewMode,
  theme,
  renderTask,
  headless,
  showCriticalPath,
  showResourcePanel,
  plugins,
  i18n,
  calendar,
  undoRedoEnabled = true,
}) => {
  return (
    <GanttProvider
      tasks={tasks}
      columns={columns}
      resources={resources}
      autoLevelResources={autoLevelResources}
      onTasksChange={onTasksChange}
      autoSchedule={autoSchedule}
      viewMode={viewMode}
      theme={theme}
      renderTask={renderTask}
      headless={headless}
      showCriticalPath={showCriticalPath}
      showResourcePanel={showResourcePanel}
      plugins={plugins}
      i18n={i18n}
      calendar={calendar}
      undoRedoEnabled={undoRedoEnabled}
    >
      <div className="gantt-chart-container" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }} role="grid" aria-label="Gantt Chart">
        <GanttBody />
      </div>
    </GanttProvider>
  );
};
