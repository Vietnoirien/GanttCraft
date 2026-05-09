import React, { useCallback, useRef } from 'react';
import { ColumnPanel } from './ColumnPanel/ColumnPanel';
import { SVGRenderer } from '../renderers/SVGRenderer';
import { TimeScale } from './TimeScale';
import { useGanttContext } from './GanttProvider';
import { ResourcePanel } from './ResourcePanel/ResourcePanel';

export const GanttBody: React.FC = () => {
  const { setScrollState } = useGanttContext();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollState(el.scrollTop, el.scrollLeft, el.clientHeight, el.clientWidth);
  }, [setScrollState]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'auto',
        position: 'relative',
        backgroundColor: 'var(--gantt-surface, #f8f9fa)'
      }}
    >
      {/* Left column panel — sticky to the left edge */}
      <div style={{ position: 'sticky', left: 0, zIndex: 20, flexShrink: 0, backgroundColor: 'white' }}>
        <ColumnPanel />
      </div>

      {/* Right timeline panel */}
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Sticky time scale header */}
        <TimeScale />

        {/* SVG task renderer */}
        <SVGRenderer />

        {/* Resource allocation panel */}
        <ResourcePanel />
      </div>
    </div>
  );
};
