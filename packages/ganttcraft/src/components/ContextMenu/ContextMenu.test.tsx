import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  const dummyItem = { id: 'dummy', label: 'Dummy', onClick: vi.fn() };

  it('renders at specified coordinates', () => {
    render(<ContextMenu x={100} y={200} items={[dummyItem]} onClose={() => {}} />);
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('200px');
    expect(menu.style.position).toBe('fixed');
  });

  it('renders items and calls onClick', () => {
    const onClick = vi.fn();
    const items = [
      { id: '1', label: 'Item 1', onClick },
    ];
    render(<ContextMenu x={0} y={0} items={items} onClose={() => {}} />);
    
    const item = screen.getByText('Item 1');
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ContextMenu x={0} y={0} items={[dummyItem]} onClose={onClose} />
      </div>
    );
    
    act(() => {
      fireEvent.mouseDown(screen.getByTestId('outside'));
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={[dummyItem]} onClose={onClose} />);
    
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('supports keyboard navigation', () => {
    const onClick1 = vi.fn();
    const onClick2 = vi.fn();
    const items = [
      { id: '1', label: 'Item 1', onClick: onClick1 },
      { id: '2', label: 'Item 2', onClick: onClick2 },
    ];
    render(<ContextMenu x={0} y={0} items={items} onClose={() => {}} />);
    
    const menu = screen.getByRole('menu');
    
    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowDown' }); // Focus item 1
    });
    expect(document.activeElement?.textContent).toBe('Item 1');
    
    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowDown' }); // Focus item 2
    });
    expect(document.activeElement?.textContent).toBe('Item 2');
    
    act(() => {
      fireEvent.keyDown(menu, { key: 'Enter' }); // Select item 2
    });
    expect(onClick2).toHaveBeenCalled();
  });
});
