import clsx from 'clsx';
import { Grid2x2, Minus, Plus } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import type { ZoneId } from '../../types/environment';
import { fmt } from '../../utils/format';

const GRID_ORDER: ZoneId[] = ['A', 'B', 'C', 'D'];

/** 2×2 zone mini-map with per-zone stats and people ± (spec §30, §31). */
export function ZonePanel() {
  const zones = useSimStore((s) => s.snapshot.zones);
  const setZonePeople = useSimStore((s) => s.setZonePeople);
  const params = useSimStore((s) => s.params);

  return (
    <section className="glass overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Grid2x2 size={13} className="text-accent" />
        <span className="text-xs font-bold tracking-[0.15em] text-ink uppercase">Zones</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {GRID_ORDER.map((id) => {
          const zone = zones.find((z) => z.id === id);
          if (!zone) return null;
          const color = STATUS_COLORS[zone.status];
          return (
            <div
              key={id}
              className="rounded-xl border px-2.5 py-2"
              style={{ borderColor: `${color}55`, background: `${color}0d` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold tracking-widest text-ink">
                  {id}
                  <span
                    className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                </span>
                <div className="flex items-center gap-1">
                  <ZoneBtn onClick={() => setZonePeople(id, params.peoplePerZone[id] - 1)}>
                    <Minus size={10} />
                  </ZoneBtn>
                  <span className="num w-6 text-center text-xs font-bold text-ink">{zone.people}</span>
                  <ZoneBtn onClick={() => setZonePeople(id, params.peoplePerZone[id] + 1)}>
                    <Plus size={10} />
                  </ZoneBtn>
                </div>
              </div>
              <div className="num mt-1.5 grid grid-cols-2 gap-x-2 text-[10px] text-ink-dim">
                <span>{fmt(zone.co2)} ppm</span>
                <span className="text-right">{fmt(zone.temperature, 1)}°C</span>
                <span>{fmt(zone.humidity)}% RH</span>
                <span className="text-right">{fmt(zone.airflow, 2)} m/s</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ZoneBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex h-5 w-5 items-center justify-center rounded-md border border-line bg-white/5',
        'text-ink-faint transition-all hover:border-accent/50 hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}
