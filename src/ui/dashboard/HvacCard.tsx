/**
 * Room size and HVAC/ventilation performance (spec §12, §21, §29).
 *
 * The other cards answer "what is the air like?". This one answers "why?" — it
 * puts the room's volume next to the air actually being moved through it and
 * the number of people producing CO₂ into it, because that ratio is the whole
 * story of indoor air quality. Occupancy alone is not danger (invariant 3):
 * thirty people in a well-ventilated hall are fine and eight in a sealed room
 * are not, and the only way to *show* that rather than assert it is to put the
 * two numbers side by side and let the user move the sliders.
 *
 * Everything here is derived from the same `achFresh()` the engine integrates
 * with, so the readout cannot drift from the simulation it describes.
 */
import { Wind } from 'lucide-react';
import clsx from 'clsx';
import { ACH_MECH_MAX, OUTDOOR_CO2, STATUS_COLORS } from '../../config/constants';
import { achFresh } from '../../simulation/physics';
import { useSimStore } from '../../state/simStore';
import { useWeatherStore } from '../../state/weatherStore';

/**
 * Outdoor air per person, in litres/second. The usual design target for an
 * office is around 10 L/s/person; below ~5 is where CO₂ climbs regardless of
 * how good the rest of the plant is. Bands are ventilation-adequacy bands, not
 * a health claim.
 */
function perPersonBand(lps: number): { status: 'green' | 'yellow' | 'red'; label: string } {
  if (lps >= 10) return { status: 'green', label: 'Good' };
  if (lps >= 5) return { status: 'yellow', label: 'Marginal' };
  return { status: 'red', label: 'Under-ventilated' };
}

function Row({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-ink-dim" title={hint}>
        {label}
      </span>
      <span className="num text-sm font-bold text-ink">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-ink-faint">{unit}</span>}
      </span>
    </div>
  );
}

/** Proportion of the fresh-air total that the AHU is responsible for. */
function MechBar({ mech, total }: { mech: number; total: number }) {
  const pct = total > 0 ? Math.round((mech / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-ink-faint">
        <span>Mechanical (AHU)</span>
        <span className="num">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-ink-faint">
        The rest is natural: infiltration, plus open windows and doors.
      </div>
    </div>
  );
}

export function HvacCard() {
  const params = useSimStore((s) => s.params);
  const people = useSimStore((s) => s.snapshot.overall.people);
  const co2 = useSimStore((s) => s.snapshot.overall.co2);
  const outdoor = useWeatherStore((s) => s.outdoor);

  const { width, length, height } = params.room;
  const volume = width * length * height;
  const { total, mech } = achFresh({
    ventilation: params.ventilation / 100,
    freshAir: params.freshAir / 100,
    windowsOpen: params.windowsOpen,
    doorOpen: params.doorOpen,
    windSpeedKmh: outdoor?.windSpeed ?? 10,
  });

  // ACH x volume = m³/h of outdoor air; /3.6 converts to litres/second.
  const freshLps = (total * volume) / 3.6;
  const perPerson = people > 0 ? freshLps / people : Infinity;
  const band = perPersonBand(perPerson);
  // Steady-state CO₂ this ventilation rate can hold at the current headcount:
  // generation balances removal when ppm = outdoor + gen / (ach x volume).
  const CO2_PER_PERSON_M3H = 0.0175; // ~4.9 mL/s of CO₂ for seated office work
  const steady = people > 0 && total > 0 ? OUTDOOR_CO2 + (people * CO2_PER_PERSON_M3H * 1e6) / (total * volume) : OUTDOOR_CO2;
  const heading = steady > co2 + 25 ? 'rising' : steady < co2 - 25 ? 'falling' : 'steady';

  return (
    <section className="glass rounded-2xl p-3.5">
      <header className="mb-2.5 flex items-center gap-2 border-b border-line pb-2">
        <Wind size={14} className="text-accent" />
        <h2 className="text-[11px] font-extrabold tracking-[0.18em] text-ink uppercase">Room &amp; HVAC</h2>
        <span className="ml-auto rounded bg-warn/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-warn uppercase">
          Simulated
        </span>
      </header>

      <div className="space-y-1.5">
        <Row label="Room" value={`${width} × ${length} × ${height}`} unit="m" />
        <Row label="Volume" value={Math.round(volume).toLocaleString()} unit="m³" />
        <Row label="Occupants" value={String(people)} />
      </div>

      <div className="my-2.5 h-px bg-line" />

      <div className="space-y-1.5">
        <Row
          label="Air changes"
          value={total.toFixed(1)}
          unit="/h"
          hint="Fresh outdoor air changes per hour — mechanical plus natural"
        />
        <Row label="Outdoor air" value={Math.round(freshLps).toLocaleString()} unit="L/s" />
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-ink-dim">Per person</span>
          <span className="num text-sm font-bold" style={{ color: STATUS_COLORS[band.status] }}>
            {people > 0 ? perPerson.toFixed(1) : '—'}
            <span className="ml-0.5 text-[10px] font-normal opacity-70">L/s</span>
          </span>
        </div>
        <div
          className="rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
          style={{ background: `${STATUS_COLORS[band.status]}1f`, color: STATUS_COLORS[band.status] }}
        >
          {people > 0 ? band.label : 'Empty room'}
        </div>
      </div>

      <div className="my-2.5 h-px bg-line" />

      <MechBar mech={mech} total={total} />

      <div className="my-2.5 h-px bg-line" />

      <div className="space-y-1.5">
        <Row label="Ventilation" value={String(Math.round(params.ventilation))} unit="%" />
        <Row label="Fresh air" value={String(Math.round(params.freshAir))} unit="%" />
        <Row label="AC" value={`${Math.round(params.ac)}% → ${params.acSetpoint.toFixed(1)}°C`} />
        <Row
          label="Settles at"
          value={Math.round(steady).toLocaleString()}
          unit="ppm"
          hint="Where CO₂ levels off if occupancy and ventilation stay as they are"
        />
      </div>

      <p className={clsx('mt-2 text-[10px] leading-relaxed', heading === 'rising' ? 'text-warn' : 'text-ink-faint')}>
        {people === 0
          ? 'Nobody in the room — CO₂ decays toward the 420 ppm outdoor baseline.'
          : heading === 'rising'
            ? `At ${Math.round(params.ventilation)}% ventilation this many people push CO₂ up toward ${Math.round(steady).toLocaleString()} ppm. More fresh air, or fewer people, lowers where it lands.`
            : heading === 'falling'
              ? 'Ventilation is ahead of the room — CO₂ is being washed out faster than it is produced.'
              : 'Generation and removal are balanced: CO₂ is holding where it is.'}
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
        {ACH_MECH_MAX} ACH is the AHU at full ventilation and 100% fresh air. Occupancy alone is not danger — it is
        generation against air changes, which is what these two numbers are.
      </p>
    </section>
  );
}
