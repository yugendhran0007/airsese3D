import clsx from 'clsx';

interface ToggleProps {
  label: string;
  value: boolean;
  onLabel?: string;
  offLabel?: string;
  onChange: (v: boolean) => void;
}

export function Toggle({ label, value, onLabel = 'OPEN', offLabel = 'CLOSED', onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-wider text-ink-dim uppercase">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={clsx(
          'num rounded-lg border px-2.5 py-1 text-[11px] font-bold tracking-wider transition-all',
          value
            ? 'border-accent/50 bg-accent/15 text-accent shadow-[0_0_12px_rgba(56,225,255,0.25)]'
            : 'border-line bg-white/5 text-ink-faint hover:text-ink-dim',
        )}
      >
        {value ? onLabel : offLabel}
      </button>
    </div>
  );
}
