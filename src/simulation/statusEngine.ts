import { bandStatus, worst, type Thresholds } from '../config/thresholds';
import type { Status } from '../types/environment';

export interface ZoneStatusInput {
  co2: number;
  temperature: number;
  humidity: number; // RH %
}

export function zoneStatus(z: ZoneStatusInput, th: Thresholds): Status {
  return worst(
    bandStatus(z.co2, th.co2),
    bandStatus(z.temperature, th.temperature),
    bandStatus(z.humidity, th.humidity),
  );
}

/** Which parameter is driving the worst status (for alert copy). */
export function worstParameter(
  z: ZoneStatusInput,
  th: Thresholds,
): { param: 'co2' | 'temperature' | 'humidity'; status: Status } {
  const entries = [
    { param: 'co2' as const, status: bandStatus(z.co2, th.co2) },
    { param: 'temperature' as const, status: bandStatus(z.temperature, th.temperature) },
    { param: 'humidity' as const, status: bandStatus(z.humidity, th.humidity) },
  ];
  const red = entries.find((e) => e.status === 'red');
  if (red) return red;
  const yellow = entries.find((e) => e.status === 'yellow');
  return yellow ?? entries[0];
}
