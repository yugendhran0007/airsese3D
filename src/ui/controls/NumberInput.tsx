interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function NumberInput({ label, value, min, max, unit = '', onChange }: NumberInputProps) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold tracking-wider text-ink-dim uppercase">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={Math.round(value)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="num w-full rounded-lg border border-line bg-white/5 px-2 py-1.5 text-sm text-ink outline-none focus:border-accent/60"
        />
        {unit && <span className="text-xs text-ink-faint">{unit}</span>}
      </div>
    </label>
  );
}
