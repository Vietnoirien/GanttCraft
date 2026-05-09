import { describe, it, expect } from 'vitest';
import { defaultI18n, GanttStrings, locales } from './i18n';

describe('i18n Completeness (CR-3.D.1)', () => {
  // All keys that the Gantt UI requires
  const REQUIRED_KEYS: (keyof GanttStrings)[] = [
    'taskName',
    'startDate',
    'endDate',
    'progress',
    'editTask',
    'deleteTask',
  ];

  it('defaultI18n (en) contains all required string keys', () => {
    for (const key of REQUIRED_KEYS) {
      expect(
        defaultI18n.strings[key],
        `Missing key "${key}" in defaultI18n`
      ).toBeDefined();
      expect(defaultI18n.strings[key].length).toBeGreaterThan(0);
    }
  });

  it('all shipped locales contain all required string keys', () => {
    for (const [localeName, locale] of Object.entries(locales)) {
      for (const key of REQUIRED_KEYS) {
        expect(
          locale.strings[key],
          `Missing key "${key}" in locale "${localeName}"`
        ).toBeDefined();
        expect(locale.strings[key].length, `Empty key "${key}" in locale "${localeName}"`).toBeGreaterThan(0);
      }
    }
  });
});
