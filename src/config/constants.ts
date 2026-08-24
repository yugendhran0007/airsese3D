import type { SimParams } from '../types/simulation';

/** Chennai, India */
export const CHENNAI = { lat: 13.0827, lon: 80.2707, tz: 'Asia/Kolkata' };

/** Outdoor CO2 baseline (ppm). Open-Meteo has no CO2, so a constant is used. */
export const OUTDOOR_CO2 = 420;

/** CO2 generation per seated adult, m³/h (≈0.005 L/s). */
export const CO2_GEN_M3H = 0.018;

/** Moisture generation per person, g/h. */
export const MOISTURE_GEN_GH = 50;

/** Sensible heat per person (W) and per active desk cluster of equipment (W). */
export const HEAT_PERSON_W = 100;
export const HEAT_DESK_W = 150;

/** Air volumetric heat capacity ρ·cp (J/m³·K). */
export const AIR_RHO_CP = 1.2 * 1005;

/** Air-change rates (h⁻¹). */
export const ACH_INFILTRATION = 0.3;
export const ACH_MECH_MAX = 8;
export const ACH_WINDOWS = 2.0;
export const ACH_DOOR = 0.5;

/** Envelope conduction coefficient (h⁻¹) pulling indoor T toward outdoor. */
export const K_ENVELOPE = 0.4;
/** AC cooling strength at 100% (h⁻¹ toward setpoint). */
export const K_AC_MAX = 8;
/** AC dehumidification strength at 100% (h⁻¹ toward target abs humidity). */
export const K_DEHUM_MAX = 3;
/** Abs humidity target the AC coil condenses toward (g/m³ ≈ 50% RH @ 23°C). */
export const W_AC_TARGET = 9.5;

/** Engine tick rate (Hz) and sim-time scale: 1 real second = 60 sim seconds at 1×. */
export const TICK_HZ = 10;
export const SIM_SECONDS_PER_REAL_SECOND = 60;
/** Max Euler substep, sim seconds. */
export const MAX_SUBSTEP = 10;
/** History ring buffer: sample every N sim seconds, keep M samples (~4 sim hours). */
export const HISTORY_SAMPLE_EVERY = 10;
export const HISTORY_CAPACITY = 1440;
/** DOM snapshot publish rate (Hz). */
export const SNAPSHOT_HZ = 4;

/** Weather polling (ms) and staleness threshold (ms). */
export const WEATHER_POLL_MS = 10 * 60 * 1000;
export const WEATHER_STALE_MS = 20 * 60 * 1000;

/** Sim office clock starts at 09:00. */
export const SIM_CLOCK_START_H = 9;

export const MAX_PEOPLE = 100;

export const DEFAULT_PARAMS: SimParams = {
  room: { width: 30, length: 20, height: 3.6 },
  peoplePerZone: { A: 6, B: 6, C: 7, D: 6 },
  ventilation: 70,
  freshAir: 60,
  ac: 60,
  acSetpoint: 23,
  doorOpen: false,
  windowsOpen: false,
  speed: 1,
  initial: { co2: 550, temperature: 25, humidity: 55 },
};

/** Status colors shared between DOM (CSS) and Three.js materials. */
export const STATUS_COLORS = {
  green: '#34d399',
  yellow: '#fbbf24',
  red: '#fb5d7c',
} as const;

export const ACCENT_COLOR = '#38e1ff';
