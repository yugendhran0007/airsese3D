import clsx from 'clsx';
import { Brain, Eye, HeartPulse, Wind } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { fmt } from '../../utils/format';

interface Indicator {
  icon: React.ReactNode;
  label: string;
  copy: string;
  /** Body region highlighted on the silhouette when active. */
  region: 'head' | 'eyes' | 'lungs';
  active: (co2: number, temp: number, rh: number) => boolean;
}

const INDICATORS: Indicator[] = [
  {
    icon: <Eye size={13} />,
    label: 'Eye irritation',
    copy: 'Possible in dry or stale air over long periods.',
    region: 'eyes',
    active: (co2, _t, rh) => co2 > 1200 || rh < 32,
  },
  {
    icon: <Brain size={13} />,
    label: 'Reduced focus / fatigue',
    copy: 'Sustained CO₂ above ~1000–1400 ppm is associated with drowsiness.',
    region: 'head',
    active: (co2) => co2 > 1000,
  },
  {
    icon: <HeartPulse size={13} />,
    label: 'Headache',
    copy: 'Possible with prolonged exposure to poorly ventilated air.',
    region: 'head',
    active: (co2) => co2 > 1400,
  },
  {
    icon: <Wind size={13} />,
    label: 'Respiratory discomfort',
    copy: 'Possible in stuffy, humid, or very warm conditions.',
    region: 'lungs',
    active: (co2, t, rh) => co2 > 1600 || (t > 28 && rh > 65),
  },
];

/** Stylized silhouette with optional highlighted regions. */
function Silhouette({ color, regions }: { color: string; regions: Set<string> }) {
  return (
    <svg width="86" height="142" viewBox="0 0 90 150">
      {/* Head */}
      <circle
        cx="45"
        cy="22"
        r="14"
        fill={regions.has('head') ? `${color}66` : `${color}26`}
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Eyes */}
      {regions.has('eyes') && (
        <>
          <circle cx="39" cy="20" r="2.4" fill={color} />
          <circle cx="51" cy="20" r="2.4" fill={color} />
        </>
      )}
      {/* Body */}
      <path
        d="M45 38 C28 38 22 52 22 68 L22 100 C22 104 26 106 30 105 L34 142 C34 146 40 147 42 143 L45 118 L48 143 C50 147 56 146 56 142 L60 105 C64 106 68 104 68 100 L68 68 C68 52 62 38 45 38 Z"
        fill={`${color}1e`}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Lungs */}
      <ellipse
        cx="38"
        cy="62"
        rx="6.5"
        ry="10.5"
        fill={regions.has('lungs') ? `${color}88` : `${color}3a`}
      />
      <ellipse
        cx="52"
        cy="62"
        rx="6.5"
        ry="10.5"
        fill={regions.has('lungs') ? `${color}88` : `${color}3a`}
      />
    </svg>
  );
}

/**
 * Educational side panel (spec §37): healthy-baseline vs current-environment
 * comparison, region highlights, possible-effect chips. Not a medical tool.
 */
export function HumanInsightPanel() {
  const open = useUiStore((s) => s.humanPanelOpen);
  const toggle = useUiStore((s) => s.toggle);
  const overall = useSimStore((s) => s.snapshot.overall);
  if (!open) return null;

  const { co2, temperature: temp, humidity: rh, status } = overall;
  const color = STATUS_COLORS[status];
  const activeIndicators = INDICATORS.filter((i) => i.active(co2, temp, rh));
  const regions = new Set(activeIndicators.map((i) => i.region));

  return (
    <aside className="glass pointer-events-auto absolute top-20 right-[21rem] bottom-4 flex w-80 flex-col overflow-hidden fade-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-xs font-bold tracking-[0.15em] text-ink uppercase">Human Insight</span>
        <button type="button" onClick={() => toggle('humanPanelOpen')} className="rounded-md px-1 text-ink-faint hover:bg-danger/15 hover:text-danger">
          <span className="text-[15px] leading-none" aria-hidden>🗙</span>
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        {/* Split comparison: healthy baseline vs current environment */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-ok/30 bg-ok/5 px-2 py-2 text-center">
            <div className="text-[9px] font-bold tracking-widest text-ok uppercase">Optimal air</div>
            <div className="flex justify-center">
              <Silhouette color={STATUS_COLORS.green} regions={new Set()} />
            </div>
            <div className="num text-[9px] leading-relaxed text-ink-faint">
              ~450 ppm · 24°C · 50% RH
              <br />
              indicators quiet
            </div>
          </div>
          <div
            className="rounded-xl border px-2 py-2 text-center"
            style={{ borderColor: `${color}55`, background: `${color}0d` }}
          >
            <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color }}>
              This office now
            </div>
            <div className="flex justify-center">
              <Silhouette color={color} regions={regions} />
            </div>
            <div className="num text-[9px] leading-relaxed text-ink-faint">
              {fmt(co2)} ppm · {fmt(temp, 1)}°C · {fmt(rh)}% RH
              <br />
              <span style={{ color }}>
                {activeIndicators.length === 0
                  ? 'indicators quiet'
                  : `${activeIndicators.length} possible effect${activeIndicators.length > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {INDICATORS.map((ind) => {
            const isActive = ind.active(co2, temp, rh);
            return (
              <div
                key={ind.label}
                className={clsx(
                  'rounded-xl border px-3 py-2 transition-all duration-500',
                  isActive ? 'border-warn/40 bg-warn/5' : 'border-line bg-white/[0.02] opacity-50',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={isActive ? 'text-warn' : 'text-ink-faint'}>{ind.icon}</span>
                  <span className="text-[11px] font-bold text-ink">{ind.label}</span>
                  {isActive && (
                    <span className="ml-auto rounded bg-warn/15 px-1.5 py-px text-[8px] font-bold tracking-wider text-warn">
                      POSSIBLE
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-dim">{ind.copy}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-line bg-danger/5 px-4 py-2.5 text-[9px] leading-relaxed text-ink-faint">
        <strong className="text-ink-dim">Educational visualization only.</strong> These are possible comfort
        effects of indoor environments in general — not medical advice, monitoring, or diagnosis of any
        person.
      </div>
    </aside>
  );
}
