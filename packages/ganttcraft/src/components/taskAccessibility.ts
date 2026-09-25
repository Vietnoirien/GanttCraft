import { GanttTask } from '../types';
import { I18nOptions } from '../engine/i18n';

/** Keep list and timeline announcements in the same order and wording. */
export function taskAccessibleLabel(task: GanttTask, i18n: I18nOptions): string {
  const date = (value: Date) => value.toLocaleDateString(i18n.locale.code);
  const kind = task.type === 'group' ? 'Group' : task.type === 'milestone' ? 'Milestone' : 'Task';
  return `${kind} ${task.name}, ${i18n.strings.startDate} ${date(task.start)}, ${i18n.strings.endDate} ${date(task.end)}, ${i18n.strings.progress} ${task.progress ?? 0}%`;
}
