import { render } from '@testing-library/react';
import { GanttChart } from '../GanttChart';
import { describe, it, expect } from 'vitest';

describe('GanttChart Headless Mode', () => {
  it('does not inject theme variables when headless={true}', () => {
    const tasks = [
      { id: '1', name: 'Test Task', start: new Date(), end: new Date() }
    ];
    // @ts-ignore - Mock theme for testing
    const theme = { '--gantt-bg': 'red' };
    
    // Normal render: theme is injected
    const { container, unmount } = render(<GanttChart tasks={tasks} theme={theme} />);
    const providerRoot = container.firstChild as HTMLElement;
    expect(providerRoot.style.getPropertyValue('--gantt-bg')).toBe('red');
    unmount();

    // Headless render: theme is NOT injected
    // @ts-ignore - Headless prop is not yet in type definition
    const { container: headlessContainer } = render(
      <GanttChart tasks={tasks} theme={theme} headless={true} />
    );
    const headlessRoot = headlessContainer.firstChild as HTMLElement;
    expect(headlessRoot.style.getPropertyValue('--gantt-bg')).toBe('');
  });
});
