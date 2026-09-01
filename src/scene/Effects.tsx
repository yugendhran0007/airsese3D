import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette, SMAA } from '@react-three/postprocessing';
import { useUiStore } from '../state/uiStore';
import { useDetailLevel } from '../utils/autoTune';

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
  const tvMode = useUiStore((s) => s.tvMode);
  const autoTune = useUiStore((s) => s.autoTune);
  const detail = useDetailLevel();
  const [enabled, setEnabled] = useState(() => !window.location.search.includes('nofx'));
  const slowFrames = useRef(0);

  useFrame((_, dt) => {
    if (!enabled) return;
    // Auto-tune owns this decision when it is on: postprocessing is the last
    // rung of its ladder, given up only after cheaper detail has already gone.
    // The blunt timer below would pre-empt that ordering and throw away the
    // most visible thing first.
    if (autoTune) return;
    // Presentation mode keeps SMAA no matter what. Rendering below the panel's
    // native resolution makes edge antialiasing *more* important, not less, so
    // dropping it on a slow patch is exactly backwards on a 64" screen — and
    // once dropped it never came back for the rest of the talk.
    if (tvMode) return;
    if (dt > 1 / 28) {
      slowFrames.current++;
      if (slowFrames.current > 150) setEnabled(false); // ~5s of slow frames
    } else {
      slowFrames.current = Math.max(0, slowFrames.current - 2);
    }
  });

  if (!enabled) return null;
  const mode = autoTune ? detail.postFx : 'full';
  if (mode === 'none') return null;

  // Decoration goes first, antialiasing second: bloom and vignette are
  // atmosphere, while SMAA is legibility of edges. On the rung between them the
  // composer still runs but only cleans edges, which is the cheaper half.
  return (
    <EffectComposer multisampling={0}>
      {mode === 'full' && (<>
      <Bloom
        luminanceThreshold={realistic ? 1.0 : 0.65}
        luminanceSmoothing={realistic ? 0.15 : 0.3}
        intensity={realistic ? 0.3 : 0.85}
        mipmapBlur
      />
      <Vignette eskil={false} offset={realistic ? 0.3 : 0.18} darkness={realistic ? 0.45 : 0.72} />
      </>)}
      <SMAA />
    </EffectComposer>
  );
}
