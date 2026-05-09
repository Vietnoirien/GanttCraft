import { describe, it, expect } from 'vitest';
import { HistoryManager } from './history';

describe('HistoryManager', () => {
  it('pushes a command and can undo it', () => {
    const history = new HistoryManager();
    let state = 1;
    history.execute({
      execute: () => { state = 2; },
      undo: () => { state = 1; }
    });
    expect(state).toBe(2);
    history.undo();
    expect(state).toBe(1);
  });

  it('can redo an undone command', () => {
    const history = new HistoryManager();
    let state = 1;
    history.execute({
      execute: () => { state = 2; },
      undo: () => { state = 1; }
    });
    history.undo();
    history.redo();
    expect(state).toBe(2);
  });
});
