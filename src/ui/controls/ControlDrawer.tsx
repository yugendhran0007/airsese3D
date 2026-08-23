import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { MAX_PEOPLE } from '../../config/constants';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { CloseX } from '../shell/CloseX';

import { NumberInput } from './NumberInput';
import { Slider } from './Slider';
import { Toggle } from './Toggle';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2 border-b border-line pb-1 text-[10px] font-bold tracking-[0.2em] text-accent/80 uppercase first:mt-0">
      {children}
    </div>
  );
}

/** Left drawer: every simulation knob (spec §12, §20, §21, §29). */
export function ControlDrawer() {
  const open = useUiStore((s) => s.controlsOpen);
  const toggle = useUiStore((s) => s.toggle);
  const params = useSimStore((s) => s.params);
  const setParams = useSimStore((s) => s.setParams);
  const setTotalPeople = useSimStore((s) => s.setTotalPeople);
  const totalPeople = params.peoplePerZone.A + params.peoplePerZone.B + params.peoplePerZone.C + params.peoplePerZone.D;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle('controlsOpen')}
        className="glass pointer-events-auto absolute top-20 left-4 flex items-center gap-2 px-3 py-2 text-xs font-semibold tracking-wider text-ink-dim uppercase transition-colors hover:text-accent"
      >
        <SlidersHorizontal size={14} /> Controls
      </button>
    );
  }

  return (
    <aside className="glass pointer-events-auto absolute top-20 bottom-4 left-4 flex w-64 flex-col overflow-hidden fade-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-ink uppercase">
          <SlidersHorizontal size={14} className="text-accent" /> Office Controls
        </span>
        <CloseX onClick={() => useUiStore.getState().hideCard('controls')} label="Close Controls" />
      </div>

      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <SectionTitle>People</SectionTitle>
        <Slider label="Occupancy" value={totalPeople} min={0} max={MAX_PEOPLE} onChange={setTotalPeople} />
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setTotalPeople(totalPeople - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-accent/50 hover:text-accent"
          >
            <Minus size={14} />
          </button>
          <span className="num w-14 text-center text-xl font-bold text-ink">{totalPeople}</span>
          <button
            type="button"
            onClick={() => setTotalPeople(totalPeople + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-ink-dim transition-all hover:border-accent/50 hover:text-accent"
          >
            <Plus size={14} />
          </button>
        </div>

        <SectionTitle>Ventilation &amp; HVAC</SectionTitle>
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

        <SectionTitle>Openings</SectionTitle>
        <Toggle label="Main Door" value={params.doorOpen} onChange={(v) => setParams({ doorOpen: v })} />
        <Toggle label="Windows" value={params.windowsOpen} onChange={(v) => setParams({ windowsOpen: v })} />

        <SectionTitle>Room Size</SectionTitle>
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
            max={6}
            unit="m"
            onChange={(v) => setParams({ room: { ...params.room, height: v } })}
          />
        </div>
        <div className="num text-center text-[11px] text-ink-faint">
          Volume: {(params.room.width * params.room.length * params.room.height).toLocaleString()} m³
        </div>

        <SectionTitle>Initial Conditions</SectionTitle>
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
        <p className="text-[10px] leading-relaxed text-ink-faint">
          Initial values apply on reset. Arrow keys move your avatar (↑ forward, ↓ back, ← → side-step, Q/E turn); WASD moves relative to the camera; or click the floor.
        </p>
      </div>
    </aside>
  );
}
