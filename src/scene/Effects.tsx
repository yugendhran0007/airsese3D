import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette, SMAA } from '@react-three/postprocessing';
import { useUiStore } from '../state/uiStore';

/**
 * Bloom (emissive-only via luminance threshold) + vignette + SMAA.
 * Auto quality tier: sustained <28 FPS disables postprocessing entirely.
 *
 * Realistic mode is a bright daylit office (white walls, carpet, env map):
 * with the neon-tuned threshold its floors and walls crossed the bloom cut
 * and the whole scene washed out white, so it blooms only what is genuinely
 * over-bright (screens, LED bars) and keeps the vignette subtle.
 */
export function Effects() {
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  const [enabled, setEnabled] = useState(() => !window.location.search.includes('nofx'));
  const slowFrames = useRef(0);

  useFrame((_, dt) => {
    if (!enabled) return;
    if (dt > 1 / 28) {
      slowFrames.current++;
      if (slowFrames.current > 150) setEnabled(false); // ~5s of slow frames
    } else {
      slowFrames.current = Math.max(0, slowFrames.current - 2);
    }
  });

  if (!enabled) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={realistic ? 1.0 : 0.65}
        luminanceSmoothing={realistic ? 0.15 : 0.3}
        intensity={realistic ? 0.3 : 0.85}
        mipmapBlur
      />
      <Vignette eskil={false} offset={realistic ? 0.3 : 0.18} darkness={realistic ? 0.45 : 0.72} />
      <SMAA />
    </EffectComposer>
  );
}
