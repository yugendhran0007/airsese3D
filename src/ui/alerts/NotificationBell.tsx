/**
 * Environmental alerts, as a navbar notification (spec §33).
 *
 * These used to be a floating stack of toasts pinned over the office. On the
 * large display this app is built for that stack sat right across the room —
 * three alerts covered a whole meeting area — and it was also the panel that
 * occluded the navbar's own popovers. Alerts belong where every other control
 * lives: a symbol in the bar, with the detail one click away.
 *
 * The bell keeps the one thing the toasts were actually good at: telling you
 * something happened without you having to look. The badge carries the count,
 * the colour carries the worst severity present, and the bell *moves* when a
 * new alert arrives — a count that silently increments is easy to miss, and
 * motion in the corner of the eye is not.
 *
 * It follows the `ControlCluster` popover rules exactly: a plain absolutely
 * positioned child, never a portal (the shell is CSS-transformed in TV mode and
 * a portal to `document.body` escapes that transform), and Escape is handled in
 * the capture phase with `stopPropagation()` so closing the panel does not also
 * drop the camera out of follow mode.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell } from 'lucide-react';
import clsx from 'clsx';
import { STATUS_COLORS } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import { CloseX } from '../shell/CloseX';

export function NotificationBell() {
  const alerts = useSimStore((s) => s.alerts);
  const dismissToast = useSimStore((s) => s.dismissToast);
  const toasts = useSimStore((s) => s.toasts);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  // Ring when the number of active alerts grows — never on the way down, and
  // never on the first render, or it would greet every page load with a shake.
  useEffect(() => {
    if (alerts.length > lastCount.current && lastCount.current !== 0) {
      setRinging(true);
      const id = window.setTimeout(() => setRinging(false), 900);
      return () => clearTimeout(id);
    }
    lastCount.current = alerts.length;
  }, [alerts.length]);
  useEffect(() => {
    lastCount.current = alerts.length;
  }, [alerts.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const worst = alerts.some((a) => a.severity === 'red') ? 'red' : alerts.length ? 'yellow' : null;
  const colour = worst ? STATUS_COLORS[worst] : undefined;
  const label = alerts.length
    ? `${alerts.length} environmental ${alerts.length === 1 ? 'alert' : 'alerts'}`
    : 'No environmental alerts';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={label}
        aria-label={label}
        aria-expanded={open}
        className={clsx(
          'relative flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
          open
            ? 'border-accent/50 bg-accent/15 text-accent shadow-[0_0_12px_rgba(56,225,255,0.2)]'
            : 'border-line bg-white/5 text-ink-dim hover:border-accent/50 hover:text-ink',
        )}
        style={colour && !open ? { color: colour, borderColor: `${colour}66` } : undefined}
      >
        <span className={clsx('flex', ringing && 'bell-ring')}>
          <Bell size={13} />
        </span>
        {alerts.length > 0 && (
          <span
            className="num absolute -top-1 -right-1 min-w-[14px] rounded-full px-[3px] text-[9px] leading-[14px] font-bold text-black"
            style={{ background: colour }}
          >
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="glass fade-up absolute top-full right-0 z-40 mt-2 w-80 rounded-xl p-3">
          <div className="mb-2 flex items-center gap-2 border-b border-line pb-1.5">
            <span className="text-[10px] font-bold tracking-[0.2em] text-accent/80 uppercase">Alerts</span>
            <span className="num ml-auto text-[10px] text-ink-faint">{alerts.length}</span>
            <CloseX onClick={() => setOpen(false)} label="Close Alerts" />
          </div>

          {alerts.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-ink-faint">
              Nothing to report — every zone is within its thresholds.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-0.5">
              {alerts.map((a) => {
                const c = STATUS_COLORS[a.severity];
                return (
                  <div key={a.id} className="rounded-lg border bg-white/4 p-2.5" style={{ borderColor: `${c}55` }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={13} style={{ color: c }} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-ink">{a.title}</div>
                        <div className="num mt-0.5 text-[10px] text-ink-dim">{a.detail}</div>
                        <div className="mt-1.5 rounded-md bg-white/5 px-2 py-1 text-[10px] leading-relaxed text-ink-dim">
                          <span className="font-bold text-accent/90">Recommended: </span>
                          {a.recommendation}
                        </div>
                      </div>
                      {toasts.some((t) => t.id === a.id) && (
                        <button
                          type="button"
                          onClick={() => dismissToast(a.id)}
                          title="Dismiss"
                          className="shrink-0 text-ink-faint transition-colors hover:text-ink"
                        >
                          <span className="text-[13px] leading-none" aria-hidden>
                            🗙
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 border-t border-line pt-1.5 text-[10px] leading-relaxed text-ink-faint">
            Environmental actions only — never medical advice.
          </p>
        </div>
      )}
    </div>
  );
}
