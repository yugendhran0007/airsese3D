import clsx from 'clsx';
import { PersonStanding } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { useCharacterStore } from '../../state/characterStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { CloseX } from '../shell/CloseX';

import { fmt } from '../../utils/format';

/** "You are in Zone X" chip: the air your avatar is currently breathing. */
export function CharacterHUD() {
  const zoneId = useCharacterStore((s) => s.zone);
  const chartsOpen = useUiStore((s) => s.chartsOpen);
  const zone = useSimStore((s) => s.snapshot.zones.find((z) => z.id === zoneId));
  if (!zone) return null;
  const color = STATUS_COLORS[zone.status];

  return (
    <div
      className={clsx(
        'glass pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 transition-all',
        chartsOpen ? 'bottom-[16.5rem]' : 'bottom-4',
      )}
    >
      <PersonStanding size={16} style={{ color }} />
      <span className="text-[11px] font-bold tracking-wider text-ink uppercase">
        You · Zone {zone.id}
      </span>
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <div className="num flex items-center gap-3 text-[11px] text-ink-dim">
        <span>
          CO₂ <span className="font-bold text-ink">{fmt(zone.co2)}</span> ppm
        </span>
        <span>
          O₂ <span className="font-bold text-ink">{fmt(zone.o2, 2)}</span>%
        </span>
        <span>
          <span className="font-bold text-ink">{fmt(zone.temperature, 1)}</span>°C
        </span>
        <span>
          RH <span className="font-bold text-ink">{fmt(zone.humidity)}</span>%
        </span>
      </div>
      <span className="text-[9px] text-ink-faint">↑↓ walk · ←→ side-step · Ctrl+←→ turn · Q zoom in · Shift zoom out · drag to orbit · click floor</span>
      <CloseX onClick={() => useUiStore.getState().hideCard('hud')} label="Close HUD" />
    </div>
  );
}
