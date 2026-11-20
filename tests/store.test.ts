import { describe, expect, it, vi } from 'vitest';
import { Store, defaultState } from '../src/core/store';

describe('store', () => {
  it('notifies only on real changes with previous state', () => {
    const s = new Store(defaultState(475));
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ year: 475 });
    expect(fn).not.toHaveBeenCalled();
    s.set({ year: 660, layer: 'dust' });
    expect(fn).toHaveBeenCalledTimes(1);
    const [next, prev] = fn.mock.calls[0];
    expect(prev.year).toBe(475);
    expect(next.year).toBe(660);
    expect(next.layer).toBe('dust');
  });
  it('unsubscribes', () => {
    const s = new Store(defaultState(1));
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.set({ lighting: 'night' });
    expect(fn).not.toHaveBeenCalled();
  });
  it('defaults are classroom friendly', () => {
    const d = defaultState(475);
    expect(d).toMatchObject({ layer: 'geo', lighting: 'day', modernBorders: false, monsoonMonth: 'jul', tempMode: 'jan', battle: null });
  });
});
