import { memo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistorySample } from '../../types/environment';

const fmtClock = (t: number) => {
  const total = 9 * 3600 + t;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Correlation view (spec §36): occupancy + ventilation vs CO₂ on dual axes —
 * the lag between people arriving and CO₂ rising is directly visible.
 */
export const CorrelationView = memo(function CorrelationView({ data }: { data: HistorySample[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="rgba(148,187,255,0.08)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={fmtClock}
            stroke="rgba(148,187,255,0.25)"
            tick={{ fill: '#5a6d8f', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            minTickGap={50}
          />
          <YAxis
            yAxisId="co2"
            stroke="rgba(148,187,255,0.25)"
            tick={{ fill: '#38e1ff', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            stroke="rgba(148,187,255,0.25)"
            tick={{ fill: '#5a6d8f', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(11,20,36,0.95)',
              border: '1px solid rgba(148,187,255,0.15)',
              borderRadius: 10,
              fontSize: 11,
              fontFamily: 'JetBrains Mono',
            }}
            labelFormatter={(t) => `⏱ ${fmtClock(Number(t))}`}
          />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Inter' }} />
          <Line
            yAxisId="co2"
            type="monotone"
            dataKey="co2"
            name="CO₂ (ppm)"
            stroke="#38e1ff"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="people"
            name="People"
            stroke="#a78bfa"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="ventilation"
            name="Ventilation %"
            stroke="#34d399"
            strokeWidth={1.8}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="px-2 pt-1 text-[10px] leading-relaxed text-ink-faint">
        Occupancy ↑ drives CO₂ ↑ with a visible lag · Ventilation ↑ pulls CO₂ back down. The balance of the
        two — not people alone — decides air quality.
      </p>
    </div>
  );
});
