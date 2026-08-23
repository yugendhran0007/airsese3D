import { AlertTriangle } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { CloseX } from '../shell/CloseX';
import { useUiStore } from '../../state/uiStore';
import { useSimStore } from '../../state/simStore';

/** Toast stack for freshly fired alerts + compact active-alert list (spec §33). */
export function AlertsPanel() {
  const toasts = useSimStore((s) => s.toasts);
  const alerts = useSimStore((s) => s.alerts);
  const dismissToast = useSimStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none absolute top-20 right-[21rem] flex w-80 flex-col items-end gap-2">
      {(toasts.length > 0 || alerts.length > 0) && (
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-3 text-[9px] font-bold tracking-[0.2em] text-ink-faint uppercase">
          Alerts <CloseX onClick={() => useUiStore.getState().hideCard('alerts')} label="Close Alerts" />
        </div>
      )}
      {toasts.map((toast) => {
        const color = STATUS_COLORS[toast.severity];
        return (
          <div
            key={toast.id}
            className="glass pointer-events-auto w-full overflow-hidden fade-up"
            style={{ borderColor: `${color}66` }}
          >
            <div className="alert-pulse flex items-start gap-2.5 px-3.5 py-3">
              <AlertTriangle size={16} style={{ color }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-ink">{toast.title}</div>
                <div className="num mt-0.5 text-[11px] text-ink-dim">{toast.detail}</div>
                <div className="mt-1.5 rounded-lg bg-white/5 px-2 py-1 text-[10px] leading-relaxed text-ink-dim">
                  <span className="font-bold text-accent/90">Recommended: </span>
                  {toast.recommendation}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 text-ink-faint transition-colors hover:text-ink"
              >
                <span className="text-[15px] leading-none" aria-hidden>🗙</span>
              </button>
            </div>
          </div>
        );
      })}

      {alerts.length > 0 && toasts.length === 0 && (
        <div className="glass pointer-events-auto px-3 py-1.5 text-[10px] font-bold tracking-wider text-warn">
          ⚠ {alerts.length} active environmental {alerts.length === 1 ? 'alert' : 'alerts'}
        </div>
      )}
    </div>
  );
}
