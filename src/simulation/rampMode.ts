import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { clamp } from '../utils/math';
import { engine } from './engine';

/** Sim-seconds between ramp ticks. */
const STEP_EVERY = 45;

let nextStepAt = 0;

/**
 * Increase / Decrease modes (continuous ramps):
 * - increase: the office fills up while ventilation starves — conditions
 *   deteriorate live so the cause→effect chain is visible.
 * - decrease: people leave and HVAC recovers — everything trends green.
 * Called from the R3F frame loop; steps on a sim-time grid so ramp speed
 * follows the simulation speed control.
 */
export function updateRampMode() {
  const mode = useUiStore.getState().rampMode;
  if (!mode) {
    nextStepAt = 0;
    return;
  }
  if (nextStepAt === 0) nextStepAt = engine.simTime + STEP_EVERY;

  // Catch up over large sim-time jumps (high speed × slow frames), bounded.
  let steps = 0;
  while (engine.simTime >= nextStepAt && steps < 20) {
    nextStepAt += STEP_EVERY;
    steps++;
  }
  if (steps === 0) return;
  if (engine.simTime >= nextStepAt) nextStepAt = engine.simTime + STEP_EVERY;

  const sim = useSimStore.getState();
  const p = engine.params;
  const people = engine.totalPeople();

  if (mode === 'increase') {
    sim.setTotalPeople(clamp(people + 2 * steps, 0, 100));
    sim.setParams({
      ventilation: clamp(p.ventilation - 1.5 * steps, 12, 100),
      freshAir: clamp(p.freshAir - 1.5 * steps, 12, 100),
      ac: clamp(p.ac - 1 * steps, 25, 100),
    });
  } else {
    sim.setTotalPeople(clamp(people - 2 * steps, 12, 100));
    sim.setParams({
      ventilation: clamp(p.ventilation + 2 * steps, 0, 90),
      freshAir: clamp(p.freshAir + 2 * steps, 0, 90),
      ac: clamp(p.ac + 1.5 * steps, 0, 75),
    });
  }
}
