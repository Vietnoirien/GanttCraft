# GanttCraft

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Professional-grade, open-source React Gantt library built with strict TypeScript and modern performance optimizations.

## Installation

```bash
npm install ganttcraft
# or
pnpm add ganttcraft
# or
yarn add ganttcraft
```

## Usage

GanttCraft works out of the box with zero external CSS imports (it uses dynamic CSS variable injection). 

```tsx
import { GanttChart } from 'ganttcraft';

const tasks = [
  { 
    id: '1', 
    title: 'Task 1', 
    start: new Date('2026-05-01'), 
    end: new Date('2026-05-05'), 
    progress: 50 
  },
];

export function MyGantt() {
  return (
    <div style={{ height: '500px' }}>
      <GanttChart tasks={tasks} />
    </div>
  );
}
```

### Next.js (App Router) Integration

GanttCraft is fully SSR-safe. However, since it is a highly interactive component, you should wrap it in a Client Component (`'use client'`) when using Next.js App Router:

```tsx
'use client';

import { GanttChart } from 'ganttcraft';
// ...
```

For advanced use-cases where you want to completely defer loading to the client, you can use Next.js Dynamic Imports:

```tsx
import dynamic from 'next/dynamic';

const GanttChart = dynamic(
  () => import('ganttcraft').then((mod) => mod.GanttChart),
  { ssr: false }
);
```

## Features
- **Critical Path Method (CPM):** Auto-scheduling and float calculation.
- **Resource Leveling:** Built-in conflict resolution algorithm.
- **Dependency Tracking:** Support for Finish-to-Start (FS) and cascading updates.
- **History Management:** Built-in undo/redo capability.
- **Extensible:** Plugin architecture for custom behaviors.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-or-later) - see the [LICENSE](LICENSE) file for details.
