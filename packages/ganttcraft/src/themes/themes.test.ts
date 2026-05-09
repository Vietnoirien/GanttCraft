import { describe, it, expect } from 'vitest';
import { defaultTheme } from './default';
import { darkTheme } from './dark';
import { injectTheme } from './index';

const REQUIRED_TOKENS = [
  '--gantt-bg',
  '--gantt-surface',
  '--gantt-border',
  '--gantt-text-primary',
  '--gantt-text-muted',
  '--gantt-task-fill',
  '--gantt-task-fill-hover',
  '--gantt-milestone',
  '--gantt-critical-path',
  '--gantt-progress',
  '--gantt-today-line',
  '--gantt-focus-ring',
];

describe('defaultTheme', () => {
  it('has all required CSS token keys', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(defaultTheme).toHaveProperty(token);
      expect(typeof defaultTheme[token]).toBe('string');
      expect(defaultTheme[token].trim().length).toBeGreaterThan(0);
    }
  });
});

describe('darkTheme', () => {
  it('has all required CSS token keys', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(darkTheme).toHaveProperty(token);
      expect(typeof darkTheme[token]).toBe('string');
      expect(darkTheme[token].trim().length).toBeGreaterThan(0);
    }
  });

  it('has different background color from defaultTheme', () => {
    expect(darkTheme['--gantt-bg']).not.toBe(defaultTheme['--gantt-bg']);
  });
});

describe('injectTheme', () => {
  it('writes all CSS custom properties to the element style', () => {
    const el = document.createElement('div');
    injectTheme(el, defaultTheme);
    for (const token of REQUIRED_TOKENS) {
      expect(el.style.getPropertyValue(token)).toBe(defaultTheme[token]);
    }
  });

  it('overwrites existing theme when called again with a different theme', () => {
    const el = document.createElement('div');
    injectTheme(el, defaultTheme);
    injectTheme(el, darkTheme);
    expect(el.style.getPropertyValue('--gantt-bg')).toBe(darkTheme['--gantt-bg']);
  });

  it('does not throw when element has no existing style', () => {
    const el = document.createElement('div');
    expect(() => injectTheme(el, darkTheme)).not.toThrow();
  });
});
