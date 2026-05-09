import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Focus the menu container on mount to catch keyboard events
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  // Handle outside click and Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < items.length && menuRef.current) {
      const itemsElements = menuRef.current.querySelectorAll('.gantt-context-menu-item');
      (itemsElements[focusedIndex] as HTMLElement)?.focus();
    }
  }, [focusedIndex, items.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        items[focusedIndex].onClick();
        onClose();
      }
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      role="menu"
      ref={menuRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="gantt-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        outline: 'none',
        // Styling from tokens (to be fully integrated later)
        background: 'var(--gantt-bg-surface, #ffffff)',
        border: '1px solid var(--gantt-border-color, #e2e8f0)',
        borderRadius: '6px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '4px',
        minWidth: '160px',
      }}
    >
      {items.map((item, index) => {
        const isFocused = index === focusedIndex;
        const color = item.variant === 'danger' ? 'var(--gantt-text-danger, #ef4444)' : 'var(--gantt-text-primary, #1e293b)';
        
        return (
          <div
            key={item.id}
            role="menuitem"
            tabIndex={-1}
            className="gantt-context-menu-item"
            onMouseEnter={() => setFocusedIndex(index)}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              onClose();
            }}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              borderRadius: '4px',
              color,
              background: isFocused ? 'var(--gantt-bg-hover, #f1f5f9)' : 'transparent',
            }}
          >
            {item.icon && <span className="gantt-context-menu-icon">{item.icon}</span>}
            <span className="gantt-context-menu-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};
