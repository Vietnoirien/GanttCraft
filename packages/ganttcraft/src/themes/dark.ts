import { GanttTheme } from '../types';

/**
 * Dark theme token map.
 * CSS custom properties for the GanttCraft library — dark mode.
 * Values sourced from ADR design system in 02_architecture.md §3.
 */
export const darkTheme: GanttTheme = {
  '--gantt-bg':               '#0f172a',
  '--gantt-surface':          '#1e293b',
  '--gantt-border':           '#334155',
  '--gantt-text-primary':     '#f1f5f9',
  '--gantt-text-muted':       '#94a3b8',
  '--gantt-task-fill':        '#6366f1',
  '--gantt-task-fill-hover':  '#818cf8',
  '--gantt-milestone':        '#fbbf24',
  '--gantt-critical-path':    '#f87171',
  '--gantt-progress':         '#4ade80',
  '--gantt-weekend':          'rgba(255,255,255,0.03)',
  '--gantt-today-line':       '#6366f1',
  '--gantt-focus-ring':       '#818cf8',
};
