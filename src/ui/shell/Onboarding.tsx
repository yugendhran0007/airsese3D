/**
 * First-visit guided tour (4 cards, remembered in localStorage). Opens the
 * panels each step talks about so the explanation points at something real.
 */
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useUiStore } from '../../state/uiStore';

const KEY = 'airsense.tour.v1';

const STEPS: { title: string; body: string; action?: () => void }[] = [
  {
    title: 'Welcome to AirSense',
    body: 'A live 3D model of a Chennai IT office. Outdoor weather and AQI stream in from Open-Meteo; a physics engine turns people, ventilation and AC into indoor CO₂, temperature and humidity per zone.',
  },
  {
    title: 'Walk the floor',
    body: 'Use WASD / arrow keys or click anywhere on the floor. The chip at the bottom shows the air in the zone you are standing in. ESC returns to the orbit camera.',
  },
  {
    title: 'People, not just numbers',
    body: 'Every employee carries a safety ring — green safe, yellow medium, red danger. Toggle Employee mode (N) for names, click anyone to inspect them, or open Data Viz (V) to see the whole office as people.',
    action: () => useUiStore.getState().setEmployeeMode(true),
  },
  {
    title: 'Make it worse, make it better',
    body: 'Increase fills the office and starves ventilation; Decrease recovers it. Controls on the left change everything else. Press ? any time for shortcuts.',
    action: () => useUiStore.getState().setEmployeeMode(false),
  },
];

export function Onboarding() {
  const [step, setStep] = useState<number>(() => {
    try {
      return localStorage.getItem(KEY) ? -1 : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (step >= 0) STEPS[step]?.action?.();
  }, [step]);

  if (step < 0) return null;
  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private mode */
    }
    useUiStore.getState().setEmployeeMode(false);
    setStep(-1);
  };
  const s = STEPS[step];
  return (
    <div className="glass pointer-events-auto fade-up absolute bottom-24 left-1/2 z-40 w-[26rem] -translate-x-1/2 rounded-2xl p-5 shadow-2xl">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase">
          Tour {step + 1} / {STEPS.length}
        </span>
        <button type="button" onClick={finish} className="rounded-md px-1 text-ink-dim hover:bg-danger/15 hover:text-danger" aria-label="Skip tour">
          <span className="text-[15px] leading-none" aria-hidden>🗙</span>
        </button>
      </div>
      <h3 className="text-base font-extrabold text-ink">{s.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-dim">{s.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'h-1.5 w-4 rounded-full bg-accent' : 'h-1.5 w-1.5 rounded-full bg-white/20'} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : finish())}
          className="flex items-center gap-1 rounded-lg bg-accent/15 px-3 py-1.5 text-[11px] font-bold tracking-wider text-accent uppercase hover:bg-accent/25"
        >
          {step + 1 < STEPS.length ? 'Next' : 'Start exploring'} <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
