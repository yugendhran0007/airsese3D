import type { Status } from '../types/environment';

export interface Band {
  /** Inclusive green range. */
  greenMin: number;
  greenMax: number;
  /** Yellow extends this far beyond green on each side; red beyond that. */
  yellowMin: number;
  yellowMax: number;
}

export interface Thresholds {
  co2: Band;
  temperature: Band;
  humidity: Band;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  co2: { greenMin: 0, greenMax: 800, yellowMin: 0, yellowMax: 1200 },
  temperature: { greenMin: 22, greenMax: 26, yellowMin: 20, yellowMax: 28 },
  humidity: { greenMin: 40, greenMax: 60, yellowMin: 30, yellowMax: 70 },
};

export function bandStatus(value: number, band: Band): Status {
  if (value >= band.greenMin && value <= band.greenMax) return 'green';
  if (value >= band.yellowMin && value <= band.yellowMax) return 'yellow';
  return 'red';
}

export function worst(...statuses: Status[]): Status {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}
