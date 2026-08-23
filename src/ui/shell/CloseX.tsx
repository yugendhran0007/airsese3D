/**
 * The app-wide close control: the 🗙 symbol the user asked for, used on the
 * navbar, every dashboard card, drawers, overlays and the presentation.
 * `Closable` wraps a card so it can be dismissed (uiStore.hiddenCards) and
 * restored from the RestorePill.
 */
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useUiStore, type CardId, CARD_LABELS } from '../../state/uiStore';

export function CloseX({ onClick, label = 'Close', className }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[15px] leading-none text-ink-dim transition-all hover:bg-danger/15 hover:text-danger',
        className,
      )}
    >
      🗙
    </button>
  );
}

/** Card wrapper: hides itself when dismissed; the 🗙 floats in the top-right corner. */
export function Closable({ id, children, className, bare }: { id: CardId; children: ReactNode; className?: string; /** Component renders its own 🗙 (self-positioned panels) */ bare?: boolean }) {
  const hidden = useUiStore((s) => s.hiddenCards[id]);
  const hideCard = useUiStore((s) => s.hideCard);
  if (hidden) return null;
  if (bare) return <>{children}</>;
  return (
    <div className={clsx('relative', className)}>
      {children}
      <CloseX onClick={() => hideCard(id)} label={`Close ${CARD_LABELS[id]}`} className="absolute top-1.5 right-2 z-10" />
    </div>
  );
}

/** Appears when anything is hidden: restore one card or everything. */
export function RestorePill() {
  const hidden = useUiStore((s) => s.hiddenCards);
  const showCard = useUiStore((s) => s.showCard);
  const showAll = useUiStore((s) => s.showAllCards);
  const ids = (Object.keys(hidden) as CardId[]).filter((k) => hidden[k]);
  if (ids.length === 0) return null;
  return (
    <div className="glass pointer-events-auto absolute bottom-4 right-14 z-30 flex items-center gap-1 rounded-full px-2 py-1">
      <span className="mr-1 text-[9px] font-bold tracking-[0.2em] text-ink-faint uppercase">Closed</span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => showCard(id)}
          className="rounded-full border border-line bg-white/5 px-2 py-0.5 text-[10px] font-bold text-ink-dim hover:border-accent/50 hover:text-accent"
          title={`Show ${CARD_LABELS[id]}`}
        >
          {CARD_LABELS[id]}
        </button>
      ))}
      <button
        type="button"
        onClick={showAll}
        className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/25"
      >
        Show all
      </button>
    </div>
  );
}
