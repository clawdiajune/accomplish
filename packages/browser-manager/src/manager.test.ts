import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserManager } from './manager.js';
import type { BrowserState } from './types.js';

describe('BrowserManager', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  it('starts in idle state', () => {
    expect(manager.getState().status).toBe('idle');
  });

  it('allows subscription', () => {
    const states: string[] = [];
    const unsubscribe = manager.subscribe((state) => {
      states.push(state.status);
    });
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('notifies subscribers on state change', () => {
    const states: string[] = [];
    manager.subscribe((state) => {
      states.push(state.status);
    });

    // Internal method to test state changes
    const newState: BrowserState = { status: 'launching', port: 9224 };
    (manager as unknown as { setState: (s: BrowserState) => void }).setState(newState);

    expect(states).toContain('launching');
  });
});
