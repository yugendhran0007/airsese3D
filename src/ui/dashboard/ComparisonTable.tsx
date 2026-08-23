import { ArrowLeftRight } from 'lucide-react';
import { OUTDOOR_CO2 } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import { useWeatherStore } from '../../state/weatherStore';
import { fmt } from '../../utils/format';

/** Indoor vs outdoor comparison with measured/simulated labels (spec §25). */
export function ComparisonTable() {
  const overall = useSimStore((s) => s.snapshot.overall);
  const { outdoor, source } = useWeatherStore();
  const live = source === 'open-meteo';

  const rows: { label: string; outdoor: string; outdoorTag: string; indoor: string; indoorTag: string }[] = [
    {
      label: 'Temperature',
      outdoor: outdoor ? `${fmt(outdoor.temperature, 1)}°C` : '—',
      outdoorTag: live ? 'M' : 'S',
      indoor: `${fmt(overall.temperature, 1)}°C`,
      indoorTag: 'S',
    },
    {
      label: 'Humidity',
      outdoor: outdoor ? `${fmt(outdoor.humidity)}%` : '—',
      outdoorTag: live ? 'M' : 'S',
      indoor: `${fmt(overall.humidity)}%`,
      indoorTag: 'S',
    },
    {
      label: 'CO₂',
      outdoor: `~${OUTDOOR_CO2} ppm`,
      outdoorTag: 'E',
      indoor: `${fmt(overall.co2)} ppm`,
      indoorTag: 'S',
    },
    {
      label: 'AQI',
      outdoor: outdoor?.aqi != null ? fmt(outdoor.aqi) : '—',
      outdoorTag: live ? 'M' : 'S',
      indoor: 'n/a',
      indoorTag: 'S',
    },
    {
      label: 'Airflow',
      outdoor: outdoor ? `${fmt(outdoor.windSpeed)} km/h wind` : '—',
      outdoorTag: live ? 'M' : 'S',
      indoor: `${fmt(overall.ventilation)}% vent`,
      indoorTag: 'S',
    },
  ];

  return (
    <section className="glass overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <ArrowLeftRight size={13} className="text-accent" />
        <span className="text-xs font-bold tracking-[0.15em] text-ink uppercase">Outdoor vs Indoor</span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[9px] tracking-wider text-ink-faint uppercase">
            <th className="px-4 py-1.5 text-left font-semibold">Param</th>
            <th className="px-2 py-1.5 text-right font-semibold">Outdoor</th>
            <th className="px-4 py-1.5 text-right font-semibold">Indoor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line/50">
              <td className="px-4 py-1.5 text-ink-dim">{r.label}</td>
              <td className="num px-2 py-1.5 text-right text-ink">
                {r.outdoor} <Tag t={r.outdoorTag} />
              </td>
              <td className="num px-4 py-1.5 text-right text-ink">
                {r.indoor} <Tag t={r.indoorTag} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 pb-2 text-[9px] text-ink-faint">M = measured · S = simulated · E = estimate</div>
    </section>
  );
}

function Tag({ t }: { t: string }) {
  const color = t === 'M' ? 'text-ok/80' : t === 'E' ? 'text-ink-faint' : 'text-warn/70';
  return <sup className={`text-[8px] font-bold ${color}`}>{t}</sup>;
}
