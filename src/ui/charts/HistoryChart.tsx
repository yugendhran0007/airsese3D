import { memo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistorySample } from '../../types/environment';

export interface SeriesDef {
  key: keyof HistorySample;
  name: string;
  color: string;
  unit: string;
  /** Optional threshold bands [yellowStart, redStart] for high-is-bad series. */
  bands?: [number, number];
  domain?: [number | 'auto', number | 'auto'];
}

interface HistoryChartProps {
  data: HistorySample[];
  series: SeriesDef;
}

const fmtClock = (t: number) => {
  const total = 9 * 3600 + t;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** One themed area chart with gradient fill + threshold reference bands. */
export const HistoryChart = memo(function HistoryChart({ data, series }: HistoryChartProps) {
  const gradId = `grad-${String(series.key)}`;
  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series.color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
          stroke="rgba(148,187,255,0.25)"
          tick={{ fill: '#5a6d8f', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          tickLine={false}
          domain={series.domain ?? ['auto', 'auto']}
          width={58}
        />
        {series.bands && (
          <>
            <ReferenceArea
              y1={series.bands[0]}
              y2={series.bands[1]}
              fill="#fbbf24"
              fillOpacity={0.05}
              stroke="none"
            />
            <ReferenceArea y1={series.bands[1]} fill="#fb5d7c" fillOpacity={0.06} stroke="none" />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: 'rgba(11,20,36,0.95)',
            border: '1px solid rgba(148,187,255,0.15)',
            borderRadius: 10,
            fontSize: 11,
            fontFamily: 'JetBrains Mono',
          }}
          labelFormatter={(t) => `⏱ ${fmtClock(Number(t))}`}
          formatter={(value) => [`${Number(value).toFixed(1)} ${series.unit}`, series.name]}
        />
        <Area
          type="monotone"
          dataKey={series.key as string}
          name={series.name}
          stroke={series.color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          isAnimationActive={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
