import { create } from 'zustand';
import { DEFAULT_PARAMS } from '../config/constants';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../config/thresholds';
import { engine } from '../simulation/engine';
import type { Alert, EnvironmentSnapshot, ZoneId } from '../types/environment';
import type { SimParams } from '../types/simulation';

interface SimStore {
  params: SimParams;
  thresholds: Thresholds;
  snapshot: EnvironmentSnapshot;
  alerts: Alert[];
  /** Toast queue of recently fired alerts. */
  toasts: Alert[];
  historyVersion: number;
  running: boolean;

  setParams: (patch: Partial<SimParams>) => void;
  setTotalPeople: (n: number) => void;
  setZonePeople: (zone: ZoneId, n: number) => void;
  setThresholds: (t: Thresholds) => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
  dismissToast: (id: string) => void;
}

export const useSimStore = create<SimStore>((set, get) => ({
  params: structuredClone(DEFAULT_PARAMS),
  thresholds: structuredClone(DEFAULT_THRESHOLDS),
  snapshot: engine.snapshot,
  alerts: [],
  toasts: [],
  historyVersion: 0,
  running: true,

  setParams: (patch) => {
    engine.setParams(patch);
    set({ params: engine.params });
  },
  setTotalPeople: (n) => {
    engine.setTotalPeople(n);
    set({ params: engine.params });
  },
  setZonePeople: (zone, n) => {
    const clamped = Math.min(56, Math.max(0, Math.round(n))); // 56 = seats + standing spots per zone
    const peoplePerZone = { ...engine.params.peoplePerZone, [zone]: clamped };
    engine.setParams({ peoplePerZone });
    set({ params: engine.params });
  },
  setThresholds: (t) => {
    engine.setThresholds(t);
    set({ thresholds: t });
  },
  setRunning: (running) => {
    engine.setRunning(running);
    set({ running });
  },
  setSpeed: (speed) => {
    engine.setParams({ speed });
    set({ params: engine.params });
  },
  reset: () => {
    engine.reset();
    set({ params: engine.params, toasts: [], alerts: [] });
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Wire the engine's throttled publish into the store. Called once from App. */
export function connectEngine() {
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>;
    w.__engine = engine;
    void import('./uiStore').then((m) => {
      w.__ui = m.useUiStore;
    });
  }
  engine.start({
    onSnapshot: (snapshot, alerts, historyVersion) =>
      useSimStore.setState({ snapshot, alerts, historyVersion }),
    onAlert: (alert) =>
      useSimStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), alert] })),
  });
}
