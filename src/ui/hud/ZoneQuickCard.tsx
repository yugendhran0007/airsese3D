/**
 * Quick per-zone card, opened by clicking a zone's floating label in the 3D
 * scene. Shows how the zone's air FEELS (population-level comfort words, not
 * medical advice — spec §26) plus that zone's own people +/- controls, so each
 * of the four sections can be crowded or emptied independently.
 */
import clsx from 'clsx';
import { Minus, Plus, Users } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import type { ZoneId } from '../../types/environment';
import { fmt } from '../../utils/format';
import { CloseX } from '../shell/CloseX';

const FEEL: Record<string, { word: string; face: string; blurb: string }> = {
  green: { word: 'Good feel', face: '😊', blurb: 'Fresh air — comfortable to focus' },
  yellow: { word: 'Okay', face: '😐', blurb: 'Getting stuffy — could feel drowsy' },
  red: { word: 'Bad feel', face: '😫', blurb: 'Stale air — ventilate this zone' },
};

export function ZoneQuickCard() {
  const selected = useUiStore((s) => s.selectedZone) as ZoneId | null;
  const setSelectedZone = useUiStore((s) => s.setSelectedZone);
  const zone = useSimStore((s) => s.snapshot.zones.find((z) => z.id === selected));
  const setZonePeople = useSimStore((s) => s.setZonePeople);
  const people = useSimStore((s) => (selected ? s.params.peoplePerZone[selected] : 0));
  if (!selected || !zone) return null;

  const color = STATUS_COLORS[zone.status];
  const feel = FEEL[zone.status] ?? FEEL.green;

  return (
    <div className="glass pointer-events-auto fade-up absolute bottom-24 left-1/2 z-30 w-[19rem] -translate-x-1/2 overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="text-xs font-extrabold tracking-[0.2em] text-ink uppercase">Zone {selected}</span>
        <span className="ml-auto" />
        <CloseX onClick={() => setSelectedZone(null)} label={`Close Zone ${selected}`} />
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-3xl leading-none">{feel.face}</div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold" style={{ color }}>
            {feel.word}
          </div>
          <div className="truncate text-[11px] text-ink-dim">{feel.blurb}</div>
        </div>
      </div>
      <div className="num grid grid-cols-3 gap-2 px-4 pb-3 text-center text-[11px] text-ink-dim">
        <div className="rounded-lg bg-white/5 py-1.5">
          <div className="font-bold text-ink">{fmt(zone.co2)}</div>
          CO₂ ppm
        </div>
        <div className="rounded-lg bg-white/5 py-1.5">
          <div className="font-bold text-ink">{fmt(zone.temperature, 1)}°C</div>
          Temp
        </div>
        <div className="rounded-lg bg-white/5 py-1.5">
          <div className="font-bold text-ink">{fmt(zone.humidity)}%</div>
          Humidity
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-ink-faint uppercase">
          <Users size={12} /> People here
        </span>
        <div className="flex items-center gap-1.5">
          <ZBtn onClick={() => setZonePeople(selected, people - 1)} label={`Fewer people in zone ${selected}`}>
            <Minus size={12} />
          </ZBtn>
          <span className="num w-8 text-center text-sm font-extrabold text-ink">{zone.people}</span>
          <ZBtn onClick={() => setZonePeople(selected, people + 1)} label={`More people in zone ${selected}`}>
            <Plus size={12} />
          </ZBtn>
        </div>
      </div>
    </div>
  );
}

function ZBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-6 w-6 items-center justify-center rounded-md border border-line bg-white/5 text-ink-dim',
        'transition-colors hover:border-accent/60 hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}
