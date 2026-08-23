import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { fmt } from '../../utils/format';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  digits?: number;
  simulated?: boolean;
  accent?: string;
  /** Recent values for the sparkline (chronological). */
  spark?: number[];
}

/** Animated stat card: tweened value, trend arrow, sparkline, source badge. */
export function StatCard({ label, value, unit, digits = 0, simulated = true, accent = '#38e1ff', spark }: StatCardProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const trend = value - prevRef.current;

  useEffect(() => {
    prevRef.current = display;
    const from = display;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 350);
      setDisplay(from + (value - from) * (1 - (1 - p) * (1 - p)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sparkPath = spark && spark.length > 1 ? buildSparkPath(spark, 72, 20) : null;

  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.15em] text-ink-dim uppercase">{label}</span>
        <span
          className={clsx(
            'rounded px-1 py-px text-[8px] font-bold tracking-wider',
            simulated ? 'bg-warn/10 text-warn/80' : 'bg-ok/10 text-ok/90',
          )}
        >
          {simulated ? 'SIMULATED' : 'MEASURED'}
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="num text-xl leading-none font-bold text-ink">{fmt(display, digits)}</span>
          <span className="text-[10px] text-ink-faint">{unit}</span>
          {Math.abs(trend) > 0.01 &&
            (trend > 0 ? (
              <TrendingUp size={11} className="text-warn/80" />
            ) : (
              <TrendingDown size={11} className="text-ok/80" />
            ))}
        </div>
        {sparkPath && (
          <svg width={72} height={20} className="shrink-0 opacity-70">
            <path d={sparkPath} fill="none" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

function buildSparkPath(values: number[], w: number, h: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
