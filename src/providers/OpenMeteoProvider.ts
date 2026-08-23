import { CHENNAI } from '../config/constants';
import type { OutdoorConditions } from '../types/environment';
import { weatherLabel } from '../utils/format';
import type { OutdoorProvider } from './OutdoorProvider';

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CHENNAI.lat}&longitude=${CHENNAI.lon}` +
  `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,surface_pressure,cloud_cover,rain,uv_index` +
  `&timezone=${encodeURIComponent(CHENNAI.tz)}`;

const AQI_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CHENNAI.lat}&longitude=${CHENNAI.lon}` +
  `&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone` +
  `&timezone=${encodeURIComponent(CHENNAI.tz)}`;

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Chennai live conditions from Open-Meteo (keyless, free). AQI failure is non-fatal. */
export class OpenMeteoProvider implements OutdoorProvider {
  readonly id = 'open-meteo';
  readonly isLive = true;

  async getCurrent(): Promise<OutdoorConditions> {
    const weatherData = await fetchJson(WEATHER_URL);
    const w = weatherData.current as Record<string, number>;

    let aq: Record<string, number | null> = {};
    try {
      const aqiData = await fetchJson(AQI_URL);
      aq = aqiData.current as Record<string, number | null>;
    } catch {
      // AQI endpoint down — weather still valid; AQI fields stay null.
    }

    return {
      location: 'Chennai',
      temperature: w.temperature_2m,
      humidity: w.relative_humidity_2m,
      windSpeed: w.wind_speed_10m,
      windDirection: w.wind_direction_10m,
      weatherCode: w.weather_code,
      condition: weatherLabel(w.weather_code),
      pressure: w.surface_pressure,
      cloudCover: w.cloud_cover,
      rain: w.rain,
      uvIndex: w.uv_index,
      aqi: aq.us_aqi ?? null,
      pm25: aq.pm2_5 ?? null,
      pm10: aq.pm10 ?? null,
      no2: aq.nitrogen_dioxide ?? null,
      so2: aq.sulphur_dioxide ?? null,
      co: aq.carbon_monoxide ?? null,
      o3: aq.ozone ?? null,
      timestamp: new Date().toISOString(),
    };
  }
}
