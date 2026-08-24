import { useState } from 'react';
import clsx from 'clsx';
import { OFFICE_THEMES, OFFICE_THEME_IDS, type OfficeThemeId } from '../config/officeThemes';
import {
  BarChart3,
  Pause,
  PersonStanding,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wind,
} from 'lucide-react';
import { STATUS_COLORS } from '../config/constants';
import { useSimStore } from '../state/simStore';
import { useUiStore, type AppMode } from '../state/uiStore';
import { CloseX } from './shell/CloseX';

const SPEEDS = [0.5, 1, 2, 5, 10];

const MODES: { id: AppMode; label: string; disabled?: boolean }[] = [
  { id: 'live', label: 'Chennai Live' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'sensor', label: 'Sensors', disabled: true },
];

export function TopBar() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const toggle = useUiStore((s) => s.toggle);
  const chartsOpen = useUiStore((s) => s.chartsOpen);
  const humanPanelOpen = useUiStore((s) => s.humanPanelOpen);
  const thresholdsOpen = useUiStore((s) => s.thresholdsOpen);
  const dataVizOpen = useUiStore((s) => s.dataVizOpen);
  const renderMode = useUiStore((s) => s.renderMode);
  const setRenderMode = useUiStore((s) => s.setRenderMode);
  const officeTheme = useUiStore((s) => s.officeTheme);
  const setOfficeTheme = useUiStore((s) => s.setOfficeTheme);
  const navHidden = useUiStore((s) => s.hiddenCards.navbar);
  const hideCard = useUiStore((s) => s.hideCard);
  const quality = useUiStore((s) => s.quality);
  const setQuality = useUiStore((s) => s.setQuality);
  const employeeMode = useUiStore((s) => s.employeeMode);
  const setEmployeeMode = useUiStore((s) => s.setEmployeeMode);
  const rampMode = useUiStore((s) => s.rampMode);
  const setRampMode = useUiStore((s) => s.setRampMode);
  const running = useSimStore((s) => s.running);
  const setRunning = useSimStore((s) => s.setRunning);
  const reset = useSimStore((s) => s.reset);
  const speed = useSimStore((s) => s.params.speed);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const simClock = useSimStore((s) => s.snapshot.simClock);
  const status = useSimStore((s) => s.snapshot.overall.status);

  // The whole toolbar lives behind the AIRSENSE brand: click it to open/close.
  const [open, setOpen] = useState(false);

  if (navHidden) return null;
  return (
    <header className="glass scroll-thin pointer-events-auto absolute top-3 left-1/2 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-4 overflow-x-auto rounded-2xl px-5 py-2.5 [&>*]:shrink-0">
      {/* Brand = menu button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-1 transition-colors hover:bg-white/5"
        title={open ? 'Collapse menu' : 'Open AirSense menu'}
        aria-expanded={open}
      >
        <Wind size={20} className="text-accent" />
        <span className="text-sm font-extrabold tracking-[0.2em] text-ink">
          AIR<span className="text-accent">SENSE</span>
        </span>
        <span
          className="ml-1 inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: STATUS_COLORS[status], boxShadow: `0 0 8px ${STATUS_COLORS[status]}` }}
        />
        <span className={clsx('ml-1 text-[10px] text-ink-faint transition-transform', open && 'rotate-180')}>▾</span>
      </button>

      {/* Collapsed: just the clock + transport so the bar stays useful */}
      {!open && (
        <>
          <div className="h-6 w-px bg-line" />
          <span className="num text-sm font-bold text-ink" title="Simulated office clock">{simClock}</span>
          <button
            type="button"
            onClick={() => setRunning(!running)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-accent/50 hover:text-accent"
            title={running ? 'Pause simulation' : 'Resume simulation'}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <div className="h-6 w-px bg-line" />
          <CloseX onClick={() => hideCard('navbar')} label="Close navbar" />
        </>
      )}

      {open && (<>
      <div className="h-6 w-px bg-line" />

      {/* Modes */}
      <nav className="flex items-center gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={m.disabled}
            title={m.disabled ? 'Physical sensors arrive in a future phase' : undefined}
            onClick={() => setMode(m.id)}
            className={clsx(
              'rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase transition-all',
              m.disabled
                ? 'cursor-not-allowed text-ink-faint/50'
                : mode === m.id
                  ? 'bg-accent/15 text-accent shadow-[0_0_12px_rgba(56,225,255,0.2)]'
                  : 'text-ink-dim hover:text-ink',
            )}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <div className="h-6 w-px bg-line" />

      {/* Sim clock + transport */}
      <div className="flex items-center gap-2">
        <span className="num text-sm font-bold text-ink" title="Simulated office clock">
          {simClock}
        </span>
        <button
          type="button"
          onClick={() => setRunning(!running)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-accent/50 hover:text-accent"
          title={running ? 'Pause simulation' : 'Resume simulation'}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-warn/60 hover:text-warn"
          title="Reset simulation"
        >
          <RotateCcw size={13} />
        </button>
        <div className="ml-1 flex items-center gap-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={clsx(
                'num rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-all',
                speed === s ? 'bg-accent/20 text-accent' : 'text-ink-faint hover:text-ink-dim',
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-line" />

      {/* People-based data viz */}
      <button
        type="button"
        onClick={() => toggle('dataVizOpen')}
        className={clsx(
          'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase transition-all',
          dataVizOpen
            ? 'border-accent/50 bg-accent/15 text-accent shadow-[0_0_12px_rgba(56,225,255,0.2)]'
            : 'border-line bg-white/5 text-ink-dim hover:text-ink',
        )}
        title="Data Viz: every person as one unit, coloured by safety level (Human / Digital modes)"
      >
        <PersonStanding size={12} /> <span className="whitespace-nowrap">Data Viz</span>
      </button>

      <div className="h-6 w-px bg-line" />

      {/* Increase / Decrease ramp modes */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setRampMode(rampMode === 'increase' ? null : 'increase')}
          className={clsx(
            'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase transition-all',
            rampMode === 'increase'
              ? 'alert-pulse border-danger/60 bg-danger/15 text-danger'
              : 'border-line bg-white/5 text-ink-dim hover:border-danger/40 hover:text-danger',
          )}
          title="Increase mode: occupancy rises and ventilation starves — conditions degrade live"
        >
          <TrendingUp size={12} /> Increase
        </button>
        <button
          type="button"
          onClick={() => setRampMode(rampMode === 'decrease' ? null : 'decrease')}
          className={clsx(
            'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase transition-all',
            rampMode === 'decrease'
              ? 'border-ok/60 bg-ok/15 text-ok shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'border-line bg-white/5 text-ink-dim hover:border-ok/40 hover:text-ok',
          )}
          title="Decrease mode: people leave and HVAC recovers — conditions improve live"
        >
          <TrendingDown size={12} /> Decrease
        </button>
      </div>

      <div className="h-6 w-px bg-line" />

      {/* Panel toggles */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setRenderMode(renderMode === 'realistic' ? 'stylized' : 'realistic')}
          className={clsx(
            'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase transition-all',
            renderMode === 'realistic'
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-line bg-white/5 text-ink-dim hover:text-ink',
          )}
          title={renderMode === 'realistic' ? 'Photorealistic mode on — click for stylized' : 'Switch to photorealistic mode'}
        >
          <Sparkles size={12} /> {renderMode === 'realistic' ? 'Real' : 'Styled'}
        </button>
        {/* Quality tier: Fast (production-lightweight) / Balanced / 8K */}
        <div className="flex overflow-hidden rounded-lg border border-line" title="Render quality: Fast = lightweight (no shadows/postfx, few skinned avatars) · Balanced = adaptive · 8K = native resolution, 4K TV">
          {(['fast', 'balanced', 'ultra'] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(q)}
              className={clsx(
                'num h-7 px-2 text-[10px] font-extrabold tracking-wider uppercase transition-all',
                quality === q
                  ? q === 'ultra' ? 'bg-warn/15 text-warn' : q === 'fast' ? 'bg-ok/15 text-ok' : 'bg-accent/15 text-accent'
                  : 'text-ink-faint hover:text-ink',
              )}
            >
              {q === 'ultra' ? '8K' : q === 'fast' ? 'Fast' : 'Bal'}
            </button>
          ))}
        </div>
        {/* Interior theme preset (realistic mode) */}
        <select
          value={officeTheme}
          onChange={(e) => setOfficeTheme(e.target.value as OfficeThemeId)}
          disabled={renderMode !== 'realistic'}
          title={OFFICE_THEMES[officeTheme].blurb}
          className="h-7 rounded-lg border border-line bg-white/5 px-1.5 text-[10px] font-bold tracking-wider text-ink-dim uppercase hover:text-ink disabled:opacity-40"
        >
          {OFFICE_THEME_IDS.map((id) => (
            <option key={id} value={id} className="bg-panel text-ink">
              {OFFICE_THEMES[id].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setEmployeeMode(!employeeMode)}
          className={clsx(
            'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase transition-all',
            employeeMode
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-line bg-white/5 text-ink-dim hover:text-ink',
          )}
          title={
            employeeMode
              ? 'Employee mode on: names + safety rings (green safe · yellow medium · red danger). Click to hide names'
              : 'Employee mode: show every employee name and safety ring'
          }
        >
          <Users size={12} /> {employeeMode ? 'Employees' : 'Anon'}
        </button>
        <button
          type="button"
          onClick={() => toggle('chartsOpen')}
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
            chartsOpen
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-line bg-white/5 text-ink-dim hover:text-ink',
          )}
          title="History charts"
        >
          <BarChart3 size={13} />
        </button>
        <button
          type="button"
          onClick={() => toggle('humanPanelOpen')}
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
            humanPanelOpen
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-line bg-white/5 text-ink-dim hover:text-ink',
          )}
          title="Human insight (educational)"
        >
          <User size={13} />
        </button>
        <button
          type="button"
          onClick={() => toggle('thresholdsOpen')}
          className={clsx(
            'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
            thresholdsOpen
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-line bg-white/5 text-ink-dim hover:text-ink',
          )}
          title="Status thresholds"
        >
          <Settings2 size={13} />
        </button>
      </div>
      <div className="h-6 w-px bg-line" />
      <CloseX onClick={() => hideCard('navbar')} label="Close navbar" />
      </>)}
    </header>
  );
}
