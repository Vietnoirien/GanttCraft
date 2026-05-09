import { enUS, fr, de } from 'date-fns/locale';

/**
 * Type-safe interface for all UI string keys required by GanttCraft.
 * Adding a new key here will cause TypeScript to error on any incomplete locale.
 */
export interface GanttStrings {
  taskName: string;
  startDate: string;
  endDate: string;
  progress: string;
  /** Label for the "Edit Task" context-menu action */
  editTask: string;
  /** Label for the "Delete Task" context-menu action */
  deleteTask: string;
}

export interface I18nOptions {
  locale: typeof enUS; // using date-fns locale type
  strings: GanttStrings;
}

/** English (default) locale */
export const defaultI18n: I18nOptions = {
  locale: enUS,
  strings: {
    taskName: 'Task Name',
    startDate: 'Start Date',
    endDate: 'End Date',
    progress: 'Progress',
    editTask: 'Edit Task',
    deleteTask: 'Delete Task',
  },
};

/** French locale */
const frI18n: I18nOptions = {
  locale: fr,
  strings: {
    taskName: 'Nom de la tâche',
    startDate: 'Date de début',
    endDate: 'Date de fin',
    progress: 'Avancement',
    editTask: 'Modifier la tâche',
    deleteTask: 'Supprimer la tâche',
  },
};

/** German locale */
const deI18n: I18nOptions = {
  locale: de,
  strings: {
    taskName: 'Aufgabenname',
    startDate: 'Startdatum',
    endDate: 'Enddatum',
    progress: 'Fortschritt',
    editTask: 'Aufgabe bearbeiten',
    deleteTask: 'Aufgabe löschen',
  },
};

/**
 * Registry of all shipped locales.
 * Each entry is validated against `I18nOptions` at compile-time,
 * so any missing `GanttStrings` key will be caught by TypeScript.
 */
export const locales: Record<string, I18nOptions> = {
  en: defaultI18n,
  fr: frI18n,
  de: deI18n,
};
