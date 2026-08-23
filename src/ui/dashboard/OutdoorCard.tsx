import { CloudSun, Droplets, Gauge, Wind } from 'lucide-react';
import { useWeatherStore } from '../../state/weatherStore';
import { aqiBand } from '../../utils/aqi';
import { fmt, istTime } from '../../utils/format';

/** Chennai outdoor conditions card with source + timestamp + stale badge (spec §24, §52). */
export function OutdoorCard() {
  const { outdoor, isStale, source, error } = useWeatherStore();

  if (!outdoor) {
    return (
      <section className="glass px-4 py-3 text-xs text-ink-faint">
        <span className="animate-pulse">Fetching Chennai weather…</span>
      </section>
    );
  }

  const band = aqiBand(outdoor.aqi);

  return (
    <section className="glass overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-ink uppercase">
          <CloudSun size={14} className="text-warn" /> Chennai Outdoor
        </span>
        <div className="flex items-center gap-1.5">
          {isStale && (
            <span className="rounded bg-danger/15 px-1.5 py-px text-[9px] font-bold tracking-wider text-danger">
              STALE
            </span>
          )}
          <span className="rounded bg-white/5 px-1.5 py-px text-[9px] font-bold tracking-wider text-ink-faint">
            {source === 'open-meteo' ? 'OPEN-METEO' : 'SIMULATED'}
          </span>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="num text-3xl leading-none font-bold text-ink">{fmt(outdoor.temperature, 1)}°C</div>
            <div className="mt-1 text-[11px] text-ink-dim">{outdoor.condition}</div>
          </div>
          <div className="space-y-1 text-right text-[11px] text-ink-dim">
            <div className="flex items-center justify-end gap-1">
              <Droplets size={11} className="text-accent/70" />
              <span className="num">{fmt(outdoor.humidity)}%</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Wind size={11} className="text-accent/70" />
              <span className="num">{fmt(outdoor.windSpeed)} km/h</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Gauge size={11} className="text-accent/70" />
              <span className="num">{fmt(outdoor.pressure)} hPa</span>
            </div>
          </div>
        </div>

        {/* AQI strip */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5">
          <span className="text-[10px] font-bold tracking-wider text-ink-dim uppercase">Air Quality</span>
          <div className="flex items-center gap-2">
            {outdoor.aqi != null ? (
              <>
                <span className="num text-sm font-bold" style={{ color: band.color }}>
                  {fmt(outdoor.aqi)}
                </span>
                <span
                  className="rounded px-1.5 py-px text-[9px] font-bold"
                  style={{ color: band.color, background: `${band.color}18` }}
                >
                  {band.label}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-ink-faint">Unavailable</span>
            )}
          </div>
        </div>
        {outdoor.pm25 != null && (
          <div className="num flex justify-between text-[10px] text-ink-faint">
            <span>PM2.5 {fmt(outdoor.pm25, 1)}</span>
            <span>PM10 {fmt(outdoor.pm10 ?? 0, 1)}</span>
            <span>NO₂ {fmt(outdoor.no2 ?? 0, 1)}</span>
            <span>O₃ {fmt(outdoor.o3 ?? 0)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[9px] text-ink-faint">
          <span>Updated: {istTime(outdoor.timestamp)}</span>
          <span>{error && !isStale ? 'retrying…' : `Source: ${source === 'open-meteo' ? 'Open-Meteo API' : 'Dummy provider'}`}</span>
        </div>
      </div>
    </section>
  );
}
