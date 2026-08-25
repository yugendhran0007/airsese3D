/**
 * Avatar action bar: sit down at a free desk and work on the laptop, or play
 * an emote. Sitting can also be started by clicking any highlighted chair in
 * the scene (SeatTargets); this bar exists so the moves are discoverable.
 */
import { jump, standUp, toggleDance, useCharacterStore } from '../../state/characterStore';
import { useUiStore } from '../../state/uiStore';
import { Closable, CloseX } from './CloseX';
import clsx from 'clsx';

function Action({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={clsx(
        'rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors',
        active
          ? 'border-accent/60 bg-accent/15 text-accent'
          : 'border-line bg-white/5 text-ink-dim hover:border-accent/50 hover:text-accent',
      )}
    >
      {label}
    </button>
  );
}

export function ActionBar() {
  const activity = useCharacterStore((s) => s.activity);
  const seatPicker = useCharacterStore((s) => s.seatPicker);
  const setSeatPicker = useCharacterStore((s) => s.setSeatPicker);
  const hideCard = useUiStore((s) => s.hideCard);
  // Sits directly above the scenario bar, which the charts drawer also pushes up
  const chartsOpen = useUiStore((s) => s.chartsOpen);

  return (
    <Closable id="actions" bare>
      <div
        className="glass pointer-events-auto absolute left-4 z-30 flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-all"
        style={{ bottom: chartsOpen ? '20rem' : '4.5rem' }}
      >
        <span className="ml-1 text-[9px] font-bold tracking-[0.2em] text-ink-faint uppercase">You</span>
        {activity === 'sitting' ? (
          <Action label="Stand up" hint="Leave the desk (F, or any movement key)" active onClick={standUp} />
        ) : (
          <Action
            label={seatPicker ? 'Hide seats' : 'Find a seat'}
            hint="Highlight every free chair — click one to walk over and work"
            active={seatPicker}
            onClick={() => setSeatPicker(!seatPicker)}
          />
        )}
        <Action label="Dance" hint="Dance (G)" active={activity === 'dancing'} onClick={toggleDance} />
        <Action label="Jump" hint="Jump (J)" onClick={jump} />
        <CloseX onClick={() => hideCard('actions')} label="Close Actions" />
      </div>
    </Closable>
  );
}
