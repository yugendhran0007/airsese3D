import { PRESENTATION_SCENES, SCENARIOS } from '../config/scenarios';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import type { ScenarioStep } from '../types/simulation';
import { lerp } from '../utils/math';
import { engine } from './engine';

interface PlayerState {
  scenarioId: string | null;
  startSim: number;
  steps: ScenarioStep[];
  presentation: boolean;
  sceneStartSim: number;
  sceneIndex: number;
}

const state: PlayerState = {
  scenarioId: null,
  startSim: 0,
  steps: [],
  presentation: false,
  sceneStartSim: 0,
  sceneIndex: 0,
};

export function playScenario(id: string) {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) return;
  const sim = useSimStore.getState();
  sim.reset();
  sim.setRunning(true);
  state.scenarioId = id;
  state.steps = scenario.steps;
  state.startSim = engine.simTime;
  state.presentation = false;
  applyTargets(scenario.steps[0].targets);
  useUiStore.getState().setActiveScenario(id);
}

export function startPresentation() {
  const sim = useSimStore.getState();
  sim.reset();
  sim.setParams({ speed: 10 });
  sim.setRunning(true);
  state.scenarioId = 'presentation';
  state.presentation = true;
  state.sceneIndex = 0;
  state.sceneStartSim = engine.simTime;
  const ui = useUiStore.getState();
  ui.setActiveScenario('presentation');
  ui.setCameraMode('cinematic');
  ui.setPresentationScene(0);
  applyTargets(PRESENTATION_SCENES[0].targets ?? {});
}

export function stopScenario() {
  state.scenarioId = null;
  state.presentation = false;
  const ui = useUiStore.getState();
  ui.setActiveScenario(null);
  if (ui.cameraMode === 'cinematic') ui.setCameraMode('orbit');
}

/** Progress of the running scenario, 0..1, or null. */
export function scenarioProgress(): number | null {
  if (!state.scenarioId || state.presentation) return null;
  const elapsed = engine.simTime - state.startSim;
  const total = state.steps[state.steps.length - 1].atSim;
  return Math.min(1, elapsed / total);
}

/** Called from the R3F frame loop — advances scripted params/scenes. */
export function updateScenarioPlayer() {
  if (!state.scenarioId) return;

  if (state.presentation) {
    const scene = PRESENTATION_SCENES[state.sceneIndex];
    if (!scene) return stopScenario();
    const elapsed = engine.simTime - state.sceneStartSim;
    if (elapsed >= scene.durationSim) {
      state.sceneIndex++;
      state.sceneStartSim = engine.simTime;
      const next = PRESENTATION_SCENES[state.sceneIndex];
      if (!next) {
        stopScenario();
        useSimStore.getState().setParams({ speed: 1 });
        return;
      }
      useUiStore.getState().setPresentationScene(state.sceneIndex);
      if (next.targets) applyTargets(next.targets);
    }
    return;
  }

  const elapsed = engine.simTime - state.startSim;
  const steps = state.steps;
  let prev = steps[0];
  let next: ScenarioStep | null = null;
  for (let i = 1; i < steps.length; i++) {
    if (elapsed < steps[i].atSim) {
      next = steps[i];
      prev = steps[i - 1];
      break;
    }
    prev = steps[i];
  }
  if (!next) {
    // Large sim-time jumps (high speed × slow frames) can leap over whole
    // steps — apply the union of every step's targets so none are skipped.
    applyTargets(collapseTargets(steps, Number.MAX_SAFE_INTEGER));
    if (elapsed >= steps[steps.length - 1].atSim) stopScenario();
    return;
  }

  const t = (elapsed - prev.atSim) / (next.atSim - prev.atSim);
  const merged = collapseTargets(steps, elapsed);
  const sim = useSimStore.getState();
  const patch: Parameters<typeof sim.setParams>[0] = {};
  if (next.targets.totalPeople != null) {
    const from = merged.totalPeople ?? engine.totalPeople();
    sim.setTotalPeople(Math.round(lerp(from, next.targets.totalPeople, t)));
  }
  if (next.targets.ventilation != null) {
    patch.ventilation = lerp(merged.ventilation ?? engine.params.ventilation, next.targets.ventilation, t);
  }
  if (next.targets.freshAir != null) {
    patch.freshAir = lerp(merged.freshAir ?? engine.params.freshAir, next.targets.freshAir, t);
  }
  if (next.targets.ac != null) {
    patch.ac = lerp(merged.ac ?? engine.params.ac, next.targets.ac, t);
  }
  if (next.targets.doorOpen != null) patch.doorOpen = next.targets.doorOpen;
  if (next.targets.windowsOpen != null) patch.windowsOpen = next.targets.windowsOpen;
  if (Object.keys(patch).length) sim.setParams(patch);
}

/** Latest explicitly-set value for each target at or before `elapsed`. */
function collapseTargets(steps: ScenarioStep[], elapsed: number): ScenarioStep['targets'] {
  const out: ScenarioStep['targets'] = {};
  for (const step of steps) {
    if (step.atSim > elapsed) break;
    Object.assign(out, step.targets);
  }
  return out;
}

function applyTargets(targets: ScenarioStep['targets']) {
  const sim = useSimStore.getState();
  if (targets.totalPeople != null) sim.setTotalPeople(targets.totalPeople);
  const patch: Parameters<typeof sim.setParams>[0] = {};
  if (targets.ventilation != null) patch.ventilation = targets.ventilation;
  if (targets.freshAir != null) patch.freshAir = targets.freshAir;
  if (targets.ac != null) patch.ac = targets.ac;
  if (targets.doorOpen != null) patch.doorOpen = targets.doorOpen;
  if (targets.windowsOpen != null) patch.windowsOpen = targets.windowsOpen;
  if (Object.keys(patch).length) sim.setParams(patch);
}

/** 0..1 progress through the current presentation scene (camera dolly + progress bar). */
export function presentationProgress(): number {
  if (!state.presentation) return 0;
  const scene = PRESENTATION_SCENES[state.sceneIndex];
  if (!scene) return 0;
  return Math.min(1, (engine.simTime - state.sceneStartSim) / scene.durationSim);
}

/** Jump to the previous/next presentation scene (arrow keys / click). */
export function stepPresentation(delta: 1 | -1) {
  if (!state.presentation) return;
  const next = state.sceneIndex + delta;
  if (next < 0) return;
  if (next >= PRESENTATION_SCENES.length) {
    stopScenario();
    useSimStore.getState().setParams({ speed: 1 });
    return;
  }
  state.sceneIndex = next;
  state.sceneStartSim = engine.simTime;
  useUiStore.getState().setPresentationScene(next);
  const scene = PRESENTATION_SCENES[next];
  if (scene.targets) applyTargets(scene.targets);
}

export function currentPresentationScene() {
  return state.presentation ? PRESENTATION_SCENES[state.sceneIndex] ?? null : null;
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__scenario = {
    playScenario,
    startPresentation,
    stopScenario,
  };
}
