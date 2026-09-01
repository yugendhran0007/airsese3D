/**
 * The simulation knobs, as a row of symbols in the navbar (spec §12, §20, §21, §29).
 *
 * These used to live in a fixed 16 rem drawer down the left edge. On a laptop
 * that is a reasonable trade; on a large display it is not, because the drawer
 * costs the same *fraction* of the screen while the office behind it is the
 * whole point of the app. Folding each section behind a symbol gives the 3D
 * view the full width and still keeps every knob one click away.
 *
 * Each group opens a popover anchored under its symbol. Only one is open at a
 * time — these are settings, not panels to arrange, and overlapping popovers
 * over a 3D scene read as clutter.
 */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { DoorOpen, Gauge, Minus, Plus, Ruler, Thermometer, Users, Wind } from 'lucide-react';
import { MAX_PEOPLE } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { DETAIL_LADDER, autoTuneLocked, measuredFrameRate, useDetailLevel } from '../../utils/autoTune';
import { renderResolutionLabel } from '../../utils/renderScale';

import { NumberInput } from './NumberInput';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

type GroupId = 'people' | 'hvac' | 'openings' | 'room' | 'initial' | 'perf';

/**
 * One symbol plus its popover.
 *
 * The panel is a plain absolutely-positioned child rather than a portal: the
 * shell is scaled by a CSS transform in presentation mode (`uiScaleForWidth`),
 * and a portal to `document.body` would escape that transform and land in the
 * wrong place at the wrong size. Staying inside the header keeps the popover in
 * the same coordinate space as the button that opened it.
 */
function Popover({
  id,
  open,
  onOpen,
  icon,
  title,
  children,
}: {
  id: GroupId;
  open: GroupId | null;
  onOpen: (id: GroupId | null) => void;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const isOpen = open === id;
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside and on Escape, the two gestures every popover owes
  // the user. Escape is handled here in the capture phase so it closes only the
  // popover and does not also drop the camera out of follow mode.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onOpen(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [isOpen, onOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onOpen(isOpen ? null : id)}
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
        className={clsx(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
          isOpen
            ? 'border-accent/50 bg-accent/15 text-accent shadow-[0_0_12px_rgba(56,225,255,0.2)]'
            : 'border-line bg-white/5 text-ink-dim hover:border-accent/50 hover:text-ink',
        )}
      >
        {icon}
      </button>
      {isOpen && (
        <div className="glass fade-up absolute top-full left-1/2 z-40 mt-2 w-64 -translate-x-1/2 rounded-xl p-3">
          <div className="mb-2 border-b border-line pb-1.5 text-[10px] font-bold tracking-[0.2em] text-accent/80 uppercase">
            {title}
          </div>
          <div className="space-y-3">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Live frame-rate readout. Polls on its own clock — never per frame. */
function PerfReadout() {
  const level = useDetailLevel();
  const autoTune = useUiStore((s) => s.autoTune);
  const setAutoTune = useUiStore((s) => s.setAutoTune);
  const tvMode = useUiStore((s) => s.tvMode);
  const tvBudgetMp = useUiStore((s) => s.tvBudgetMp);
  const [fps, setFps] = useState(() => measuredFrameRate());
  const [locked, setLocked] = useState(() => autoTuneLocked());

  useEffect(() => {
    const id = setInterval(() => {
      setFps(measuredFrameRate());
      setLocked(autoTuneLocked());
    }, 500);
    return () => clearInterval(id);
  }, []);

  const fpsColor = fps >= 50 ? 'text-ok' : fps >= 30 ? 'text-warn' : 'text-danger';
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-ink-dim">Frame rate</span>
        <span className={clsx('num text-xl font-bold', fpsColor)}>
          {fps > 0 ? Math.round(fps) : '—'} <span className="text-[10px] font-normal text-ink-faint">fps</span>
        </span>
      </div>
      <Toggle label="Auto-tune" value={autoTune} onChange={setAutoTune} />
      <div className="space-y-1 text-[10px] leading-relaxed text-ink-faint">
        <div className="flex justify-between">
          <span>Detail</span>
          <span className="num text-ink-dim">
            {level.label} · {level.id + 1}/{DETAIL_LADDER.length}
            {locked && autoTune ? ' · settled' : ''}
          </span>
        </div>
        {tvMode && (
          <div className="flex justify-between">
            <span>Rendering</span>
            <span className="num text-ink-dim">
              {renderResolutionLabel(tvBudgetMp * level.renderScale * level.renderScale)}
            </span>
          </div>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-ink-faint">
        Auto-tune measures the real frame rate and trades render resolution and distant detail until the picture holds
        a smooth 60 — then it stops, so nothing shifts mid-presentation. Turn it off to pin whatever the quality tier
        asks for.
      </p>
    </>
  );
}

/** Symbol row for the navbar. Renders as flex children — no wrapper of its own. */
export function ControlCluster() {
  const [open, setOpen] = useState<GroupId | null>(null);
  const params = useSimStore((s) => s.params);
  const setParams = useSimStore((s) => s.setParams);
  const setTotalPeople = useSimStore((s) => s.setTotalPeople);
  const totalPeople =
    params.peoplePerZone.A + params.peoplePerZone.B + params.peoplePerZone.C + params.peoplePerZone.D;

  return (
    <div className="flex items-center gap-1">
      <Popover id="people" open={open} onOpen={setOpen} icon={<Users size={13} />} title="People">
        <Slider label="Occupancy" value={totalPeople} min={0} max={MAX_PEOPLE} onChange={setTotalPeople} />
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setTotalPeople(totalPeople - 1)}
            aria-label="One fewer person"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-accent/50 hover:text-accent"
          >
            <Minus size={14} />
          </button>
          <span className="num w-14 text-center text-xl font-bold text-ink">{totalPeople}</span>
          <button
            type="button"
            onClick={() => setTotalPeople(totalPeople + 1)}
            aria-label="One more person"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-accent/50 hover:text-accent"
          >
            <Plus size={14} />
          </button>
        </div>
      </Popover>

      <Popover id="hvac" open={open} onOpen={setOpen} icon={<Wind size={13} />} title="Ventilation &amp; HVAC">
        <Slider
          label="Ventilation"
          value={params.ventilation}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setParams({ ventilation: v })}
        />
        <Slider
          label="Fresh Air"
          value={params.freshAir}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setParams({ freshAir: v })}
        />
        <Slider label="AC Power" value={params.ac} min={0} max={100} unit="%" onChange={(v) => setParams({ ac: v })} />
        <Slider
          label="AC Setpoint"
          value={params.acSetpoint}
          min={18}
          max={28}
          step={0.5}
          digits={1}
          unit="°C"
          onChange={(v) => setParams({ acSetpoint: v })}
        />
      </Popover>

      <Popover id="openings" open={open} onOpen={setOpen} icon={<DoorOpen size={13} />} title="Openings">
        <Toggle label="Main Door" value={params.doorOpen} onChange={(v) => setParams({ doorOpen: v })} />
        <Toggle label="Windows" value={params.windowsOpen} onChange={(v) => setParams({ windowsOpen: v })} />
      </Popover>

      <Popover id="room" open={open} onOpen={setOpen} icon={<Ruler size={13} />} title="Room Size">
        <div className="grid grid-cols-3 gap-2">
          <NumberInput
            label="Width"
            value={params.room.width}
            min={10}
            max={60}
            unit="m"
            onChange={(v) => setParams({ room: { ...params.room, width: v } })}
          />
          <NumberInput
            label="Length"
            value={params.room.length}
            min={8}
            max={40}
            unit="m"
            onChange={(v) => setParams({ room: { ...params.room, length: v } })}
          />
          <NumberInput
            label="Height"
            value={params.room.height}
            min={2}
            max={12}
            step={0.1}
            unit="m"
            onChange={(v) => setParams({ room: { ...params.room, height: v } })}
          />
        </div>
        <div className="num text-center text-[11px] text-ink-faint">
          Volume: {(params.room.width * params.room.length * params.room.height).toLocaleString()} m³
        </div>
      </Popover>

      <Popover id="initial" open={open} onOpen={setOpen} icon={<Thermometer size={13} />} title="Initial Conditions">
        <Slider
          label="Initial CO₂"
          value={params.initial.co2}
          min={420}
          max={2000}
          step={10}
          unit="ppm"
          onChange={(v) => setParams({ initial: { ...params.initial, co2: v } })}
        />
        <Slider
          label="Initial Temp"
          value={params.initial.temperature}
          min={18}
          max={35}
          step={0.5}
          digits={1}
          unit="°C"
          onChange={(v) => setParams({ initial: { ...params.initial, temperature: v } })}
        />
        <Slider
          label="Initial Humidity"
          value={params.initial.humidity}
          min={20}
          max={90}
          unit="%"
          onChange={(v) => setParams({ initial: { ...params.initial, humidity: v } })}
        />
        <p className="text-[10px] leading-relaxed text-ink-faint">Initial values apply on reset.</p>
      </Popover>

      <Popover id="perf" open={open} onOpen={setOpen} icon={<Gauge size={13} />} title="Performance">
        <PerfReadout />
      </Popover>
    </div>
  );
}
