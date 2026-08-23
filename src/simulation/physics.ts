import {
  ACH_DOOR,
  ACH_INFILTRATION,
  ACH_MECH_MAX,
  ACH_WINDOWS,
  AIR_RHO_CP,
  CO2_GEN_M3H,
  HEAT_DESK_W,
  HEAT_PERSON_W,
  K_AC_MAX,
  K_DEHUM_MAX,
  K_ENVELOPE,
  MOISTURE_GEN_GH,
  OUTDOOR_CO2,
  W_AC_TARGET,
} from '../config/constants';
import { clamp } from '../utils/math';

export interface ZonePhysicsState {
  co2: number; // ppm
  temperature: number; // °C
  absHumidity: number; // g/m³
}

export interface StepContext {
  people: number;
  desks: number;
  volume: number; // m³ zone volume
  achFresh: number; // h⁻¹ total fresh-air changes
  achMech: number; // h⁻¹ mechanical (AHU-conditioned) portion of achFresh
  ac: number; // 0..1
  acSetpoint: number; // °C
  outdoorTemp: number; // °C
  outdoorAbsHumidity: number; // g/m³
  dtHours: number;
}

/** Fresh air-changes per hour, split into mechanical (AHU) and natural paths. */
export function achFresh(opts: {
  ventilation: number; // 0..1
  freshAir: number; // 0..1
  windowsOpen: boolean;
  doorOpen: boolean;
  windSpeedKmh: number;
}): { total: number; mech: number } {
  const windFactor = clamp(opts.windSpeedKmh / 15, 0.5, 2);
  const mech = ACH_MECH_MAX * opts.ventilation * opts.freshAir;
  const natural =
    ACH_INFILTRATION +
    (opts.windowsOpen ? ACH_WINDOWS * windFactor : 0) +
    (opts.doorOpen ? ACH_DOOR : 0);
  return { total: mech + natural, mech };
}

/** One Euler substep of CO2 for a zone. Rates in per-hour. */
export function co2Step(co2: number, ctx: StepContext): number {
  const gen = ((ctx.people * CO2_GEN_M3H) / ctx.volume) * 1e6; // ppm/h
  const removal = ctx.achFresh * (co2 - OUTDOOR_CO2);
  return Math.max(OUTDOOR_CO2, co2 + (gen - removal) * ctx.dtHours);
}

/** One Euler substep of zone temperature. */
export function temperatureStep(t: number, ctx: StepContext): number {
  const envelope = K_ENVELOPE * (ctx.outdoorTemp - t);
  // Mechanical fresh air passes the AHU cooling coil: intake temperature is
  // pulled toward the setpoint in proportion to AC power. Natural air
  // (windows/door/infiltration) enters at raw outdoor temperature.
  const coilIntake =
    ctx.outdoorTemp > ctx.acSetpoint
      ? ctx.outdoorTemp + (ctx.acSetpoint - ctx.outdoorTemp) * (0.85 * ctx.ac)
      : ctx.outdoorTemp; // cooling-only coil never warms intake air
  const achNatural = ctx.achFresh - ctx.achMech;
  const ventilation = ctx.achMech * (coilIntake - t) + achNatural * (ctx.outdoorTemp - t);
  const gainsW = ctx.people * HEAT_PERSON_W + ctx.desks * HEAT_DESK_W;
  const gains = (3600 * gainsW) / (AIR_RHO_CP * ctx.volume); // K/h
  const cooling = K_AC_MAX * ctx.ac * Math.max(0, t - ctx.acSetpoint);
  return t + (envelope + ventilation + gains - cooling) * ctx.dtHours;
}

/** One Euler substep of zone absolute humidity (g/m³). */
export function humidityStep(w: number, ctx: StepContext): number {
  const gen = (ctx.people * MOISTURE_GEN_GH) / ctx.volume;
  // The AHU coil condenses moisture out of mechanical intake air too.
  const coilIntakeW =
    ctx.outdoorAbsHumidity > W_AC_TARGET
      ? ctx.outdoorAbsHumidity + (W_AC_TARGET - ctx.outdoorAbsHumidity) * (0.85 * ctx.ac)
      : ctx.outdoorAbsHumidity; // coil condenses moisture, never adds it
  const achNatural = ctx.achFresh - ctx.achMech;
  const exchange = ctx.achMech * (coilIntakeW - w) + achNatural * (ctx.outdoorAbsHumidity - w);
  const dehum = K_DEHUM_MAX * ctx.ac * Math.max(0, w - W_AC_TARGET);
  return Math.max(0.5, w + (gen + exchange - dehum) * ctx.dtHours);
}

/**
 * Honest O2 display derived from CO2 displacement (respiratory quotient ≈ 0.85).
 * Never dramatizes: at 2000 ppm CO2 this is still ≈ 20.76%.
 */
export function o2FromCo2(co2ppm: number): number {
  return 20.95 - (co2ppm - OUTDOOR_CO2) / 10000 / 0.85;
}
