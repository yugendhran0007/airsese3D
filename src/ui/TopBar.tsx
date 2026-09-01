import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { RENDER_BUDGETS, renderResolutionLabel } from '../utils/renderScale';
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
  MonitorPlay,
  Maximize,
  Minimize,
} from 'lucide-react';
import { STATUS_COLORS } from '../config/constants';
import { useSimStore } from '../state/simStore';
import { useUiStore, type AppMode } from '../state/uiStore';
import { CloseX } from './shell/CloseX';
import { ControlCluster } from './controls/ControlCluster';
import { NotificationBell } from './alerts/NotificationBell';

const SPEEDS = [0.5, 1, 2, 5, 10];

/** Pointer distance from the top edge, in CSS px, that reveals the bar in full mode. */
const REVEAL_ZONE_PX = 96;

/**
 * Full mode hides the navbar until the pointer asks for it.
 *
 * Reveal is not just "pointer near the top": the popovers hang *below* the bar,
 * so a pointer 300 px down may well be dragging one of its sliders. The bar
 * therefore also stays up while the pointer is anywhere inside the header
 * subtree (popovers are DOM children of it) and while a button is held, which
 * covers dragging a slider clean off the panel.
 *
 * All three conditions are derived from one window-level `mousemove` and a
 * hit-test against the header, rather than from React's onMouseEnter/onMouseLeave.
 * Enter/leave only pair up if both events actually arrive: fading the bar to
 * `pointer-events-none` under a resting pointer, a pointer that leaves the
 * window, or a fullscreen transition can all swallow the leave and strand the
 * bar visible forever. A hit-test cannot get stuck, because every move recomputes
 * it from scratch.
 */
function useTopEdgeReveal(active: boolean, headerRef: React.RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active) {
      setNear(false);
      setHeld(false);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const inHeader = !!headerRef.current?.contains(e.target as Node);
      setNear(inHeader || e.clientY < REVEAL_ZONE_PX);
    };
    const onDown = () => setHeld(true);
    const onUp = () => setHeld(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [active, headerRef]);
  return !active || near || held;
}

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
  const tvMode = useUiStore((s) => s.tvMode);
  const setTvMode = useUiStore((s) => s.setTvMode);
  const tvBudgetMp = useUiStore((s) => s.tvBudgetMp);
  const setTvBudgetMp = useUiStore((s) => s.setTvBudgetMp);
  const fullMode = useUiStore((s) => s.fullMode);
  const setFullMode = useUiStore((s) => s.setFullMode);
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
  const headerRef = useRef<HTMLElement>(null);
  const revealed = useTopEdgeReveal(fullMode, headerRef);

  /**
   * Full mode = browser fullscreen + a bare office. The two are kept separate on
   * purpose: `requestFullscreen` can be refused (iframes, policy, no gesture),
   * and when it is, hiding the panels is still most of what was asked for.
   */
  const toggleFullMode = () => {
    const next = !fullMode;
    setFullMode(next);
    const el = document.documentElement;
    try {
      if (next && !document.fullscreenElement) void el.requestFullscreen?.();
      else if (!next && document.fullscreenElement) void document.exitFullscreen?.();
    } catch { /* fullscreen unavailable — the DOM half of full mode still applies */ }
  };

  if (navHidden) return null;
  return (
    <header
      ref={headerRef}
      className={clsx(
        // flex-wrap rather than overflow-x-auto: a scroll container clips the
        // control popovers that hang below the bar, and on the large screens
        // this bar is built for there is room to wrap instead of scroll.
        // z-50: `.glass` sets `backdrop-filter`, which creates a stacking
        // context, so the popovers hanging below this bar cannot escape it —
        // their own z-index competes only *inside* the header. Without a
        // z-index here the whole header paints in DOM order and loses to every
        // dashboard panel that comes after it, which is what used to bury the
        // Performance popover behind the alerts stack.
        'glass pointer-events-auto absolute top-3 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl px-5 py-2.5 transition-opacity duration-200 [&>*]:shrink-0',
        revealed ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
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

      {/* Alerts live in the bar at all times, collapsed or not — a notification
          you have to expand a menu to discover is not a notification. */}
      <div className="h-6 w-px bg-line" />
      <NotificationBell />

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

      {/* Simulation knobs — one symbol per group, each opening a popover */}
      <ControlCluster />

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
        {/* Presentation output: fixed render budget for a large external display */}
        <button
          type="button"
          onClick={() => setTvMode(!tvMode)}
          title={
            tvMode
              ? `Presentation mode ON — rendering ${renderResolutionLabel(tvBudgetMp)} and upscaling to the display. Quality is pinned: no adaptive downscale, no tier drop, antialiasing always on.`
              : 'Presentation mode for a large external display (TV / projector): renders into a fixed pixel budget and holds quality steady for the whole talk'
          }
          className={clsx(
            'num flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-extrabold tracking-wider uppercase transition-all',
            tvMode ? 'border-warn/40 bg-warn/15 text-warn' : 'border-line text-ink-faint hover:text-ink',
          )}
        >
          <MonitorPlay size={12} /> TV
        </button>
        {/* Full mode: fullscreen, office only, navbar auto-hides to the top edge */}
        <button
          type="button"
          onClick={toggleFullMode}
          title={
            fullMode
              ? 'Leave full mode (Esc) — brings the panels back'
              : 'Full mode: fullscreen, panels hidden, just the walkable office. Move the pointer to the top edge for this bar; Esc leaves.'
          }
          className={clsx(
            'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase transition-all',
            fullMode ? 'border-ok/60 bg-ok/15 text-ok' : 'border-line bg-white/5 text-ink-dim hover:text-ink',
          )}
        >
          {fullMode ? <Minimize size={12} /> : <Maximize size={12} />} Full
        </button>
        {tvMode && (
          <select
            value={tvBudgetMp}
            onChange={(e) => setTvBudgetMp(Number(e.target.value))}
            title="Render resolution for the 3D view. The display upscales it; the DOM panels stay native. Lower = smoother."
            className="h-7 rounded-lg border border-line bg-white/5 px-1.5 text-[10px] font-bold tracking-wider text-ink-dim uppercase hover:text-ink"
          >
            {(['low', 'hd', 'qhd', 'uhd'] as const).map((id) => (
              <option key={id} value={RENDER_BUDGETS[id]}>
                {id === 'low' ? 'Smoothest' : id === 'hd' ? '1080p' : id === 'qhd' ? '1440p' : '4K'}
              </option>
            ))}
          </select>
        )}
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
