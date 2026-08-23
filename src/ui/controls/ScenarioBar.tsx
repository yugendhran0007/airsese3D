import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { CloseX } from '../shell/CloseX';

import { Clapperboard, Square } from 'lucide-react';
import { SCENARIOS } from '../../config/scenarios';
import { playScenario, scenarioProgress, startPresentation, stopScenario } from '../../simulation/scenarioPlayer';
import { useUiStore } from '../../state/uiStore';

/** Scenario chips + presentation-mode launcher (spec §28, §38). */
export function ScenarioBar() {
  const active = useUiStore((s) => s.activeScenario);
  const chartsOpen = useUiStore((s) => s.chartsOpen);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setProgress(scenarioProgress()), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={clsx(
        'glass pointer-events-auto absolute left-4 flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all',
        chartsOpen ? 'bottom-[16.5rem]' : 'bottom-4',
      )}
    >
      <span className="mr-1 text-[9px] font-bold tracking-[0.2em] text-ink-faint uppercase">Scenarios</span>
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.description}
          onClick={() => (active === s.id ? stopScenario() : playScenario(s.id))}
          className={clsx(
            'relative overflow-hidden rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap transition-all',
            active === s.id
              ? 'bg-accent/20 text-accent shadow-[0_0_10px_rgba(56,225,255,0.25)]'
              : 'text-ink-dim hover:bg-white/5 hover:text-ink',
          )}
        >
          {active === s.id && progress != null && (
            <span
              className="absolute inset-y-0 left-0 bg-accent/15"
              style={{ width: `${progress * 100}%` }}
            />
          )}
          <span className="relative">{s.name}</span>
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-line" />
      <button
        type="button"
        title="Cinematic 9-scene presentation"
        onClick={() => (active === 'presentation' ? stopScenario() : startPresentation())}
        className={clsx(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider transition-all',
          active === 'presentation'
            ? 'bg-danger/20 text-danger'
            : 'bg-accent/10 text-accent hover:bg-accent/20',
        )}
      >
        {active === 'presentation' ? <Square size={11} /> : <Clapperboard size={11} />}
        {active === 'presentation' ? 'Stop' : 'Present'}
      </button>
      <CloseX onClick={() => useUiStore.getState().hideCard('scenarios')} label="Close Scenarios" className="ml-1" />
    </div>
  );
}
