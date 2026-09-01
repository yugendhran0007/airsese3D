import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { dprForBudget } from '../utils/renderScale';
import { resetAutoTune, stepAutoTune, useDetailLevel } from '../utils/autoTune';
import { updateRampMode } from '../simulation/rampMode';
import { updateScenarioPlayer } from '../simulation/scenarioPlayer';
import { characterTransient } from '../state/characterStore';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { AirflowRibbons } from './airflow/AirflowRibbons';
import { CameraRig } from './CameraRig';
import { ClickMarker } from './character/ClickMarker';
import { PlayerCharacter } from './character/PlayerCharacter';
import { SeatTargets } from './character/SeatTargets';
import { Effects } from './Effects';
import { Lighting } from './Lighting';
import { ConferenceRoom } from './office/ConferenceRoom';
import { CustomOffice, useCustomOfficeUrl } from './office/CustomOffice';
import { Furniture, useOfficeLayout } from './office/Furniture';
import { Cafeteria, RealisticFurniture } from './office/RealisticFurniture';
import { HvacUnits } from './office/HvacUnits';
import { OfficeShell } from './office/OfficeShell';
import { ZoneOverlay } from './office/ZoneOverlay';
import { WallTvs } from './office/WallTvs';
import { Crowd } from './people/Crowd';
import { RealisticCrowd } from './people/RealisticCrowd';
import { WanderingNpcs } from './people/WanderingNpcs';
import { NameTags } from './people/NameTags';
import { RealisticEnvironment } from './RealisticEnvironment';
import { Compiled } from './useAsyncCompile';

/**
 * The office is static geometry: only the player and the instanced crowd move,
 * and the seated avatars cast no shadows outside ultra. Re-rendering the whole
 * shadow map every frame therefore redraws ~140 casters for almost no change,
 * so it is refreshed every Nth frame instead — and continuously during a warm-up
 * window while GLTFs are still streaming in, and again whenever the room,
 * render mode or quality changes.
 */
function ShadowScheduler() {
  const gl = useThree((s) => s.gl);
  const quality = useUiStore((s) => s.quality);
  const renderMode = useUiStore((s) => s.renderMode);
  const room = useSimStore((s) => s.params.room);
  const frame = useRef(0);
  const warmUntil = useRef(0);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    warmUntil.current = performance.now() + 8000;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, quality, renderMode, room]);

  useFrame(() => {
    const every = quality === 'ultra' ? 2 : 4;
    if (performance.now() < warmUntil.current || frame.current++ % every === 0) {
      gl.shadowMap.needsUpdate = true;
    }
  });
  return null;
}

/** Frame-loop driver for scripted scenarios + ramp modes (runs inside Canvas). */
function ScenarioDriver() {
  useFrame(() => {
    updateScenarioPlayer();
    updateRampMode();
  });
  return null;
}

/** Background + fog per render mode: dark neon vs bright daylight. */
function Atmosphere() {
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // headless verification globals (scripts/verify.mjs)
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__scene = scene;
      w.__camera = camera;
      w.__gl = gl;
    }
  }, [scene, camera, gl]);
  useEffect(() => {
    if (realistic) {
      scene.background = new THREE.Color('#0d1522');
      scene.fog = new THREE.FogExp2('#77828f', 0.0035);
    } else {
      scene.background = new THREE.Color('#070d1a');
      scene.fog = new THREE.FogExp2('#070d1a', 0.005);
    }
  }, [realistic, scene]);
  return realistic ? <SkyDome /> : null;
}

/** Soft gradient daylight dome — controllable, never blows out the exposure. */
function SkyDome() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 horizon = vec3(0.72, 0.78, 0.85);
          vec3 zenith = vec3(0.28, 0.44, 0.66);
          vec3 ground = vec3(0.16, 0.19, 0.24);
          vec3 col = h > 0.5 ? mix(horizon, zenith, (h - 0.5) * 2.0) : mix(ground, horizon, h * 2.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);
  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[220, 24, 16]} />
    </mesh>
  );
}

/** Invisible click-catcher plane for click-to-walk. */
function FloorClickTarget() {
  const room = useSimStore((s) => s.params.room);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    characterTransient.target = { x: e.point.x, z: e.point.z };
    characterTransient.targetSetAt = performance.now() / 1000;
  };
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.01} onClick={onClick}>
      <planeGeometry args={[room.width, room.length]} />
      {/* Invisible but pickable: fully transparent, no depth writes */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function OfficeWorld() {
  const layout = useOfficeLayout();
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  // A tier switch recompiles every program (shadow toggle) and re-streams the
  // avatars; re-pace those through `Compiled` instead of paying for all of
  // them in one frame — see `Compiled` for the measurement.
  const quality = useUiStore((s) => s.quality);
  // A downloaded model in public/models/office/ (e.g. Sketchfab "Office
  // Studio", CC-BY) replaces the built-in building shell when present.
  const customOfficeUrl = useCustomOfficeUrl();
  const hasCustomOffice = customOfficeUrl !== null && customOfficeUrl !== 'pending';
  return (
    <Compiled deps={[quality, realistic]}>
      {realistic && <RealisticEnvironment />}
      {hasCustomOffice ? (
        <Suspense fallback={<OfficeShell />}>
          <Compiled>
            <CustomOffice url={customOfficeUrl} />
          </Compiled>
        </Suspense>
      ) : (
        <OfficeShell />
      )}
      {realistic ? (
        <Suspense fallback={<Furniture layout={layout} />}>
          <Compiled>
            <RealisticFurniture layout={layout} />
          </Compiled>
        </Suspense>
      ) : (
        <>
          <Furniture layout={layout} />
          <Cafeteria layout={layout} />
        </>
      )}
      <Suspense fallback={null}>
        <ConferenceRoom layout={layout} />
      </Suspense>
      <HvacUnits />
      <WallTvs layout={layout} />
      <ZoneOverlay />
      {realistic ? (
        <Suspense fallback={<Crowd layout={layout} />}>
          {/* Photorealistic avatars for every employee; instanced crowd only
              renders overflow past the per-zone avatar cap */}
          <Compiled deps={[quality]}>
            {/* Every employee is a real human avatar — no stylized overflow */}
            <RealisticCrowd layout={layout} />
          </Compiled>
        </Suspense>
      ) : (
        <Crowd layout={layout} />
      )}
      {realistic && (
        <Suspense fallback={null}>
          <Compiled deps={[quality]}>
            <WanderingNpcs layout={layout} />
          </Compiled>
        </Suspense>
      )}
      <NameTags layout={layout} />
      <PlayerCharacter layout={layout} />
      <SeatTargets layout={layout} />
      <ClickMarker />
      <FloorClickTarget />
      <AirflowRibbons />
    </Compiled>
  );
}

/**
 * Feeds every rendered frame to the adaptive detail controller. One `useFrame`
 * for the whole app: the controller keeps its own state at module level and
 * only touches React on the rare occasion the detail level actually moves.
 */
/**
 * Never let the adaptive render scale take the canvas below this many
 * megapixels. Measured on an Intel UHD with the ladder at its floor: 0.52 MPix
 * ran at 22–25 fps, and 0.28 MPix — the same 0.5× rung on a 1.25-DPR laptop
 * viewport — ran at 22–25 fps too. Below about half a megapixel the frame is
 * no longer fragment-bound; what remains is the avatars' vertex and draw work,
 * so every pixel shed past that point is sharpness given away for nothing. The
 * ratchet cannot see this on its own (one rung is under the noise of a
 * one-second window — see `autoTune.ts`), so the floor is absolute. It binds
 * only when the *scale* pushed the canvas under it: a base ratio that is
 * already lower (a TV budget on an 8K viewport) is left alone.
 */
const MIN_RENDER_MPIX = 0.5;

function AutoTuner() {
  const autoTune = useUiStore((s) => s.autoTune);
  useFrame((_, dt) => stepAutoTune(dt, autoTune));
  return null;
}

export function Scene() {
  // Adaptive resolution: drei's PerformanceMonitor samples the frame rate and
  // steps the device-pixel-ratio between 0.8× and 2× so a fast GPU gets a
  // crisp picture while an integrated one keeps a smooth frame rate.
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio));
  // Presentation output: the canvas is sized from an absolute pixel budget, so
  // the same setting behaves identically on this laptop panel and on the 64" 8K
  // TV (where a device-ratio multiple would ask for 15–33 MPix a frame).
  // Recomputed on resize because the budget depends on the CSS viewport.
  const tvMode = useUiStore((s) => s.tvMode);
  const tvBudgetMp = useUiStore((s) => s.tvBudgetMp);
  const [viewport, setViewport] = useState(() => [window.innerWidth, window.innerHeight] as const);
  useEffect(() => {
    if (!tvMode) return;
    const on = () => setViewport([window.innerWidth, window.innerHeight] as const);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [tvMode]);
  const tvDpr = dprForBudget(tvBudgetMp, viewport[0], viewport[1]);
  // "8K" ultra mode: pin the canvas at the device's full pixel ratio (up to 2×)
  // and let the SMAA/mipmapped textures do the rest — no adaptive downscale.
  const quality = useUiStore((s) => s.quality);
  const ultra = quality === 'ultra';
  const fast = quality === 'fast';
  // Adaptive detail: the measured-frame-rate controller owns the final render
  // scale whenever it is on. It supersedes PerformanceMonitor's DPR stepping —
  // two controllers fighting over the same number is how a picture ends up
  // pulsing — so those callbacks stand down below.
  const autoTune = useUiStore((s) => s.autoTune);
  const detail = useDetailLevel();
  const renderMode = useUiStore((s) => s.renderMode);
  // A tier, render-mode or presentation-mode switch changes the cost of a frame
  // wholesale, so whatever level the controller settled on describes a scene
  // that no longer exists. Start measuring again.
  useEffect(() => {
    resetAutoTune();
  }, [quality, renderMode, tvMode]);
  // Stop rendering entirely while the tab is hidden (the 10 Hz engine keeps
  // simulating, so the picture is current the moment the tab returns)
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const baseDpr = tvMode ? tvDpr : ultra ? Math.min(2, window.devicePixelRatio) : fast ? Math.min(1, dpr) : dpr;
  const scaledDpr = baseDpr * (autoTune ? detail.renderScale : 1);
  const floorDpr = Math.min(baseDpr, Math.sqrt((MIN_RENDER_MPIX * 1e6) / Math.max(1, window.innerWidth * window.innerHeight)));
  return (
    <Canvas
      shadows
      frameloop={visible ? 'always' : 'never'}
      dpr={Math.max(scaledDpr, floorDpr)}
      camera={{ position: [24, 14, 26], fov: 45, near: 0.1, far: 300 }}
      gl={{
        // MSAA on the default framebuffer. `antialias` is fixed at context
        // creation, so it cannot follow the quality tier — and it must be on,
        // because postprocessing (which brings SMAA) is exactly what Fast and
        // auto-tune's lower rungs give up first. Without it those tiers render
        // with *no* antialiasing at all, and on a big panel the canvas is
        // already being upscaled, which makes every stair-step twice as wide.
        // When the composer does run it renders to its own target and this
        // costs only the extra sample memory on a buffer nothing reads.
        // `?noaa` is a diagnostic only (like `?nofx`): measured on an Intel
        // UHD the 4× MSAA costs ~10 % at 1.5 MPix and nothing at 0.5 MPix.
        antialias: !new URLSearchParams(window.location.search).has('noaa'),
        powerPreference: 'high-performance',
        toneMapping: THREE.AgXToneMapping,
        toneMappingExposure: 1.45,
      }}
      style={{ position: 'absolute', inset: 0 }}
      // Shader info-log queries after every link are a debugging aid; they add
      // a synchronous GPU round-trip per program on cold loads
      onCreated={({ gl }) => {
        gl.debug.checkShaderErrors = import.meta.env.DEV;
        // Let the browser restore a lost context (GPU reset / driver hiccup) instead of dying
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
      }}
    >
      <PerformanceMonitor
        bounds={() => [40, 58]}
        flipflops={3}
        // Presentation mode holds the picture still: the budget already fixes
        // the resolution, and a tier drop or resolution step part-way through a
        // talk is far more jarring on a 64" screen than a few slow frames.
        onIncline={() => { if (!tvMode && !autoTune) setDpr((d) => Math.min(2, window.devicePixelRatio, d + 0.25)); }}
        onDecline={() => { if (!tvMode && !autoTune) setDpr((d) => Math.max(0.8, d - 0.25)); }}
        onFallback={() => {
          if (tvMode || autoTune) return;
          setDpr(0.8);
          // Sustained poor frame rate: drop to the lightweight tier automatically
          if (useUiStore.getState().quality === 'balanced') useUiStore.getState().setQuality('fast');
        }}
      />
      <Suspense fallback={null}>
        <Atmosphere />
        <Lighting />
        <OfficeWorld />
        <CameraRig />
        <ScenarioDriver />
        <ShadowScheduler />
        <AutoTuner />
        {!fast && <Effects />}
      </Suspense>
    </Canvas>
  );
}
