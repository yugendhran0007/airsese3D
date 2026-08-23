import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { engine } from '../../simulation/engine';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { CorrelationView } from './CorrelationView';
import { HistoryChart, type SeriesDef } from './HistoryChart';

const SERIES: SeriesDef[] = [
  { key: 'co2', name: 'CO₂', color: '#38e1ff', unit: 'ppm', bands: [800, 1200] },
  { key: 'people', name: 'Occupancy', color: '#a78bfa', unit: 'people' },
  { key: 'temperature', name: 'Temperature', color: '#fbbf24', unit: '°C', bands: [26, 28] },
  { key: 'humidity', name: 'Humidity', color: '#60a5fa', unit: '%', bands: [60, 70] },
  { key: 'o2', name: 'O₂', color: '#34d399', unit: '%', domain: [20.5, 21] },
  { key: 'ventilation', name: 'Ventilation', color: '#818cf8', unit: '%', domain: [0, 100] },
  { key: 'outdoorTemp', name: 'Outdoor Temp', color: '#fb923c', unit: '°C' },
  { key: 'outdoorAqi', name: 'Outdoor AQI', color: '#f472b6', unit: 'AQI', bands: [51, 101] },
];

/** Bottom drawer: 8 tabbed history series + correlation view (spec §35, §36). */
export function ChartsDrawer() {
  const open = useUiStore((s) => s.chartsOpen);
  const toggle = useUiStore((s) => s.toggle);
  const historyVersion = useSimStore((s) => s.historyVersion);
  const [tab, setTab] = useState<string>('co2');

  const data = useMemo(
    () => engine.history.read(300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion, open],
  );

  if (!open) return null;
  const activeSeries = SERIES.find((s) => String(s.key) === tab);

  return (
    <section className="glass pointer-events-auto absolute right-4 bottom-4 left-[19rem] max-w-[900px] overflow-hidden fade-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="scroll-thin flex items-center gap-1 overflow-x-auto">
          {SERIES.map((s) => (
            <button
              key={String(s.key)}
              type="button"
              onClick={() => setTab(String(s.key))}
              className={clsx(
                'rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase transition-all',
                tab === String(s.key) ? 'bg-white/10 text-ink' : 'text-ink-faint hover:text-ink-dim',
              )}
              style={tab === String(s.key) ? { color: s.color } : undefined}
            >
              {s.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTab('correlation')}
            className={clsx(
              'rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase transition-all',
              tab === 'correlation' ? 'bg-white/10 text-accent' : 'text-ink-faint hover:text-ink-dim',
            )}
          >
            Correlation
          </button>
        </div>
        <button type="button" onClick={() => toggle('chartsOpen')} className="ml-2 rounded-md px-1 text-ink-faint hover:bg-danger/15 hover:text-danger">
          <span className="text-[15px] leading-none" aria-hidden>🗙</span>
        </button>
      </div>
      <div className="px-3 py-2">
        {data.length < 2 ? (
          <div className="flex h-40 items-center justify-center text-xs text-ink-faint">
            Collecting history — let the simulation run a moment…
          </div>
        ) : tab === 'correlation' ? (
          <CorrelationView data={data} />
        ) : activeSeries ? (
          <HistoryChart data={data} series={activeSeries} />
        ) : null}
      </div>
    </section>
  );
}
