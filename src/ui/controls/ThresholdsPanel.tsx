import { RotateCcw, Settings2 } from 'lucide-react';
import { DEFAULT_THRESHOLDS, type Band, type Thresholds } from '../../config/thresholds';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';

interface BandRowProps {
  label: string;
  unit: string;
  band: Band;
  step?: number;
  onChange: (band: Band) => void;
}

function Field({ value, step, onChange }: { value: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      className="num w-16 rounded-md border border-line bg-white/5 px-1.5 py-1 text-right text-[11px] text-ink outline-none focus:border-accent/60"
    />
  );
}

function BandRow({ label, unit, band, step = 1, onChange }: BandRowProps) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-ink uppercase">{label}</span>
        <span className="text-[9px] text-ink-faint">{unit}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-ink-dim">
        <label className="flex items-center justify-between gap-2">
          <span className="text-ok">Green ≥</span>
          <Field value={band.greenMin} step={step} onChange={(v) => onChange({ ...band, greenMin: v })} />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="text-ok">Green ≤</span>
          <Field value={band.greenMax} step={step} onChange={(v) => onChange({ ...band, greenMax: v })} />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="text-warn">Yellow ≥</span>
          <Field value={band.yellowMin} step={step} onChange={(v) => onChange({ ...band, yellowMin: v })} />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="text-warn">Yellow ≤</span>
          <Field value={band.yellowMax} step={step} onChange={(v) => onChange({ ...band, yellowMax: v })} />
        </label>
      </div>
    </div>
  );
}

/** Editable status thresholds (spec §32): outside yellow = red. */
export function ThresholdsPanel() {
  const open = useUiStore((s) => s.thresholdsOpen);
  const toggle = useUiStore((s) => s.toggle);
  const thresholds = useSimStore((s) => s.thresholds);
  const setThresholds = useSimStore((s) => s.setThresholds);
  if (!open) return null;

  const patch = (key: keyof Thresholds, band: Band) => setThresholds({ ...thresholds, [key]: band });

  return (
    <aside className="glass pointer-events-auto absolute top-20 left-[18rem] w-72 overflow-hidden fade-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-ink uppercase">
          <Settings2 size={13} className="text-accent" /> Status Thresholds
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Restore defaults"
            onClick={() => setThresholds(structuredClone(DEFAULT_THRESHOLDS))}
            className="text-ink-faint transition-colors hover:text-warn"
          >
            <RotateCcw size={13} />
          </button>
          <button type="button" onClick={() => toggle('thresholdsOpen')} className="rounded-md px-1 text-ink-faint hover:bg-danger/15 hover:text-danger">
            <span className="text-[15px] leading-none" aria-hidden>🗙</span>
          </button>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <BandRow label="CO₂" unit="ppm" band={thresholds.co2} step={50} onChange={(b) => patch('co2', b)} />
        <BandRow
          label="Temperature"
          unit="°C"
          band={thresholds.temperature}
          step={0.5}
          onChange={(b) => patch('temperature', b)}
        />
        <BandRow label="Humidity" unit="% RH" band={thresholds.humidity} onChange={(b) => patch('humidity', b)} />
        <p className="px-1 text-[9px] leading-relaxed text-ink-faint">
          Values outside the yellow range are red. Zone status is the worst parameter's band.
        </p>
      </div>
    </aside>
  );
}
