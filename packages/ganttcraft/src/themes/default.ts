import { GanttTheme } from '../types';

/**
 * Default (light) theme token map.
 * CSS custom properties for the GanttCraft library — light mode.
 * Values sourced from ADR design system in 02_architecture.md §3.
 */
export const defaultTheme: GanttTheme = {
  '--gantt-bg':               '#ffffff',
  '--gantt-surface':          '#f8f9fa',
  '--gantt-border':           '#e2e8f0',
  '--gantt-text-primary':     '#1a202c',
  '--gantt-text-muted':       '#718096',
  '--gantt-task-fill':        '#4f46e5',
  '--gantt-task-fill-hover':  '#4338ca',
  '--gantt-milestone':        '#f59e0b',
  '--gantt-critical-path':    '#ef4444',
  '--gantt-progress':         '#22c55e',
  '--gantt-weekend':          'rgba(0,0,0,0.03)',
  '--gantt-today-line':       '#4f46e5',
  '--gantt-focus-ring':       '#4f46e5',
};
