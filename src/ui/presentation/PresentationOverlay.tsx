import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRESENTATION_SCENES } from '../../config/scenarios';
import { STATUS_COLORS } from '../../config/constants';
import { presentationProgress, stepPresentation, stopScenario } from '../../simulation/scenarioPlayer';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { fmt } from '../../utils/format';
import { CloseX } from '../shell/CloseX';

/**
 * Letterboxed cinematic overlay (spec §38): scene caption cards, a live
 * readout strip so the story is backed by numbers, a per-scene progress bar
 * (rAF-driven from the scenario player — no React state per frame), and
 * ← → / click / ESC navigation.
 */
export function PresentationOverlay() {
  const active = useUiStore((s) => s.activeScenario);
  const sceneIndex = useUiStore((s) => s.presentationScene);
  const overall = useSimStore((s) => s.snapshot.overall);
  const isPresenting = active === 'presentation';
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPresenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopScenario();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); stepPresentation(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPresentation(-1); }
    };
    window.addEventListener('keydown', onKey);
    let raf = 0;
    const tick = () => {
      if (barRef.current) barRef.current.style.width = `${presentationProgress() * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [isPresenting]);

  if (!isPresenting) return null;
  const scene = PRESENTATION_SCENES[sceneIndex];
  if (!scene) return null;
  const color = STATUS_COLORS[overall.status];

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Letterbox bars */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />

      {/* Top strip: brand, live numbers, scene counter, exit */}
      <div className="pointer-events-auto absolute top-4 right-6 left-6 flex items-center justify-between">
        <span className="text-xs font-extrabold tracking-[0.3em] text-ink">
          AIR<span className="text-accent">SENSE</span> <span className="text-ink-faint">· PRESENTATION</span>
        </span>
        <div className="num flex items-center gap-4 rounded-full border border-line bg-black/40 px-4 py-1.5 text-[11px] text-ink-dim">
          <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span>People <b className="text-ink">{overall.people}</b></span>
          <span>CO₂ <b className="text-ink">{fmt(overall.co2)}</b> ppm</span>
          <span>Temp <b className="text-ink">{fmt(overall.temperature, 1)}</b> °C</span>
          <span>RH <b className="text-ink">{fmt(overall.humidity)}</b>%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-[11px] font-bold tracking-[0.3em] text-ink-dim">
            SCENE {scene.id} / {PRESENTATION_SCENES.length}
          </span>
          <CloseX onClick={stopScenario} label="Exit presentation (Esc)" />
        </div>
      </div>

      {/* Caption card + navigation. The card carries its own scrim: the
          letterbox gradient has already faded to transparent this far up, and
          near-white caption text over the bright office floor was unreadable. */}
      <div
        key={scene.id}
        className="pointer-events-auto absolute bottom-8 left-1/2 w-[640px] max-w-[92vw] -translate-x-1/2 rounded-2xl px-6 py-4 text-center fade-up"
        style={{ background: 'rgba(6, 10, 18, 0.72)', backdropFilter: 'blur(6px)' }}
      >
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => stepPresentation(-1)} className="text-ink-faint hover:text-ink" aria-label="Previous scene" disabled={sceneIndex === 0}>
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <div className="text-xl font-extrabold tracking-wide text-ink">{scene.title}</div>
            <div className="mt-1.5 text-sm leading-relaxed text-ink-dim">{scene.caption}</div>
          </div>
          <button type="button" onClick={() => stepPresentation(1)} className="text-ink-faint hover:text-ink" aria-label="Next scene">
            <ChevronRight size={22} />
          </button>
        </div>
        {/* Scene progress + dots */}
        <div className="mx-auto mt-3 h-0.5 w-64 overflow-hidden rounded-full bg-white/15">
          <div ref={barRef} className="h-full bg-accent" style={{ width: 0 }} />
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {PRESENTATION_SCENES.map((s, i) => (
            <span key={s.id} className={i === sceneIndex ? 'h-1.5 w-4 rounded-full bg-accent' : 'h-1.5 w-1.5 rounded-full bg-white/25'} />
          ))}
        </div>
        <div className="mt-2 text-[10px] tracking-[0.25em] text-ink-faint">← → SCENES · ESC TO EXIT</div>
      </div>
    </div>
  );
}
