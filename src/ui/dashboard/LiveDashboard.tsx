import { useMemo } from 'react';
import { STATUS_COLORS } from '../../config/constants';
import { engine } from '../../simulation/engine';
import { useSimStore } from '../../state/simStore';
import { StatCard } from './StatCard';

const STATUS_LABEL = { green: 'NORMAL', yellow: 'ATTENTION', red: 'ALERT' } as const;

/** Indoor live card stack (spec §23). */
export function LiveDashboard() {
  const overall = useSimStore((s) => s.snapshot.overall);
  const historyVersion = useSimStore((s) => s.historyVersion);

  // Sparklines re-read the ring buffer only when the version bumps (~2 s cadence)
  const sparks = useMemo(() => {
    const h = engine.history.read(40);
    return {
      co2: h.map((s) => s.co2),
      temp: h.map((s) => s.temperature),
      hum: h.map((s) => s.humidity),
      people: h.map((s) => s.people),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyVersion]);

  const color = STATUS_COLORS[overall.status];

  return (
    <section className="glass overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-xs font-bold tracking-[0.15em] text-ink uppercase">AirSense Live</span>
        <span
          className="rounded-lg px-2 py-0.5 text-[10px] font-extrabold tracking-widest"
          style={{ color, background: `${color}1c`, boxShadow: `0 0 14px ${color}44` }}
        >
          ● {STATUS_LABEL[overall.status]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <StatCard label="People" value={overall.people} unit="" spark={sparks.people} accent="#8a9fd4" />
        <StatCard label="CO₂" value={overall.co2} unit="ppm" spark={sparks.co2} accent="#38e1ff" />
        <StatCard label="O₂" value={overall.o2} unit="%" digits={2} accent="#34d399" />
        <StatCard label="Temp" value={overall.temperature} unit="°C" digits={1} spark={sparks.temp} accent="#fbbf24" />
        <StatCard label="Humidity" value={overall.humidity} unit="%" spark={sparks.hum} accent="#60a5fa" />
        <StatCard label="Ventilation" value={overall.ventilation} unit="%" accent="#a78bfa" />
      </div>
    </section>
  );
}
