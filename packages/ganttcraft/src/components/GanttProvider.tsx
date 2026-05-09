import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { GanttTask, GanttColumn, ViewMode, GanttTheme, VirtualWindow, LayoutTask, GanttResource } from '../types';
import { cascadeSchedule } from '../engine/scheduler';
import { viewModeToPixelsPerMs, ROW_HEIGHT } from '../engine/layout';
import { computeVirtualWindow } from '../engine/virtualizer';
import { injectTheme } from '../themes';
import { HistoryManager } from '../engine/history';
import { backwardPass, rollupGroups } from '../engine/scheduler';
import { levelResources } from '../engine/resourceLeveling';
import { GanttPlugin } from '../engine/plugin';
import { detectConflicts, ConflictMap } from '../engine/conflict';
import { I18nOptions, defaultI18n } from '../engine/i18n';
import { WorkingCalendar, AllDayCalendar } from '../engine/calendar';

interface GanttContextValue {
  tasks: GanttTask[];
  columns: GanttColumn[];
  resources?: GanttResource[];
  startDate: Date;
  endDate: Date;
  updateTask: (updatedTask: GanttTask) => void;
  viewMode: ViewMode;
  pixelsPerMs: number;
  renderTask?: (task: LayoutTask) => React.ReactNode;
  virtualWindow: VirtualWindow;
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  setScrollState: (top: number, left: number, height: number, width: number) => void;
  showCriticalPath: boolean;
  showResourcePanel: boolean;
  historyManager: HistoryManager;
  undo: () => void;
  redo: () => void;
  plugins?: GanttPlugin[];
  conflicts: ConflictMap;
  i18n: I18nOptions;
  /** Working calendar used for date arithmetic in scheduling and drag snapping. */
  calendar: WorkingCalendar;
  addDependency: (sourceId: string, targetId: string) => void;
  deleteTask: (taskId: string) => void;
}

const GanttContext = createContext<GanttContextValue | undefined>(undefined);

export const useGanttContext = () => {
  const context = useContext(GanttContext);
  if (!context) {
    throw new Error('useGanttContext must be used within a GanttProvider');
  }
  return context;
};

export interface GanttProviderProps {
  tasks: GanttTask[];
  columns: GanttColumn[];
  resources?: GanttResource[];
  autoLevelResources?: boolean;
  onTasksChange?: (tasks: GanttTask[]) => void;
  autoSchedule?: boolean;
  viewMode?: ViewMode;
  theme?: GanttTheme;
  renderTask?: (task: LayoutTask) => React.ReactNode;
  showCriticalPath?: boolean;
  showResourcePanel?: boolean;
  plugins?: GanttPlugin[];
  i18n?: Partial<I18nOptions>;
  /** Working calendar used for scheduling and drag snapping. Defaults to AllDayCalendar (24/7). */
  calendar?: WorkingCalendar;
  /** When true, enables global Ctrl+Z / Cmd+Z keyboard shortcuts for undo/redo. Default: true. */
  undoRedoEnabled?: boolean;
  headless?: boolean;
  children: React.ReactNode;
}

export const GanttProvider: React.FC<GanttProviderProps> = ({
  tasks: externalTasks,
  columns,
  resources,
  autoLevelResources,
  onTasksChange,
  autoSchedule = true,
  viewMode = 'day',
  theme,
  renderTask,
  showCriticalPath = false,
  showResourcePanel = false,
  plugins = [],
  i18n,
  calendar = AllDayCalendar,
  undoRedoEnabled = true,
  headless,
  children,
}) => {
  const [internalTasks, setInternalTasks] = useState<GanttTask[]>(externalTasks);
  const [conflicts, setConflicts] = useState<ConflictMap>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [viewportWidth, setViewportWidth] = useState(800);
  const rootRef = useRef<HTMLDivElement>(null);

  const historyManager = useMemo(() => new HistoryManager(), []);
  
  const mergedI18n = useMemo(() => ({ ...defaultI18n, ...i18n }), [i18n]);

  // Sync with external tasks when they change
  useEffect(() => {
    let newTasks = rollupGroups(externalTasks);
    if (showCriticalPath || autoLevelResources) {
      newTasks = backwardPass(newTasks);
    }
    if (autoLevelResources && resources && resources.length > 0) {
      newTasks = levelResources(newTasks, resources, calendar);
      newTasks = rollupGroups(newTasks); // Recalculate group bounds after children have been shifted
      if (showCriticalPath) {
        newTasks = backwardPass(newTasks);
      }
    }
    setInternalTasks(newTasks);
    setConflicts(detectConflicts(newTasks));
  }, [externalTasks, showCriticalPath, autoLevelResources, resources, calendar]);

  // Inject theme CSS custom properties onto the root element
  useEffect(() => {
    if (theme && rootRef.current && !headless) {
      injectTheme(rootRef.current, theme);
    }
  }, [theme, headless]);

  const { startDate, endDate } = useMemo(() => {
    if (internalTasks.length === 0) {
      return { startDate: new Date(), endDate: new Date() };
    }
    const starts = internalTasks.map((t) => t.start.getTime());
    const ends = internalTasks.map((t) => t.end.getTime());
    return {
      startDate: new Date(Math.min(...starts)),
      endDate: new Date(Math.max(...ends)),
    };
  }, [internalTasks]);

  const pixelsPerMs = useMemo(() => viewModeToPixelsPerMs(viewMode), [viewMode]);

  const virtualWindow = useMemo(
    () => computeVirtualWindow(scrollTop, viewportHeight, ROW_HEIGHT, internalTasks.length),
    [scrollTop, viewportHeight, internalTasks.length]
  );

  const updateTask = useCallback(
    (updatedTask: GanttTask) => {
      // Run beforeUpdateTask plugin hooks
      for (const plugin of plugins) {
        if (plugin.beforeUpdateTask) {
          const result = plugin.beforeUpdateTask(updatedTask);
          if (result === false) return; // Hook blocked mutation
        }
      }

      // Save old state for undo
      const oldTasks = [...internalTasks];
      
      const doUpdate = (targetTask: GanttTask) => {
        let newTasks = internalTasks.map((t) => (t.id === targetTask.id ? targetTask : t));

        if (autoSchedule) {
          newTasks = cascadeSchedule(newTasks, targetTask, calendar);
        }
        newTasks = rollupGroups(newTasks);
        if (showCriticalPath || autoLevelResources) {
          newTasks = backwardPass(newTasks);
        }
        if (autoLevelResources && resources && resources.length > 0) {
          newTasks = levelResources(newTasks, resources, calendar);
          newTasks = rollupGroups(newTasks); // Recalculate group bounds after children have been shifted
          if (showCriticalPath || autoLevelResources) {
            newTasks = backwardPass(newTasks);
          }
        }

        setInternalTasks(newTasks);
        setConflicts(detectConflicts(newTasks));
        onTasksChange?.(newTasks);

        // Run afterUpdateTask plugin hooks
        for (const plugin of plugins) {
          if (plugin.afterUpdateTask) {
            plugin.afterUpdateTask(targetTask);
          }
        }
      };

      // Wrap in command
      historyManager.execute({
        execute: () => doUpdate(updatedTask),
        undo: () => {
          setInternalTasks(oldTasks);
          setConflicts(detectConflicts(oldTasks));
          onTasksChange?.(oldTasks);
        }
      });
    },
    [internalTasks, autoSchedule, onTasksChange, showCriticalPath, historyManager, plugins]
  );

  const undo = useCallback(() => historyManager.undo(), [historyManager]);
  const redo = useCallback(() => historyManager.redo(), [historyManager]);

  const addDependency = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const targetTask = internalTasks.find(t => t.id === targetId);
    const sourceTask = internalTasks.find(t => t.id === sourceId);
    if (!targetTask || !sourceTask) return;
    
    const existingDeps = targetTask.dependencies || [];
    if (existingDeps.some(d => d.id === sourceId)) return;

    let updatedTargetTask: GanttTask = {
      ...targetTask,
      dependencies: [...existingDeps, { id: sourceId, type: 'FS' as const }]
    };

    if (autoSchedule) {
      // Pre-cascade from sourceTask to calculate the new start date for targetTask
      let tempTasks = internalTasks.map(t => t.id === targetId ? updatedTargetTask : t);
      tempTasks = cascadeSchedule(tempTasks, sourceTask, calendar);
      updatedTargetTask = tempTasks.find(t => t.id === targetId)!;
    }
    
    updateTask(updatedTargetTask);
  }, [internalTasks, updateTask, autoSchedule, calendar]);

  const deleteTask = useCallback((taskId: string) => {
    // Save old state for undo
    const oldTasks = [...internalTasks];
    
    // Identify successors before deleting the task
    const successors = internalTasks.filter(t => t.dependencies?.some(d => d.id === taskId));

    // Remove the task
    let newTasks = internalTasks.filter(t => t.id !== taskId);
    
    // Remove any dependencies referencing this task
    newTasks = newTasks.map(t => {
      if (t.dependencies && t.dependencies.some(d => d.id === taskId)) {
        return {
          ...t,
          dependencies: t.dependencies.filter(d => d.id !== taskId)
        };
      }
      return t;
    });

    if (autoSchedule) {
      // Find tasks that depended on the deleted task to re-evaluate them
      const projectStart = internalTasks.length > 0 
        ? new Date(Math.min(...internalTasks.map(t => t.start.getTime()))) 
        : new Date();

      successors.forEach(succ => {
        const succIdx = newTasks.findIndex(t => t.id === succ.id);
        if (succIdx !== -1) {
          const t = newTasks[succIdx];
          const duration = t.end.getTime() - t.start.getTime();
          let newStart: Date;
          if (t.constraint === 'MSO' || t.constraint === 'SNET') {
            newStart = new Date(t.constraintDate || projectStart);
          } else {
            newStart = new Date(projectStart);
          }
          newTasks[succIdx] = { ...t, start: newStart, end: new Date(newStart.getTime() + duration) };
        }
      });

      // Run cascadeSchedule for each modified successor to push them to their correct new dates
      successors.forEach(succ => {
        const modifiedSucc = newTasks.find(t => t.id === succ.id);
        if (modifiedSucc) {
          if (modifiedSucc.dependencies && modifiedSucc.dependencies.length > 0) {
            // It has other predecessors. Cascade from them to push this successor forward.
            modifiedSucc.dependencies.forEach(dep => {
              const remainingPred = newTasks.find(t => t.id === dep.id);
              if (remainingPred) {
                newTasks = cascadeSchedule(newTasks, remainingPred, calendar);
              }
            });
          } else {
            // It has no predecessors. Cascade from itself to push its successors forward.
            newTasks = cascadeSchedule(newTasks, modifiedSucc, calendar);
          }
        }
      });
    }

    newTasks = rollupGroups(newTasks);
    if (showCriticalPath || autoLevelResources) {
      newTasks = backwardPass(newTasks);
    }
    if (autoLevelResources && resources && resources.length > 0) {
      newTasks = levelResources(newTasks, resources, calendar);
      newTasks = rollupGroups(newTasks); // Recalculate group bounds after children have been shifted
      if (showCriticalPath || autoLevelResources) {
        newTasks = backwardPass(newTasks);
      }
    }

    historyManager.execute({
      execute: () => {
        setInternalTasks(newTasks);
        setConflicts(detectConflicts(newTasks));
        onTasksChange?.(newTasks);
      },
      undo: () => {
        setInternalTasks(oldTasks);
        setConflicts(detectConflicts(oldTasks));
        onTasksChange?.(oldTasks);
      }
    });
  }, [internalTasks, autoSchedule, showCriticalPath, onTasksChange, historyManager]);

  useEffect(() => {
    if (!undoRedoEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, undoRedoEnabled]);

  const setScrollState = useCallback(
    (top: number, left: number, height: number, width: number) => {
      setScrollTop(top);
      setScrollLeft(left);
      setViewportHeight(height);
      setViewportWidth(width);
    },
    []
  );

  const value = useMemo(
    () => ({
      tasks: internalTasks,
      columns,
      resources,
      startDate,
      endDate,
      updateTask,
      viewMode,
      pixelsPerMs,
      renderTask,
      virtualWindow,
      scrollLeft,
      scrollTop,
      viewportHeight,
      viewportWidth,
      setScrollState,
      showCriticalPath,
      showResourcePanel,
      historyManager,
      undo,
      redo,
      plugins,
      conflicts,
      i18n: mergedI18n,
      calendar,
      addDependency,
      deleteTask,
    }),
    [
      internalTasks,
      columns,
      resources,
      startDate,
      endDate,
      updateTask,
      viewMode,
      pixelsPerMs,
      renderTask,
      virtualWindow,
      scrollLeft,
      scrollTop,
      viewportHeight,
      viewportWidth,
      setScrollState,
      showCriticalPath,
      showResourcePanel,
      historyManager,
      undo,
      redo,
      plugins,
      conflicts,
      mergedI18n,
      calendar,
      addDependency,
      deleteTask,
    ]
  );

  return (
    <GanttContext.Provider value={value}>
      <div ref={rootRef} style={{ display: 'contents' }}>
        {children}
      </div>
    </GanttContext.Provider>
  );
};
