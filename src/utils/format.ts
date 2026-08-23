import { SIM_CLOCK_START_H } from '../config/constants';

export const fmt = (v: number, digits = 0) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Sim seconds → office wall-clock HH:MM (starts 09:00). */
export function simClock(simSeconds: number): string {
  const total = SIM_CLOCK_START_H * 3600 + simSeconds;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** ISO timestamp → "15:30 IST". */
export function istTime(iso: string): string {
  try {
    return (
      new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      }) + ' IST'
    );
  } catch {
    return '—';
  }
}

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Storm + hail',
  99: 'Severe storm',
};

export const weatherLabel = (code: number) => WMO_CODES[code] ?? 'Unknown';
