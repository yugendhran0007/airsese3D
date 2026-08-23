import type { OutdoorConditions } from '../types/environment';
import type { OutdoorProvider } from './OutdoorProvider';

/**
 * Smooth synthetic Chennai weather from the local clock (sinusoidal day cycle
 * + gentle noise). Offline/dev fallback — always labeled as simulated.
 */
export class DummyOutdoorProvider implements OutdoorProvider {
  readonly id = 'dummy';
  readonly isLive = false;

  async getCurrent(): Promise<OutdoorConditions> {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    // Chennai August: ~27°C at dawn to ~34°C mid-afternoon.
    const dayPhase = Math.sin(((hour - 6) / 24) * Math.PI * 2);
    const wobble = Math.sin(now.getTime() / 480_000) * 0.6;
    const temperature = 30.5 + 3.5 * dayPhase + wobble;
    const humidity = 72 - 10 * dayPhase + Math.sin(now.getTime() / 600_000) * 3;

    return {
      location: 'Chennai (simulated)',
      temperature,
      humidity,
      windSpeed: 12 + 5 * Math.sin(now.getTime() / 900_000),
      windDirection: 220,
      weatherCode: 2,
      condition: 'Partly cloudy',
      pressure: 1005,
      cloudCover: 55,
      rain: 0,
      uvIndex: Math.max(0, 7 * dayPhase),
      aqi: 72 + Math.round(10 * Math.sin(now.getTime() / 1_200_000)),
      pm25: 21,
      pm10: 34,
      no2: 11,
      so2: 6,
      co: 260,
      o3: 95,
      timestamp: now.toISOString(),
    };
  }
}
