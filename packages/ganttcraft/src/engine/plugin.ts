import { GanttTask } from '../types';

export interface GanttPlugin {
  name: string;
  beforeUpdateTask?: (task: GanttTask) => boolean | void; // Return false to block
  afterUpdateTask?: (task: GanttTask) => void;
  renderTaskOverlay?: (task: GanttTask) => React.ReactNode;
}
