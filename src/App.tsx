import { lazy, Suspense, useEffect, useState } from 'react';
import { startWeatherPolling } from './providers/weatherPoller';
import { connectEngine } from './state/simStore';
import { useUiStore } from './state/uiStore';
import { AppShell } from './ui/AppShell';
import { SceneErrorBoundary } from './ui/shell/SceneErrorBoundary';
import { uiScaleForWidth } from './utils/renderScale';

/**
 * The 3D scene is code-split away from the shell.
 *
 * three.js + R3F + drei is ~1.5 MB of the bundle, and importing `Scene` eagerly
 * meant the browser had to download and parse all of it before React could
 * render anything at all — including the dashboard, the navbar and the live
 * readouts, none of which need WebGL. Measured on the production build that
 * held first paint at ~4 s on an empty cache. Split, the shell paints as soon
 * as its own small chunk lands and the office streams in behind it.
 */
const Scene = lazy(() => import('./scene/Scene').then((m) => ({ default: m.Scene })));

/**
 * Interface scale for presentation mode. Only the DOM shell is scaled — the
 * WebGL canvas keeps filling the viewport at its own render budget, so the 3D
 * view gains nothing to draw from a larger interface.
 */
function useShellScale(): number {
  const tvMode = useUiStore((s) => s.tvMode);
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    if (!tvMode) return;
    const on = () => setWidth(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [tvMode]);
  return tvMode ? uiScaleForWidth(width) : 1;
}

export default function App() {
  useEffect(() => {
    connectEngine();
    startWeatherPolling();
  }, []);

  // The browser owns fullscreen, not us: Esc, F11 and the window chrome can all
  // leave it without going through our button. Mirror whatever it decides so
  // the panels come back with the window rather than staying hidden.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) useUiStore.getState().setFullMode(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const shellScale = useShellScale();

  return (
    <div className="relative h-full w-full overflow-hidden bg-base">
      <SceneErrorBoundary>
        {/* No fallback: the shell's own dark background stands in while the
            office chunk lands, so the app is usable before WebGL exists. */}
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </SceneErrorBoundary>
      {shellScale === 1 ? (
        <AppShell />
      ) : (
        // Scaled from the top-left with the box shrunk by the same factor, so
        // the shell still covers exactly the viewport after the transform.
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{
            width: `${100 / shellScale}%`,
            height: `${100 / shellScale}%`,
            transform: `scale(${shellScale})`,
          }}
        >
          <AppShell />
        </div>
      )}
    </div>
  );
}
