import { useEffect } from 'react';
import { startWeatherPolling } from './providers/weatherPoller';
import { Scene } from './scene/Scene';
import { connectEngine } from './state/simStore';
import { AppShell } from './ui/AppShell';

export default function App() {
  useEffect(() => {
    connectEngine();
    startWeatherPolling();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-base">
      <Scene />
      <AppShell />
    </div>
  );
}
