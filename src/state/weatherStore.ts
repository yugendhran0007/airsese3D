import { create } from 'zustand';
import { WEATHER_STALE_MS } from '../config/constants';
import { engine } from '../simulation/engine';
import type { OutdoorConditions } from '../types/environment';

export type WeatherSource = 'open-meteo' | 'dummy';

interface WeatherStore {
  outdoor: OutdoorConditions | null;
  lastSuccess: number | null; // wall ms
  isStale: boolean;
  source: WeatherSource;
  fetching: boolean;
  error: string | null;

  applyReading: (outdoor: OutdoorConditions, source: WeatherSource) => void;
  markFailure: (error: string) => void;
  setFetching: (fetching: boolean) => void;
  recomputeStale: () => void;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  outdoor: null,
  lastSuccess: null,
  isStale: false,
  source: 'dummy',
  fetching: false,
  error: null,

  applyReading: (outdoor, source) => {
    engine.setOutdoor(outdoor);
    set({ outdoor, source, lastSuccess: Date.now(), isStale: false, error: null, fetching: false });
  },
  markFailure: (error) => {
    const { lastSuccess } = get();
    set({
      error,
      fetching: false,
      isStale: lastSuccess == null || Date.now() - lastSuccess > WEATHER_STALE_MS,
    });
  },
  setFetching: (fetching) => set({ fetching }),
  recomputeStale: () => {
    const { lastSuccess } = get();
    if (lastSuccess != null && Date.now() - lastSuccess > WEATHER_STALE_MS) set({ isStale: true });
  },
}));
