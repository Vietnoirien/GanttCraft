# GanttCraft Usage Guide

GanttCraft is a professional-grade, strictly typed, zero-dependency React Gantt library built for performance and enterprise use cases.

## Installation

Install the library using your preferred package manager:

```bash
npm install ganttcraft
# or
pnpm add ganttcraft
# or
yarn add ganttcraft
```

## Basic Usage

To get started, import the `GanttChart` component and provide it with an array of tasks.

```tsx
import { GanttChart } from 'ganttcraft';
import type { GanttTask } from 'ganttcraft';

const tasks: GanttTask[] = [
  {
    id: 'task-1',
    name: 'Project Alpha',
    start: new Date('2026-05-01T00:00:00Z'),
    end: new Date('2026-05-15T00:00:00Z'),
    progress: 50,
    type: 'group'
  },
  {
    id: 'task-2',
    name: 'Design Phase',
    start: new Date('2026-05-01T00:00:00Z'),
    end: new Date('2026-05-05T00:00:00Z'),
    progress: 100,
    parentId: 'task-1', // Creates a hierarchy
    type: 'task'
  }
];

export default function MyGanttApp() {
  return (
    <div style={{ height: '500px', width: '100%' }}>
      <GanttChart tasks={tasks} viewMode="day" />
    </div>
  );
}
```

## Advanced Features

### Working Calendars
GanttCraft supports different working calendars for date arithmetic. The default is `AllDayCalendar` (24/7). You can use `StandardCalendar` to automatically skip weekends (Saturday/Sunday) when dragging tasks or auto-scheduling dependencies.

```tsx
import { GanttChart, StandardCalendar } from 'ganttcraft';

<GanttChart 
  tasks={tasks} 
  calendar={StandardCalendar} 
/>
```

### Critical Path Analysis
Enable `showCriticalPath` to highlight tasks that have zero float (tasks that directly impact the project end date). These tasks will be highlighted in red (customizable via theme).

```tsx
<GanttChart tasks={tasks} showCriticalPath />
```

### Resource Panel
Display a resource allocation histogram by enabling `showResourcePanel`. This uses task `assignments` to calculate utilization and highlights overallocated resources.

```tsx
<GanttChart tasks={tasks} showResourcePanel />
```

### Resource Leveling
Enable automatic resource overallocation resolution:

```tsx
const resources: GanttResource[] = [
  { id: 'alice', name: 'Alice', maxUnits: 1.0 }
];

<GanttChart
  tasks={tasks}
  resources={resources}
  autoSchedule
  autoLevelResources
  onTasksChange={setTasks}
/>
```

When `autoLevelResources` is enabled, non-critical tasks are automatically delayed to
resolve resource overallocation. Critical-path tasks are never moved.

### History Manager (Undo/Redo)
GanttCraft provides a `HistoryManager` to handle undo/redo operations. You can hook it up to your keyboard events or UI buttons to easily implement standard undo functionality.

```tsx
import { HistoryManager } from 'ganttcraft';

// Initialize with an empty history or initial state
const history = new HistoryManager();

// After a task update:
history.pushState(newTasks);

// To Undo:
if (history.canUndo()) {
  const previousTasks = history.undo();
  setTasks(previousTasks);
}

// To Redo:
if (history.canRedo()) {
  const nextTasks = history.redo();
  setTasks(nextTasks);
}
```

### Plugins
Extend GanttCraft by passing an array of plugins to the `plugins` prop. Plugins can intercept task updates or render custom overlays (like special warning icons or external links).

```tsx
const myPlugin = {
  name: 'my-custom-plugin',
  beforeUpdateTask: (task) => {
    // Return false to prevent an update
    if (task.start < new Date()) return false; 
    return true;
  },
  renderTaskOverlay: (task) => (
    task.isOverdue ? <div className="text-red-500">!</div> : null
  )
};

<GanttChart tasks={tasks} plugins={[myPlugin]} />
```

### Internationalization (i18n)
Customize dates and strings by passing an `i18n` object to configure locale-specific formatting. It uses `date-fns` locales for robust date formatting.

GanttCraft ships three built-in locales (`en`, `fr`, `de`) via the `locales` registry:

```tsx
import { GanttChart, locales } from 'ganttcraft';

// Use a built-in locale
<GanttChart tasks={tasks} i18n={locales.fr} />

// Or pass a custom partial override
import { fr } from 'date-fns/locale';

const myI18n = {
  locale: fr,
  strings: {
    taskName: 'Nom de la tâche',
    startDate: 'Date de début',
    endDate: 'Date de fin',
    progress: 'Avancement',
    editTask: 'Modifier la tâche',
    deleteTask: 'Supprimer la tâche',
  }
};

<GanttChart tasks={tasks} i18n={myI18n} />
```

### Interactive Dependency Linking

Users can draw new dependencies directly on the chart by dragging from the circular **link handle** that appears on the right edge of a task bar when hovering, to any other task's **drop zone** on the left edge.

The dependency is persisted via the `onTasksChange` callback and — if `autoSchedule` is enabled — immediately triggers a scheduling cascade so successor dates update in real-time.

```tsx
<GanttChart
  tasks={tasks}
  autoSchedule
  onTasksChange={(updated) => setTasks(updated)}
/>
```

You can also create dependencies programmatically using the `addDependency` method exposed from the context:

```tsx
import { useGanttContext } from 'ganttcraft';

function MyComponent() {
  const { addDependency } = useGanttContext();

  const handleLink = () => {
    addDependency('task-1', 'task-2'); // Creates a Finish-to-Start (FS) dependency
  };

  return <button onClick={handleLink}>Link tasks</button>;
}
```

### Task Context Menu

Right-clicking any task bar opens a floating **context menu** at the cursor position. The menu provides:

| Action | Description |
|--------|-------------|
| **Edit Task** | Integration point for an external edit dialog (hookable via plugin) |
| **Add Dependency** | Future dialog for manually specifying a dependency type |
| **Delete Task** | Removes the task and all references to it in `dependencies` arrays, with full undo/redo support |

The context menu is keyboard-accessible: navigate items with ↑/↓, confirm with Enter, dismiss with Escape.

You can also delete tasks programmatically:

```tsx
import { useGanttContext } from 'ganttcraft';

function MyComponent() {
  const { deleteTask } = useGanttContext();

  return <button onClick={() => deleteTask('task-1')}>Delete Task 1</button>;
}
```

### PNG Export

Export the current chart view as a PNG image. GanttCraft automatically:
1. **Clones** the live SVG to avoid mutating the DOM
2. **Strips** all `<foreignObject>` elements (custom renderers) that cannot be rasterised cross-browser
3. **Inlines** all `var(--gantt-*)` CSS custom property tokens as concrete hex values so theming survives the export

```tsx
import { exportPNG } from 'ganttcraft';

const svgEl = document.querySelector('.gantt-svg') as SVGSVGElement;
await exportPNG(svgEl, 'my-project-gantt.png');
```

You can also supply a token map to override specific theme colors in the export:

```tsx
import { inlineCSSCustomProperties, flattenForeignObjects } from 'ganttcraft';

const clone = svgEl.cloneNode(true) as SVGSVGElement;
flattenForeignObjects(clone);
inlineCSSCustomProperties(clone, {
  '--gantt-task-fill': '#1d4ed8', // Override to brand blue in the export
});
// then serialize clone to canvas as usual
```


### Advanced Dependencies (SS, FF, SF) & Lag
GanttCraft's scheduling engine supports all four standard dependency types (`FS`, `SS`, `FF`, `SF`) and lead/lag times. 
A positive `lag` creates a delay between tasks, while a negative `lag` creates an overlap (lead time).

```tsx
const tasks: GanttTask[] = [
  { id: '1', name: 'Task A', start: new Date('2026-05-01'), end: new Date('2026-05-05') },
  { 
    id: '2', 
    name: 'Task B', 
    start: new Date('2026-05-01'), 
    end: new Date('2026-05-05'), 
    dependencies: [{ id: '1', type: 'SS', lag: 2 }] // Start-to-Start with a 2-day lag
  }
];
```

### Task Constraints
You can pin tasks to specific dates or enforce scheduling rules using the `constraint` and `constraintDate` properties.

Supported constraints:
- `ASAP` (As Soon As Possible - Default)
- `ALAP` (As Late As Possible - Requires Critical Path Analysis / Backward Pass)
- `SNET` (Start No Earlier Than)
- `MSO` (Must Start On)

```tsx
const constrainedTask: GanttTask = {
  id: 'milestone-1',
  name: 'Hard Deadline',
  start: new Date('2026-05-10'),
  end: new Date('2026-05-10'),
  constraint: 'MSO',
  constraintDate: new Date('2026-05-15')
};
```

## API Reference

### `<GanttChart />` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tasks` | `GanttTask[]` | **Required** | The array of task objects to render. |
| `columns` | `GanttColumn[]` | Standard Name/Dates | Configuration for the left-hand data grid. |
| `resources` | `GanttResource[]` | `[]` | List of resources available for assignment. Required for resource leveling and the Resource Panel. |
| `autoLevelResources` | `boolean` | `false` | When true, runs resource leveling after each scheduling cascade. |
| `onTasksChange` | `(tasks: GanttTask[]) => void` | — | Callback fired whenever tasks are mutated (drag, resize, auto-schedule cascade). |
| `autoSchedule` | `boolean` | `false` | When true, runs `cascadeSchedule` on every task change, propagating date shifts. |
| `viewMode` | `'day' \| 'week' \| 'month' \| 'quarter' \| 'year'` | `'day'` | Zoom level — controls the time scale header and pixel density. |
| `theme` | `GanttTheme` | Built-in Light Theme | CSS custom property token map (`Record<string, string>`) to theme the component. |
| `renderTask` | `(task: LayoutTask) => React.ReactNode` | — | Custom renderer replacing the default task bar. |
| `headless` | `boolean` | `false` | If true, suppresses the injection of theme CSS custom properties. |
| `showCriticalPath` | `boolean` | `false` | If true, highlights tasks with `float <= 0` (critical path tasks). |
| `showResourcePanel` | `boolean` | `false` | If true, renders the resource allocation histogram panel below the Gantt chart. |
| `plugins` | `GanttPlugin[]` | `[]` | Plugin instances to install into the Gantt. |
| `i18n` | `Partial<I18nOptions>` | `defaultI18n` | Partial i18n overrides for locale-specific strings. |
| `calendar` | `WorkingCalendar` | `AllDayCalendar` | Working calendar for scheduling and drag snapping. |

### `GanttTask` Structure

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the task. Must be stable across renders. |
| `name` | `string` | Display name of the task. |
| `start` | `Date` | The scheduled start date/time. |
| `end` | `Date` | The scheduled end date/time. |
| `progress` | `number` (Optional) | Completion percentage (0-100). |
| `type` | `'task' \| 'group' \| 'milestone'` (Optional) | Task rendering variant. Default is `'task'`. |
| `parentId` | `string` (Optional) | ID of the parent group task. Used for WBS hierarchy and rollup date calculation. |
| `dependencies` | `TaskDependency[]` (Optional) | Predecessor dependencies. Includes `id`, `type` (`FS`, `SS`, `FF`, `SF`), and optional `lag` (working days, use negative values for lead time). |
| `baselineStart` | `Date` (Optional) | Original planned start date. Display-only (gray shadow bar). |
| `baselineEnd` | `Date` (Optional) | Original planned end date. Display-only. |
| `assignments` | `TaskAssignment[]` (Optional) | Resource assignments. Used by the Resource Panel to calculate utilization. |
| `float` | `number` (Optional) | **Read-only**. Total float in **milliseconds**. Zero or negative means the task is on the critical path. |
| `constraint` | `TaskConstraint` (Optional) | Scheduling constraint (`ASAP`, `ALAP`, `SNET`, `MSO`). |
| `constraintDate` | `Date` (Optional) | Required date for `SNET` and `MSO` constraints. |

### Context API (`useGanttContext`)

If you are building custom UI overlays, external toolbars, or advanced plugins, you can consume the internal Gantt state via the `useGanttContext` hook:

```tsx
import { useGanttContext } from 'ganttcraft';

function CustomGanttToolbar() {
  const { tasks, historyManager, undo, redo, showCriticalPath } = useGanttContext();
  
  return (
    <div>
      <button onClick={undo} disabled={!historyManager.canUndo()}>Undo</button>
      <span>Total Tasks: {tasks.length}</span>
    </div>
  );
}
```

#### Available Context Properties:

| Property | Type | Description |
|----------|------|-------------|
| `tasks` | `GanttTask[]` | The current scheduled state of all tasks. |
| `columns` / `resources` | `array` | The columns and resources passed into the chart. |
| `startDate` / `endDate` | `Date` | The absolute min/max dates across all tasks in the chart. |
| `updateTask` | `(task: GanttTask) => void` | Updates a task, cascades schedule if autoSchedule is on, and registers an undo command. |
| `addDependency` | `(sourceId, targetId) => void` | Programmatically draws an FS dependency between two tasks. |
| `deleteTask` | `(taskId) => void` | Removes a task and cleans up any dangling dependencies pointing to it. |
| `viewMode` | `ViewMode` | The current timescale resolution. |
| `pixelsPerMs` | `number` | The conversion factor for drawing items horizontally. |
| `virtualWindow` | `VirtualWindow` | Describes which rows are currently rendered in the virtualized scroll view. |
| `scrollLeft` / `scrollTop` | `number` | The current scroll coordinates of the Gantt body. |
| `viewportWidth` / `viewportHeight` | `number` | The dimensions of the viewable chart area. |
| `setScrollState` | `function` | Updates scroll coordinates manually. |
| `historyManager` | `HistoryManager` | The internal manager handling the undo/redo stack. |
| `undo` / `redo` | `() => void` | Triggers undo/redo actions directly. |
| `conflicts` | `ConflictMap` | Map of constraint conflicts or scheduling errors detected in the current run. |
| `calendar` / `i18n` | `object` | The active working calendar and string localization config. |

## Theming & Headless Mode

GanttCraft uses CSS Custom Properties (Variables) to style its components.
By default, the library automatically injects a light theme into the DOM tree.

### Overriding the Theme

Pass a `theme` prop to override specific colors or dimensions:

```tsx
<GanttChart
  tasks={tasks}
  theme={{
    colors: {
      primary: '#3b82f6',
      taskBackground: '#eff6ff',
      text: '#1e293b'
    },
    dimensions: {
      headerHeight: 60
    }
  }}
/>
```

### Headless Mode

If your application uses a strict design system (like Tailwind or styled-components) and you want absolute control over styling without our variables interfering, pass `headless={true}`.

```tsx
<GanttChart tasks={tasks} headless={true} />
```

This prevents GanttCraft from injecting **any** CSS variables. You will then need to define all the required CSS variables in your own global stylesheets.

#### Available CSS Custom Properties

When using Headless Mode, you should define the following variables to ensure the chart renders properly:

| CSS Variable | Description | Default (Light Mode) |
|--------------|-------------|----------------------|
| `--gantt-bg` | Main background color of the chart container | `#ffffff` |
| `--gantt-surface` | Background for headers and secondary areas | `#f8f9fa` |
| `--gantt-border` | Color for grid lines and borders | `#e2e8f0` |
| `--gantt-text-primary` | Primary text color | `#1a202c` |
| `--gantt-text-muted` | Secondary/muted text color (e.g. headers) | `#718096` |
| `--gantt-task-fill` | Default background color for task bars | `#4f46e5` |
| `--gantt-task-fill-hover` | Task background on hover | `#4338ca` |
| `--gantt-milestone` | Color for milestone shapes | `#f59e0b` |
| `--gantt-critical-path` | Highlight color for tasks on the critical path | `#ef4444` |
| `--gantt-progress` | Color for the progress bar indicator inside a task | `#22c55e` |
| `--gantt-weekend` | Background color highlighting weekend columns | `rgba(0,0,0,0.03)` |
| `--gantt-today-line` | Color of the vertical "today" indicator line | `#4f46e5` |
| `--gantt-focus-ring` | Outline color when navigating tasks via keyboard | `#4f46e5` |
