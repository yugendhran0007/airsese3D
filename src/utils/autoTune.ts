/**
 * Adaptive detail controller — "auto-tune to smooth" (spec §37).
 *
 * The quality tiers are a *guess* about the machine: `recommendQuality()` reads
 * core count, RAM and the GPU renderer string on first visit and picks one. On
 * a large external display that guess is doubly unreliable, because the cost of
 * a frame is dominated by the panel's pixel count rather than by anything the
 * hardware string reveals — the same laptop is comfortable at 1440p and
 * hopeless at 8K.
 *
 * So instead of guessing, measure. This module samples the real frame rate in
 * one-second windows and walks a ladder of detail levels until the frame rate
 * sits at the target, then stops. The picture settles wherever this particular
 * GPU can hold a smooth frame rate on this particular display.
 *
 * ## Why the ladder is ordered the way it is
 *
 * The order encodes an explicit priority from the user: **smoothness first,
 * realism second, unnecessary effects last**. So each rung sheds whatever is
 * least load-bearing for *understanding the office*, and decoration goes before
 * anything that carries the clarity of the infrastructure or the people:
 *
 *  1. **Decorative effects** first — bloom and vignette, then the airflow
 *     particle density. They are atmosphere, not information; nobody reads the
 *     room's air quality off a bloom highlight.
 *  2. **Post antialiasing** next. SMAA goes only after the decoration, and it
 *     costs less than it looks like it should because the canvas is created
 *     with MSAA (`Scene.tsx`), which keeps geometry edges clean without it.
 *  3. **Distant detail** next: facial submeshes that are sub-pixel past a few
 *     metres, then micro-animation on avatars far from the camera. Neither
 *     changes what a viewer can make out of a person they are looking at.
 *  4. **Render scale** *last*, and gently at first. Whether it buys anything
 *     depends entirely on which GPU is drawing. On the RTX 3050 it is worth
 *     **nothing**: fixed camera, fixed rung, only the pixel ratio moved, and
 *     0.44 MPix gave 30.0 fps, 0.73 MPix 30.0 fps, 1.15 MPix 29.9 fps — that
 *     machine is bound by skinned-avatar vertex and draw work, which does not
 *     scale with pixels (hiding the avatars doubled its frame rate). So the
 *     upper rungs shave it lightly (1.0 → 0.85) and the top two do not touch
 *     it, because on that GPU every pixel given up on a 64" panel buys zero
 *     frames. But the same laptop with its dGPU off (Optimus / Armoury Crate
 *     "Eco" mode) draws on the Intel UHD, and that chip is **fragment-bound**:
 *     interleaved A/B at a fixed camera measured 1.50 MPix at 14–18 fps,
 *     0.52 MPix at 22–25 fps and 0.25 MPix at 28 fps. The ladder therefore
 *     continues below `Fluid` with three rungs that only lower the render
 *     scale (0.75 → 0.65 → 0.5). They are reached only after every effect and
 *     LOD has already been shed and the frame rate is *still* under target,
 *     so a GPU for which resolution is free never walks that far — it settles
 *     higher — while a fragment-bound one finally gets the one lever that
 *     helps it.
 *
 * ## What is deliberately NOT on the ladder
 *
 * Shadow maps and the skinned-avatar count are both large wins and both are
 * excluded on purpose. Toggling `castShadow` swaps every material to a
 * different shader variant and the GPU process compiles those serially on the
 * next draw; changing the avatar count streams new GLBs and compiles more. Both
 * produce a multi-hundred-millisecond freeze — the exact stutter this
 * controller exists to remove. A lever that costs a hitch to pull cannot be
 * used to buy smoothness. Those stay on the manual tier buttons, where the user
 * chooses the moment to pay for them.
 *
 * ## Why it locks
 *
 * A controller that keeps adjusting forever is worse than a slightly wrong
 * fixed setting: resolution changes are visible, and a picture that breathes in
 * and out of focus during a talk reads as a fault. After a bounded number of
 * adjustments the level is frozen for the rest of the session. This is also how
 * presentation mode keeps its promise of a picture that does not change
 * mid-talk while still adapting to the machine it is actually running on.
 */
import { useSyncExternalStore } from 'react';

export interface DetailLevel {
  /** Index into `DETAIL_LADDER`. 0 = richest. */
  id: number;
  label: string;
  /** Multiplier on the device-pixel-ratio the tier or TV budget asked for. */
  renderScale: number;
  /**
   * Which postprocessing survives at this rung.
   * `full` = bloom + vignette + SMAA, `aa` = SMAA only, `none` = composer off.
   */
  postFx: 'full' | 'aa' | 'none';
  /** Fraction of the airflow particle budget drawn (atmosphere, not information). */
  particles: number;
  /** Camera distance (m) beyond which seated micro-animation freezes. */
  animDist: number;
  /** Camera distance (m) beyond which an avatar's facial submeshes hide. */
  faceDist: number;
}

/** Richest first. Each rung sheds the least-visible remaining cost. */
export const DETAIL_LADDER: readonly DetailLevel[] = [
  { id: 0, label: 'Maximum', renderScale: 1.0, postFx: 'full', particles: 1.0, animDist: 30, faceDist: 10 },
  { id: 1, label: 'High', renderScale: 1.0, postFx: 'aa', particles: 0.7, animDist: 26, faceDist: 9 },
  { id: 2, label: 'Clear', renderScale: 0.97, postFx: 'none', particles: 0.45, animDist: 20, faceDist: 7 },
  { id: 3, label: 'Balanced', renderScale: 0.93, postFx: 'none', particles: 0.3, animDist: 15, faceDist: 5 },
  { id: 4, label: 'Smooth', renderScale: 0.89, postFx: 'none', particles: 0.2, animDist: 11, faceDist: 4 },
  { id: 5, label: 'Fluid', renderScale: 0.85, postFx: 'none', particles: 0.12, animDist: 8, faceDist: 3 },
  // Below here only the render scale moves — see "Render scale" above. These
  // rungs exist for fragment-bound GPUs (integrated graphics); a GPU that is
  // bound elsewhere settles before reaching them.
  { id: 6, label: 'Lean', renderScale: 0.75, postFx: 'none', particles: 0.12, animDist: 8, faceDist: 3 },
  { id: 7, label: 'Light', renderScale: 0.65, postFx: 'none', particles: 0.12, animDist: 8, faceDist: 3 },
  { id: 8, label: 'Minimal', renderScale: 0.5, postFx: 'none', particles: 0.12, animDist: 8, faceDist: 3 },
];

/**
 * Default start, one rung below the top so a capable GPU has somewhere to
 * climb. Once a session has settled somewhere the rung is remembered
 * (`localStorage`) and the next load starts *there*: walking from the top to
 * the bottom of the ladder costs two slow windows plus a settle per rung, which
 * on a machine that belongs at the bottom is ~20 s of the very stutter this
 * controller exists to remove, repeated on every visit. Starting from the
 * remembered rung is only a starting point — the ratchet still climbs if the
 * machine turns out faster (a dGPU switched back on), it just climbs from a
 * smooth picture instead of dropping from a stuttering one.
 */
const START_LEVEL = 1;
const STORAGE_KEY = 'airsense.detail';

function loadStartLevel(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return START_LEVEL;
    const id = Number.parseInt(raw, 10);
    if (!Number.isInteger(id) || id < 0 || id >= DETAIL_LADDER.length) return START_LEVEL;
    return id;
  } catch {
    return START_LEVEL;
  }
}

function saveLevel(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Private mode / storage disabled: the session still tunes, it just won't remember.
  }
}
/** Ignore the first seconds: GLBs are still streaming and shaders compiling. */
const WARMUP_MS = 4000;
const WINDOW_MS = 1000;
/** Below this the picture is costing more than it is worth. */
const SLOW_FPS = 50;
/**
 * Below this the picture is not just expensive but visibly stuttering, and
 * waiting for a second slow window before acting is a second of stutter spent
 * confirming what one window already showed. A single window this slow steps
 * down at once; the two-window rule still guards the ordinary case, where one
 * bad second could be a GLB decode or a tab regaining focus.
 */
const VERY_SLOW_FPS = 30;
/** Above this there is headroom to spend. */
const FAST_FPS = 56;
/** Consecutive slow windows before stepping down — react quickly to real pain. */
const SLOW_WINDOWS = 2;
/** Consecutive fast windows before stepping up — climb slowly and reluctantly. */
const FAST_WINDOWS = 6;
/** Total adjustments allowed before the level freezes for the session. */
const MAX_STEPS = 8;
/**
 * Frames to throw away after a rung change, before believing the next
 * measurement.
 *
 * Changing `renderScale` re-enters R3F's `setDpr`, which calls
 * `setPixelRatio` + `setSize` and reallocates the drawing buffer — with MSAA
 * on, that is a multisample buffer realloc, measured here as two `setSize`
 * calls per step and tens of milliseconds of stall. That cost belongs to the
 * *act of stepping*, not to the rung it lands on, and it is far below `STALL_S`
 * so it is not otherwise discarded. Measured through it, the controller reads
 * its own resize as evidence the picture is still too expensive and steps
 * again — the one action it takes to buy smoothness makes the next reading
 * look worse.
 *
 * Measured: this halves the resize churn over a load (12 `setSize` calls to 6)
 * and settles on the same rung at the same frame rate, so it is free.
 *
 * **Do not turn a down-step into a revertible probe.** Tried and reverted: the
 * idea was that if the rung below is no faster, the frame rate is not
 * pixel-bound, so the resolution should be handed back. It fails because one
 * rung is only a ~16 % change in pixel count, which is smaller than the
 * frame-time noise in a one-second window — so the probe reads "no gain" from
 * measurement noise and stops after one step, while the *cumulative* walk down
 * the ladder is worth a great deal. A/B on the production build: reverting the
 * probe settled at 1.12 MPix and 18 fps (p95 174 ms), the plain ratchet at
 * 0.43 MPix and 71 fps (p95 42 ms). If this is attempted again it needs a
 * multi-rung probe measured over several windows, not a single step.
 *
 * Note that that A/B compared whole *rungs*, which differ in postFx, particle
 * count and LOD distances as well as in resolution, so it never isolated the
 * pixel count. The later fixed-camera, fixed-rung sweep did, and found
 * resolution free across 0.44-1.15 MPix. Trust the isolated measurement: the
 * rung-vs-rung gap was the effects and LOD, not the pixels.
 */
const SETTLE_MS = 700;
/**
 * A frame longer than this is a stall — a tab switch, a GC pause, an asset
 * decode — and gets thrown away rather than averaged in.
 *
 * The threshold is deliberately far above any frame rate worth reacting to. An
 * earlier 0.5 s cut discarded *every* frame on a machine actually running at
 * 2 fps, so the controller went blind at exactly the frame rate it exists to
 * rescue and never stepped down. A stall must be distinguishable from a very
 * slow frame, and 2 s is comfortably past the slowest real frame while still
 * catching the multi-second gaps that follow a hidden tab.
 */
const STALL_S = 2;

let current: DetailLevel = DETAIL_LADDER[loadStartLevel()];
let measuredFps = 0;
let elapsedMs = 0;
let windowMs = 0;
let windowFrames = 0;
let slowRun = 0;
let fastRun = 0;
let steps = 0;
let locked = false;
/** Frames are discarded while this is positive — see `SETTLE_MS`. */
let settleMs = 0;

const listeners = new Set<() => void>();

function setLevel(id: number) {
  const next = DETAIL_LADDER[Math.min(DETAIL_LADDER.length - 1, Math.max(0, id))];
  if (next === current) return;
  current = next;
  saveLevel(next.id);
  steps++;
  if (steps >= MAX_STEPS) locked = true;
  // The resize this triggers is not a measurement of the new rung.
  settleMs = SETTLE_MS;
  windowMs = 0;
  windowFrames = 0;
  for (const l of listeners) l();
}

/**
 * Feed one rendered frame. Called from a single `useFrame` in the scene — this
 * is per-frame work, so nothing here touches React except the rare level change.
 */
export function stepAutoTune(dt: number, enabled: boolean) {
  if (dt <= 0 || dt > STALL_S) return; // stall: not a measurement
  const ms = dt * 1000;
  elapsedMs += ms;
  if (settleMs > 0) {
    // Still paying for the last rung change — see `SETTLE_MS`.
    settleMs -= ms;
    windowMs = 0;
    windowFrames = 0;
    return;
  }
  windowMs += ms;
  windowFrames++;
  if (windowMs < WINDOW_MS) return;

  measuredFps = (windowFrames * 1000) / windowMs;
  windowMs = 0;
  windowFrames = 0;
  if (!enabled || locked || elapsedMs < WARMUP_MS) return;

  if (measuredFps < SLOW_FPS) {
    slowRun++;
    fastRun = 0;
    if (slowRun >= SLOW_WINDOWS || measuredFps < VERY_SLOW_FPS) {
      slowRun = 0;
      setLevel(current.id + 1);
    }
  } else if (measuredFps > FAST_FPS) {
    fastRun++;
    slowRun = 0;
    if (fastRun >= FAST_WINDOWS) {
      fastRun = 0;
      setLevel(current.id - 1);
    }
  } else {
    slowRun = 0;
    fastRun = 0;
  }
}

/**
 * Start measuring again from scratch. Called when something changes the cost of
 * a frame wholesale — quality tier, render mode, presentation mode — because
 * the level the controller settled on describes a scene that no longer exists.
 */
export function resetAutoTune() {
  elapsedMs = 0;
  windowMs = 0;
  windowFrames = 0;
  slowRun = 0;
  fastRun = 0;
  steps = 0;
  locked = false;
  settleMs = 0;
  // The remembered rung describes this machine, not the scene that just
  // changed, but it is still a far better first guess than the top of the
  // ladder: the ratchet corrects it in a few windows either way.
  setLevel(loadStartLevel());
  settleMs = 0;
}

/** Latest one-second frame-rate sample. Read by the UI on its own clock. */
export function measuredFrameRate(): number {
  return measuredFps;
}

/** True once the level has stopped moving for the session. */
export function autoTuneLocked(): boolean {
  return locked;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): DetailLevel {
  return current;
}

/** Current detail level. Re-renders only on the rare level change. */
export function useDetailLevel(): DetailLevel {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Non-reactive read, for `useFrame` callbacks. */
export function detailLevel(): DetailLevel {
  return current;
}
