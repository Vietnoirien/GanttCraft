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

export interface GanttContextValue {
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
  viewportHeight: number;
  viewportWidth: number;
  setScrollState: (top: number, left: number, height: number, width: number) => void;
  showCriticalPath: boolean;
  showResourcePanel: boolean;
  historyManager: HistoryManager;
  undo: () => void;
  redo: () => void;
  plugins?: GanttPlugin[];
  conflicts: ConflictMap;
  i18n: I18nOptions;
  calendar: WorkingCalendar;
  addDependency: (sourceId: string, targetId: string) => void;
  deleteTask: (taskId: string) => void;
  visibleTasks: GanttTask[];
  toggleGroup: (taskId: string) => void;
  collapsedGroupIds: Set<string>;
  onTaskNavigate?: (task: GanttTask) => void;
}

const GanttContext = createContext<GanttContextValue | undefined>(undefined);

const sameTaskReferences = (left: GanttTask[], right: GanttTask[]): boolean =>
  left === right || (left.length === right.length && left.every((task, index) => task === right[index]));

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
  calendar?: WorkingCalendar;
  undoRedoEnabled?: boolean;
  headless?: boolean;
  onTaskNavigate?: (task: GanttTask) => void;
  children: React.ReactNode;
}

export const GanttProvider: React.FC<GanttProviderProps> = ({
  tasks: initialTasks,
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
  onTaskNavigate,
  children,
}) => {
  const [taskState, setTaskState] = useState(() => ({ source: initialTasks, current: initialTasks }));
  const sourceTasks = sameTaskReferences(taskState.source, initialTasks) ||
    sameTaskReferences(taskState.current, initialTasks) ? taskState.current : initialTasks;
  const setTasks = useCallback((nextTasks: GanttTask[]) => {
    setTaskState({ source: initialTasks, current: nextTasks });
  }, [initialTasks]);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const historyManager = useMemo(() => new HistoryManager(), []);
  const mergedI18n = useMemo(() => ({ ...defaultI18n, ...i18n }), [i18n]);

  useEffect(() => {
    if (!sameTaskReferences(initialTasks, taskState.source) &&
        !sameTaskReferences(initialTasks, taskState.current)) {
      historyManager.clear();
    }
  }, [initialTasks, taskState, historyManager]);

  const derivedTasks = useMemo(() => {
    let newTasks = rollupGroups(sourceTasks);
    if (showCriticalPath || autoLevelResources) {
      newTasks = backwardPass(newTasks);
    }
    if (autoLevelResources && resources && resources.length > 0) {
      newTasks = levelResources(newTasks, resources, calendar);
      newTasks = rollupGroups(newTasks);
      if (showCriticalPath) {
        newTasks = backwardPass(newTasks);
      }
    }
    return newTasks;
  }, [sourceTasks, showCriticalPath, autoLevelResources, resources, calendar]);

  const tasks = derivedTasks;

  const conflicts = useMemo(() => detectConflicts(derivedTasks), [derivedTasks]);

  useEffect(() => {
    if (theme && rootRef.current && !headless) {
      injectTheme(rootRef.current, theme);
    }
  }, [theme, headless]);

  const { startDate, endDate } = useMemo(() => {
    if (tasks.length === 0) return { startDate: new Date(), endDate: new Date() };
    const starts = tasks.map((t) => t.start.getTime());
    const ends = tasks.map((t) => t.end.getTime());
    return {
      startDate: new Date(Math.min(...starts)),
      endDate: new Date(Math.max(...ends)),
    };
  }, [tasks]);

  const pixelsPerMs = useMemo(() => viewModeToPixelsPerMs(viewMode), [viewMode]);

  const visibleTasks = useMemo(() => {
    const hiddenMap = new Map<string, boolean>();
    const isHidden = (taskId: string): boolean => {
      if (hiddenMap.has(taskId)) return hiddenMap.get(taskId)!;
      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.parentId) {
        hiddenMap.set(taskId, false);
        return false;
      }
      if (collapsedGroupIds.has(task.parentId)) {
        hiddenMap.set(taskId, true);
        return true;
      }
      const hidden = isHidden(task.parentId);
      hiddenMap.set(taskId, hidden);
      return hidden;
    };
    return tasks.filter(t => !isHidden(t.id));
  }, [tasks, collapsedGroupIds]);

  const virtualWindow = useMemo(() => {
    const ganttAreaHeight = visibleTasks.length * ROW_HEIGHT;
    const clampedScrollTop = Math.min(scrollTop, Math.max(0, ganttAreaHeight - viewportHeight));
    return computeVirtualWindow(clampedScrollTop, viewportHeight, ROW_HEIGHT, visibleTasks.length);
  }, [scrollTop, viewportHeight, visibleTasks.length]);

  const toggleGroup = useCallback((taskId: string) => {
    setCollapsedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const updateTask = useCallback(
    (updatedTask: GanttTask) => {
      for (const plugin of plugins) {
        if (plugin.beforeUpdateTask) {
          if (plugin.beforeUpdateTask(updatedTask) === false) return;
        }
      }

      const oldTasks = [...tasks];

      const doUpdate = (targetTask: GanttTask) => {
        let newTasks = tasks.map((t) => (t.id === targetTask.id ? targetTask : t));
        if (autoSchedule) {
          newTasks = cascadeSchedule(newTasks, targetTask, calendar);
        }
        newTasks = rollupGroups(newTasks);
        if (showCriticalPath || autoLevelResources) {
          newTasks = backwardPass(newTasks);
        }
        if (autoLevelResources && resources && resources.length > 0) {
          newTasks = levelResources(newTasks, resources, calendar);
          newTasks = rollupGroups(newTasks);
          if (showCriticalPath || autoLevelResources) {
            newTasks = backwardPass(newTasks);
          }
        }
        setTasks(newTasks);
        onTasksChange?.(newTasks);
        for (const plugin of plugins) {
          if (plugin.afterUpdateTask) plugin.afterUpdateTask(targetTask);
        }
      };

      historyManager.execute({
        execute: () => doUpdate(updatedTask),
        undo: () => {
          setTasks(oldTasks);
          onTasksChange?.(oldTasks);
        }
      });
    }, [tasks, autoSchedule, onTasksChange, showCriticalPath, autoLevelResources, resources, calendar, historyManager, plugins, setTasks]);

    const undo = useCallback(() => historyManager.undo(), [historyManager]);
    const redo = useCallback(() => historyManager.redo(), [historyManager]);

    const addDependency = useCallback((sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const targetTask = tasks.find(t => t.id === targetId);
      const sourceTask = tasks.find(t => t.id === sourceId);
      if (!targetTask || !sourceTask) return;

      const existingDeps = targetTask.dependencies || [];
      if (existingDeps.some(d => d.id === sourceId)) return;

      let updatedTargetTask: GanttTask = {
        ...targetTask,
        dependencies: [...existingDeps, { id: sourceId, type: 'FS' as const }]
      };

      if (autoSchedule) {
        let tempTasks = tasks.map(t => t.id === targetId ? updatedTargetTask : t);
        tempTasks = cascadeSchedule(tempTasks, sourceTask, calendar);
        updatedTargetTask = tempTasks.find(t => t.id === targetId)!;
      }
      updateTask(updatedTargetTask);
    }, [tasks, updateTask, autoSchedule, calendar]);

    const deleteTask = useCallback((taskId: string) => {
      if (!tasks.some(t => t.id === taskId)) return;
      const oldTasks = [...tasks];
      const successors = tasks.filter(t => t.dependencies?.some(d => d.id === taskId));
      let newTasks = tasks.filter(t => t.id !== taskId);
      newTasks = newTasks.map(t => {
        const dependencies = t.dependencies?.filter(d => d.id !== taskId);
        if (dependencies?.length !== t.dependencies?.length || t.parentId === taskId) {
          return { ...t, dependencies, parentId: t.parentId === taskId ? undefined : t.parentId };
        }
        return t;
      });

      if (autoSchedule) {
        const projectStart = tasks.length > 0
          ? new Date(Math.min(...tasks.map(t => t.start.getTime())))
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
              newStart = calendar.nextWorkingDay(projectStart);
            }
            if (t.constraint === 'SNET') newStart = calendar.nextWorkingDay(newStart);
            newTasks[succIdx] = { ...t, start: newStart, end: new Date(newStart.getTime() + duration) };
          }
        });
        successors.forEach(succ => {
          const modifiedSucc = newTasks.find(t => t.id === succ.id);
          if (modifiedSucc) {
            if (modifiedSucc.dependencies && modifiedSucc.dependencies.length > 0) {
              modifiedSucc.dependencies.forEach(dep => {
                const remainingPred = newTasks.find(t => t.id === dep.id);
                if (remainingPred) {
                  newTasks = cascadeSchedule(newTasks, remainingPred, calendar);
                }
              });
            } else {
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
        newTasks = rollupGroups(newTasks);
        newTasks = backwardPass(newTasks);
      }
      historyManager.execute({
        execute: () => {
          setTasks(newTasks);
          onTasksChange?.(newTasks);
        },
        undo: () => {
          setTasks(oldTasks);
          onTasksChange?.(oldTasks);
        }
      });
    }, [tasks, autoSchedule, showCriticalPath, autoLevelResources, resources, calendar, onTasksChange, historyManager, setTasks]);

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
        tasks,
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
        visibleTasks,
        toggleGroup,
        collapsedGroupIds,
        onTaskNavigate,
      }),
      [
        tasks,
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
        visibleTasks,
        toggleGroup,
        collapsedGroupIds,
        onTaskNavigate,
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
