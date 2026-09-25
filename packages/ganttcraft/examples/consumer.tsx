import {
  GanttChart,
  HistoryManager,
  createStandardCalendar,
  exportCSV,
  exportJSON,
  importJSON,
  exportPNG,
  locales,
  useGanttContext,
} from 'ganttcraft';
import type { GanttPlugin, GanttTask } from 'ganttcraft';

const tasks: GanttTask[] = [{
  id: '1',
  name: 'Task 1',
  start: new Date('2026-05-01T00:00:00Z'),
  end: new Date('2026-05-05T00:00:00Z'),
  progress: 50,
}];

const calendar = createStandardCalendar({
  holidays: [{ date: '2026-05-04', name: 'Holiday' }],
});

const plugin: GanttPlugin = {
  name: 'example',
  beforeUpdateTask: task => task.end >= task.start,
};

function TaskAction() {
  const { deleteTask } = useGanttContext();
  return <button onClick={() => deleteTask('1')}>Delete task</button>;
}

export function Example() {
  return (
    <GanttChart
      tasks={tasks}
      calendar={calendar}
      i18n={locales.fr}
      plugins={[plugin]}
      renderTask={() => <TaskAction />}
    />
  );
}

const saved = exportJSON(tasks);
const restored: GanttTask[] = importJSON(saved);
const csv: string = exportCSV(restored);
const history = new HistoryManager();
const saveImage: typeof exportPNG = exportPNG;
void csv;
void history;
void saveImage;
