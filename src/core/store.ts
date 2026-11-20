// Tiny observable app state shared by map and UI.
export type LayerId = 'geo' | 'monsoon' | 'dust' | 'temp';
export type Lighting = 'day' | 'real' | 'night';
export type TempMode = 'jan' | 'jul' | 'range';

export interface AppState {
  year: number;
  layer: LayerId;
  lighting: Lighting;
  modernBorders: boolean;
  exaggeration: number;
  monsoonMonth: 'jul' | 'jan';
  playing: boolean;
  tempMode: TempMode;
  tempThreshold: number;
  battle: string | null;
}

type Listener = (s: AppState, prev: AppState) => void;

export class Store {
  private s: AppState;
  private listeners: Listener[] = [];
  constructor(init: AppState) { this.s = init; }
  get(): AppState { return this.s; }
  set(patch: Partial<AppState>): void {
    const prev = this.s;
    const next = { ...prev, ...patch };
    const changed = (Object.keys(patch) as (keyof AppState)[]).some((k) => prev[k] !== next[k]);
    if (!changed) return;
    this.s = next;
    for (const l of this.listeners) l(next, prev);
  }
  subscribe(l: Listener): () => void {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter((x) => x !== l); };
  }
}

export const defaultState = (year: number): AppState => ({
  year, layer: 'geo', lighting: 'day', modernBorders: false, exaggeration: 2,
  monsoonMonth: 'jul', playing: true, tempMode: 'jan', tempThreshold: 0, battle: null,
});
