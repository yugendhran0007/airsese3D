import { WEATHER_POLL_MS } from '../config/constants';
import { useUiStore } from '../state/uiStore';
import { useWeatherStore } from '../state/weatherStore';
import { DummyOutdoorProvider } from './DummyOutdoorProvider';
import { OpenMeteoProvider } from './OpenMeteoProvider';

const live = new OpenMeteoProvider();
const dummy = new DummyOutdoorProvider();

let started = false;

/**
 * Outdoor data pump.
 * - Chennai Live mode: polls Open-Meteo every 10 min with retry/backoff. On
 *   failure the last reading is kept and marked stale (spec §52); if there has
 *   never been a live reading, the dummy provider fills in (labeled).
 * - Simulation mode: the dummy provider supplies smooth synthetic Chennai
 *   weather so the whole app runs fully offline.
 */
export function startWeatherPolling() {
  if (started) return;
  started = true;

  let retryDelay = 30_000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(poll, ms);
  };

  const poll = async () => {
    if (timer) clearTimeout(timer);

    if (useUiStore.getState().mode === 'simulation') {
      const reading = await dummy.getCurrent();
      useWeatherStore.getState().applyReading(reading, 'dummy');
      schedule(60_000);
      return;
    }

    const store = useWeatherStore.getState();
    store.setFetching(true);
    try {
      const reading = await live.getCurrent();
      useWeatherStore.getState().applyReading(reading, 'open-meteo');
      retryDelay = 30_000;
      schedule(WEATHER_POLL_MS);
    } catch (err) {
      const state = useWeatherStore.getState();
      state.markFailure(err instanceof Error ? err.message : 'Weather fetch failed');
      if (state.lastSuccess == null || state.source === 'dummy') {
        const fallback = await dummy.getCurrent();
        useWeatherStore.getState().applyReading(fallback, 'dummy');
      }
      schedule(retryDelay);
      retryDelay = Math.min(retryDelay * 2, WEATHER_POLL_MS);
    }
  };

  void poll();
  setInterval(() => useWeatherStore.getState().recomputeStale(), 60_000);

  // Refresh immediately when the user switches modes
  useUiStore.subscribe((state, prev) => {
    if (state.mode !== prev.mode && state.mode !== 'sensor') void poll();
  });
}
