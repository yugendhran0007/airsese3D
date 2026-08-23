/**
 * "Data Viz" people view (spec §35–37 spirit): the office's air data told
 * through people, not bars. Every occupant is one unit — a person glyph in
 * Human mode, an LED seat-cell in Digital mode — arranged in the same 2×2
 * zone grid as the floor, coloured by their safety level (green safe ·
 * yellow medium · red danger, always paired with a posture/icon + label so
 * colour never carries meaning alone). Zone readings are "breath meters"
 * (same-hue tracks against the threshold), headline counts are hero figures,
 * and a table view backs everything for accessibility.
 *
 * Reads the 4 Hz zustand snapshot (DOM panel — no per-frame data). Identity
 * comes from the mock directory (anonymous badge ids, spec §54) and
 * per-person state from `personStatus` so it matches the 3D rings exactly.
 * Illustrative, population-level — never medical advice.
 */
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Cpu, PersonStanding, Table2 } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { employeeFor } from '../../config/employees';
import { DEFAULT_THRESHOLDS } from '../../config/thresholds';
import { isPersonAffected, personStatus, possibleEffectsFor } from '../../simulation/effects';
import { ZONE_IDS } from '../../simulation/zones';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import type { Status, ZoneId, ZoneReading } from '../../types/environment';

type VizMode = 'human' | 'digital';

const STATUS_LABEL: Record<Status, string> = { green: 'Safe', yellow: 'Medium', red: 'Danger' };
const STATUS_GLYPH: Record<Status, string> = { green: '●', yellow: '▲', red: '✖' };

interface Unit {
  zone: ZoneId;
  index: number;
  id: string;
  status: Status;
  affected: boolean;
}

function unitsFor(zone: ZoneReading): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < zone.people; i++) {
    const seed = i * 17 + zone.id.charCodeAt(0) * 101;
    out.push({
      zone: zone.id,
      index: i,
      id: employeeFor(zone.id, i).id,
      status: personStatus(seed, zone.status),
      affected: isPersonAffected(seed, zone.status),
    });
  }
  return out;
}

/** One person glyph (Human mode). Affected people slump; danger ones carry a mark. */
function PersonGlyph({ u, active }: { u: Unit; active: boolean }) {
  const c = STATUS_COLORS[u.status];
  const slump = u.affected ? 8 : 0;
  return (
    <svg viewBox="0 0 32 48" className={clsx('h-12 w-8 transition-transform', active && 'scale-125')} aria-hidden>
      {/* Head */}
      <circle cx={16 + slump * 0.5} cy={8 + slump * 0.4} r={6} fill={c} />
      {/* Body — leans forward when affected */}
      <path
        d={`M8 46 V24 q0-8 8-8 q8 0 8 8 V46 Z`}
        fill={c}
        opacity={0.85}
        transform={u.affected ? 'rotate(10 16 46)' : undefined}
      />
      {/* Status mark: triangle = medium, cross = danger (never colour alone) */}
      {u.status !== 'green' && (
        <text x={26} y={12} fontSize={11} fontWeight={800} fill="#fff" textAnchor="middle">
          {u.status === 'red' ? '!' : '▲'}
        </text>
      )}
    </svg>
  );
}

/** One LED seat-cell (Digital mode): phosphor tile with a monospace readout of the zone reading (there are no per-seat sensors — never invent per-person ppm). */
function DigitalCell({ u, co2, active }: { u: Unit; co2: number; active: boolean }) {
  const c = STATUS_COLORS[u.status];
  return (
    <div
      className={clsx('flex h-12 w-[4.2rem] flex-col justify-between rounded-[3px] border px-1 py-0.5 transition-transform', active && 'scale-110')}
      style={{
        borderColor: c,
        background: `linear-gradient(180deg, ${c}33, ${c}0d)`,
        boxShadow: `inset 0 0 10px ${c}55, 0 0 ${u.status === 'red' ? 10 : 4}px ${c}66`,
      }}
    >
      <div className="num flex items-center justify-between text-[9px] leading-none text-ink">
        <span>{u.id.slice(4)}</span>
        <span style={{ color: c }}>{STATUS_GLYPH[u.status]}</span>
      </div>
      <div className="num text-[11px] leading-none font-bold" style={{ color: c }}>
        {Math.round(co2)}
        <span className="text-[8px] text-ink-faint"> ppm</span>
      </div>
    </div>
  );
}

/** Breath meter: a single-hue track against the green/yellow limits — not a bar chart, a ratio vs a limit. */
function Meter({ label, value, unit, greenMax, yellowMax, max, digital }: {
  label: string; value: number; unit: string; greenMax: number; yellowMax: number; max: number; digital: boolean;
}) {
  const status: Status = value <= greenMax ? 'green' : value <= yellowMax ? 'yellow' : 'red';
  const pct = Math.min(100, (value / max) * 100);
  const c = STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-12 tracking-wider text-ink-faint uppercase">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c, boxShadow: digital ? `0 0 8px ${c}` : undefined }} />
        <span className="absolute top-0 h-full w-px bg-ink/50" style={{ left: `${(greenMax / max) * 100}%` }} />
        <span className="absolute top-0 h-full w-px bg-ink/50" style={{ left: `${(yellowMax / max) * 100}%` }} />
      </div>
      <span className={clsx('num w-16 text-right text-ink', digital && 'font-bold')} style={digital ? { color: c } : undefined}>
        {Number.isInteger(value) ? value : value.toFixed(1)}{unit}
      </span>
    </div>
  );
}

function Hero({ n, label, status, digital }: { n: number; label: string; status: Status; digital: boolean }) {
  const c = STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white/4 px-4 py-2">
      <span className={clsx('text-lg leading-none', digital && 'drop-shadow-[0_0_6px_currentColor]')} style={{ color: c }} aria-hidden>
        {STATUS_GLYPH[status]}
      </span>
      <div>
        <div className={clsx('num text-3xl leading-none font-extrabold text-ink', digital && 'tracking-widest')}>{n}</div>
        <div className="mt-1 text-[10px] font-bold tracking-[0.18em] text-ink-dim uppercase">{label}</div>
      </div>
    </div>
  );
}

export function DataVizOverlay() {
  const open = useUiStore((s) => s.dataVizOpen);
  const toggle = useUiStore((s) => s.toggle);
  const setSelectedPerson = useUiStore((s) => s.setSelectedPerson);
  const snapshot = useSimStore((s) => s.snapshot);
  const params = useSimStore((s) => s.params);
  const [mode, setMode] = useState<VizMode>('human');
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<Unit | null>(null);

  const zones = useMemo(() => ZONE_IDS.map((id) => snapshot.zones.find((z) => z.id === id)!).filter(Boolean), [snapshot]);
  const units = useMemo(() => zones.map(unitsFor), [zones]);
  const counts = useMemo(() => {
    const c: Record<Status, number> = { green: 0, yellow: 0, red: 0 };
    for (const zs of units) for (const u of zs) c[u.status]++;
    return c;
  }, [units]);

  if (!open) return null;
  const digital = mode === 'digital';
  const hoverZone = hover ? zones.find((z) => z.id === hover.zone) : null;

  return (
    <section
      className={clsx(
        'glass pointer-events-auto absolute top-20 right-4 bottom-4 left-4 flex flex-col overflow-hidden fade-up',
        digital && 'bg-[#030a0c]/95',
      )}
      style={digital ? { fontFamily: '"JetBrains Mono", Consolas, monospace' } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
        <div>
          <h2 className="text-sm font-extrabold tracking-[0.2em] text-ink uppercase">
            {digital ? 'Seat Matrix' : 'People View'} <span className="text-ink-faint">· one unit = one person</span>
          </h2>
          <p className="text-[10px] text-ink-faint">
            Who is breathing what, right now · {snapshot.simClock} · illustrative, population-level — not medical advice
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-2 flex overflow-hidden rounded-lg border border-line">
            {(['human', 'digital'] as VizMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  'flex h-7 items-center gap-1 px-2.5 text-[10px] font-bold tracking-wider uppercase transition-all',
                  mode === m ? 'bg-accent/15 text-accent' : 'text-ink-dim hover:text-ink',
                )}
              >
                {m === 'human' ? <PersonStanding size={12} /> : <Cpu size={12} />} {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            className={clsx(
              'flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold tracking-wider uppercase',
              table ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line text-ink-dim hover:text-ink',
            )}
            title="Table view (accessible)"
          >
            <Table2 size={12} /> Table
          </button>
          <button type="button" onClick={() => toggle('dataVizOpen')} className="ml-1 rounded-md px-1 text-ink-dim hover:bg-danger/15 hover:text-danger" aria-label="Close">
            <span className="text-[15px] leading-none" aria-hidden>🗙</span>
          </button>
        </div>
      </div>

      {/* Hero figures + legend */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <Hero n={counts.green} label="Safe" status="green" digital={digital} />
        <Hero n={counts.yellow} label="Medium" status="yellow" digital={digital} />
        <Hero n={counts.red} label="Danger" status="red" digital={digital} />
        <div className="ml-auto flex flex-col gap-0.5 text-[10px] text-ink-dim">
          <span><b className="text-ink">{snapshot.overall.people}</b> people · <b className="text-ink">{params.ventilation}%</b> ventilation · <b className="text-ink">{params.freshAir}%</b> fresh air</span>
          <span className="text-ink-faint">
            {(['green', 'yellow', 'red'] as Status[]).map((s) => (
              <span key={s} className="mr-3"><span style={{ color: STATUS_COLORS[s] }}>{STATUS_GLYPH[s]}</span> {STATUS_LABEL[s]}</span>
            ))}
            · slumped posture / ! = possible comfort effects
          </span>
        </div>
      </div>

      {/* Body */}
      {table ? (
        <div className="scroll-thin flex-1 overflow-auto px-5 pb-4">
          <table className="w-full text-left text-[11px]">
            <thead className="text-[10px] tracking-wider text-ink-faint uppercase">
              <tr><th className="py-1">Person</th><th>Zone</th><th>Level</th><th>CO₂</th><th>Temp</th><th>RH</th><th>Possible effects</th></tr>
            </thead>
            <tbody className="num">
              {units.flat().map((u) => {
                const z = zones.find((zz) => zz.id === u.zone)!;
                return (
                  <tr key={u.id} className="border-t border-line/60 hover:bg-white/4">
                    <td className="py-1">{u.id}</td><td>{z.name}</td>
                    <td><span style={{ color: STATUS_COLORS[u.status] }}>{STATUS_GLYPH[u.status]}</span> {STATUS_LABEL[u.status]}</td>
                    <td>{Math.round(z.co2)} ppm</td><td>{z.temperature.toFixed(1)} °C</td><td>{Math.round(z.humidity)}%</td>
                    <td className="font-sans text-ink-dim">{u.affected ? possibleEffectsFor(z).join(', ') || '—' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scroll-thin relative grid flex-1 grid-cols-2 gap-3 overflow-auto px-5 pb-4">
          {zones.map((z, zi) => {
            const zc = STATUS_COLORS[z.status];
            return (
              <div
                key={z.id}
                className={clsx('flex flex-col rounded-xl border p-3', digital ? 'bg-black/40' : 'bg-white/3')}
                style={{ borderColor: `${zc}66` }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-extrabold tracking-[0.18em] text-ink uppercase">
                    <span style={{ color: zc }}>{STATUS_GLYPH[z.status]}</span> {z.name}
                  </span>
                  <span className="num text-[10px] text-ink-dim">{z.people} people · {STATUS_LABEL[z.status]}</span>
                </div>
                {/* Unit grid */}
                <div className={clsx('flex flex-1 flex-wrap content-start', digital ? 'gap-1' : 'gap-0.5')}>
                  {units[zi].length === 0 && <span className="text-[10px] text-ink-faint">empty</span>}
                  {units[zi].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseEnter={() => setHover(u)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setSelectedPerson({ zone: u.zone, index: u.index })}
                      className="rounded p-0.5 outline-none hover:bg-white/6 focus-visible:ring-1 focus-visible:ring-accent"
                      aria-label={`${u.id}, ${STATUS_LABEL[u.status]}`}
                      title={`${u.id} · ${STATUS_LABEL[u.status]}`}
                    >
                      {digital ? <DigitalCell u={u} co2={z.co2} active={hover?.id === u.id} /> : <PersonGlyph u={u} active={hover?.id === u.id} />}
                    </button>
                  ))}
                </div>
                {/* Breath meters */}
                <div className="mt-2 flex flex-col gap-1">
                  <Meter label="CO₂" value={Math.round(z.co2)} unit=" ppm" greenMax={DEFAULT_THRESHOLDS.co2.greenMax} yellowMax={DEFAULT_THRESHOLDS.co2.yellowMax} max={2000} digital={digital} />
                  <Meter label="Temp" value={z.temperature} unit=" °C" greenMax={DEFAULT_THRESHOLDS.temperature.greenMax} yellowMax={DEFAULT_THRESHOLDS.temperature.yellowMax} max={36} digital={digital} />
                  <Meter label="RH" value={Math.round(z.humidity)} unit="%" greenMax={DEFAULT_THRESHOLDS.humidity.greenMax} yellowMax={DEFAULT_THRESHOLDS.humidity.yellowMax} max={100} digital={digital} />
                </div>
              </div>
            );
          })}

          {/* Hover tooltip */}
          {hover && hoverZone && (
            <div className="pointer-events-none absolute right-8 bottom-6 w-64 rounded-xl border border-line bg-panel/95 p-3 text-[11px] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="num font-bold text-ink">{hover.id}</span>
                <span style={{ color: STATUS_COLORS[hover.status] }}>{STATUS_GLYPH[hover.status]} {STATUS_LABEL[hover.status]}</span>
              </div>
              <div className="num mt-1 text-ink-dim">
                {hoverZone.name} · {Math.round(hoverZone.co2)} ppm · {hoverZone.temperature.toFixed(1)} °C · {Math.round(hoverZone.humidity)}% RH
              </div>
              {hover.affected && possibleEffectsFor(hoverZone).length > 0 && (
                <div className="mt-1 text-ink-dim">Possible: {possibleEffectsFor(hoverZone).join(', ')}</div>
              )}
              <div className="mt-1 text-[9px] text-ink-faint">Educational · not a diagnosis · click to inspect in 3D</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
