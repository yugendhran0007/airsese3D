import { UserRound } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { isPersonAffected, possibleEffectsFor } from '../../simulation/effects';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { fmt } from '../../utils/format';
import { DEPARTMENT_COLORS, employeeFor } from '../../config/employees';

/**
 * Click-a-person inspector: that occupant's zone exposure and possible
 * comfort effects. Identity comes from the fictional mock directory in
 * config/employees.ts (badged MOCK DATA; spec §54 anonymity), educational
 * only per spec §37.
 */
export function PersonInspector() {
  const selected = useUiStore((s) => s.selectedPerson);
  const setSelected = useUiStore((s) => s.setSelectedPerson);
  const zone = useSimStore((s) => s.snapshot.zones.find((z) => z.id === selected?.zone));
  if (!selected || !zone) return null;

  const seed = selected.index * 17 + selected.zone.charCodeAt(0) * 101;
  const affected = isPersonAffected(seed, zone.status);
  const effects = possibleEffectsFor(zone);
  const color = STATUS_COLORS[zone.status];
  const emp = employeeFor(selected.zone, selected.index);
  const deptColor = DEPARTMENT_COLORS[emp.department];

  return (
    <div className="glass pointer-events-auto absolute bottom-20 left-1/2 w-72 -translate-x-1/2 overflow-hidden fade-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-ink uppercase">
          <UserRound size={14} style={{ color }} /> {emp.name}
        </span>
        <button type="button" onClick={() => setSelected(null)} className="rounded-md px-1 text-ink-faint hover:bg-danger/15 hover:text-danger">
          <span className="text-[15px] leading-none" aria-hidden>🗙</span>
        </button>
      </div>
      <div className="space-y-2 px-4 py-3">
        {/* Mock employee record (fictional placeholder data, spec §54) */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="num text-[11px] text-ink">{emp.id}</div>
            <div className="text-[11px] text-ink-dim">{emp.designation}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: deptColor }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: deptColor }} />
              {emp.department}
            </div>
          </div>
          <span className="rounded border border-line px-1.5 py-px text-[8px] font-extrabold tracking-widest text-ink-faint">
            MOCK DATA
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="text-[10px] font-bold tracking-wider text-ink-dim uppercase">Exposure · Zone {zone.id}</span>
          <span
            className="rounded px-1.5 py-px text-[9px] font-extrabold tracking-widest"
            style={{ color, background: `${color}1c` }}
          >
            {zone.status.toUpperCase()}
          </span>
        </div>
        <div className="num grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-dim">
          <span>CO₂ <b className="text-ink">{fmt(zone.co2)}</b> ppm</span>
          <span className="text-right">O₂ <b className="text-ink">{fmt(zone.o2, 2)}</b>%</span>
          <span><b className="text-ink">{fmt(zone.temperature, 1)}</b> °C</span>
          <span className="text-right">RH <b className="text-ink">{fmt(zone.humidity)}</b>%</span>
        </div>
        {affected && effects.length > 0 ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5">
            <div className="text-[9px] font-bold tracking-wider text-danger uppercase">Possible effects shown</div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-ink-dim">{effects.join(' · ')}</div>
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-ink-dim">
            No effect indicators shown for this person right now.
          </div>
        )}
        <p className="text-[8px] leading-relaxed text-ink-faint">
          Illustrative population-level visualization — not health monitoring or diagnosis of anyone.
        </p>
      </div>
    </div>
  );
}
