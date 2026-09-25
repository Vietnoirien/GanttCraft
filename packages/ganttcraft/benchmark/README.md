# GanttCraft performance benchmark

Run the benchmark from `packages/ganttcraft`:

```bash
npm run benchmark
```

It renders 10,000 independent tasks and measures three paths:

- initial chart mount and unmount;
- five vertical scroll positions through the virtualized chart;
- one progress edit on task 5,000 through `GanttProvider.updateTask`.

The benchmark runs in Vitest's jsdom environment with the repository's Node.js
and dependency versions. jsdom does not paint pixels or model browser layout,
so these numbers measure React and GanttCraft JavaScript work. Use a browser
profiling run before treating them as user-perceived frame times.

The current working thresholds are 500 ms for initial render, 100 ms for the
scroll sweep, and 250 ms for a task edit. They are review targets rather than
an automated CI gate. A run above a threshold should open a performance issue
with the benchmark output and a browser trace.

The first baseline was measured on Linux 7.2.6, Node.js v24.21.0, Vitest 1.6.1,
and an Intel Core i9-9900KF with 16 logical CPUs:

| Operation | Mean |
| --- | ---: |
| Initial render | 4,256 ms |
| Five-position scroll sweep | 3,584 ms |
| Task edit | 1,133 ms |

The main suspected bottleneck is `GanttProvider`'s `visibleTasks` derivation.
Its recursive visibility check calls `tasks.find` for each task, which can
be quadratic for a flat 10,000-task project. A task edit rebuilds the task
array and derived state for every task before the virtualized renderer narrows
the DOM work. The concrete follow-up is to index tasks by ID and rerun this
benchmark before changing the thresholds.
