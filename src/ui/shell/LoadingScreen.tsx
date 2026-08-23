/**
 * Branded boot screen: tracks three.js asset loading (drei useProgress works
 * outside the Canvas) and fades out once the first models are in. Keeps the
 * user oriented during the realistic-mode load instead of showing a bare sky.
 */
import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { Wind } from 'lucide-react';
import clsx from 'clsx';

const TIPS = [
  'Walk the office with WASD / arrows, or click the floor.',
  'Press N for Employee mode — names and safety rings.',
  'Press V for the people-based Data Viz.',
  'Increase / Decrease ramp the whole office live.',
  'Outdoor weather and AQI are live from Open-Meteo, Chennai.',
];

export function LoadingScreen() {
  const { progress, active, loaded, total } = useProgress();
  const [done, setDone] = useState(false);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setDone(true), 700);
      return () => clearTimeout(t);
    }
    // Nothing ever queued (e.g. stylized mode with no GLTF): release after a beat
    const fallback = setTimeout(() => setDone(true), 12000);
    return () => clearTimeout(fallback);
  }, [active, progress]);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2600);
    return () => clearInterval(id);
  }, []);

  if (done) return null;
  const pct = Math.round(progress);

  return (
    <div
      className={clsx(
        'pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center bg-base transition-opacity duration-700',
        !active && progress >= 100 ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex items-center gap-3">
        <Wind size={36} className="text-accent" />
        <span className="text-3xl font-extrabold tracking-[0.3em] text-ink">
          AIR<span className="text-accent">SENSE</span>
        </span>
      </div>
      <p className="mt-2 text-[11px] tracking-[0.25em] text-ink-faint uppercase">Chennai office · live indoor air</p>
      <div className="mt-8 h-1.5 w-72 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.max(4, pct)}%`, boxShadow: '0 0 12px #38e1ff' }} />
      </div>
      <div className="num mt-2 text-[11px] text-ink-dim">{pct < 100 ? `Loading office · ${pct}% · ${loaded}/${total} assets` : 'Compiling shaders…'}</div>
      <p key={tip} className="fade-up mt-10 max-w-sm text-center text-xs text-ink-dim">{TIPS[tip]}</p>
    </div>
  );
}
