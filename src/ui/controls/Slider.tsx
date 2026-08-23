import { fmt } from '../../utils/format';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  digits?: number;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min, max, step = 1, unit = '', digits = 0, onChange }: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-ink-dim uppercase">{label}</span>
        <span className="num text-xs font-semibold text-ink">
          {fmt(value, digits)}
          {unit && <span className="ml-0.5 text-ink-faint">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
