export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

export const mapRange = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
  outMin + ((clamp(v, inMin, inMax) - inMin) / (inMax - inMin)) * (outMax - outMin);

/** Frame-rate-independent exponential damping toward a target. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Magnus formula: saturation vapor pressure (hPa) at T °C. */
export const satVaporPressure = (tC: number) => 6.112 * Math.exp((17.62 * tC) / (243.12 + tC));

/** Saturation absolute humidity (g/m³) at T °C. */
export const satAbsHumidity = (tC: number) => (216.7 * satVaporPressure(tC)) / (tC + 273.15);

/** Convert relative humidity % at T °C to absolute humidity g/m³. */
export const rhToAbs = (rh: number, tC: number) => (rh / 100) * satAbsHumidity(tC);

/** Convert absolute humidity g/m³ at T °C to relative humidity %. */
export const absToRh = (w: number, tC: number) => clamp((w / satAbsHumidity(tC)) * 100, 0, 100);
