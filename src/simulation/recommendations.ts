import type { OutdoorConditions } from '../types/environment';

export interface RecommendationInput {
  co2: number;
  temperature: number;
  humidity: number;
  people: number;
  ventilation: number; // %
  windowsOpen: boolean;
  outdoor: OutdoorConditions | null;
}

/** Rule-based, environmental only — never medical (spec §34). */
export function recommendationsFor(input: RecommendationInput): string[] {
  const recs: string[] = [];

  if (input.co2 > 1200) {
    recs.push('CO₂ is elevated — increase outdoor-air ventilation or fresh-air intake.');
  } else if (input.co2 > 800) {
    recs.push('CO₂ is rising — review ventilation and fresh-air settings.');
  }

  if (input.temperature > 26) {
    recs.push('Indoor temperature is high — review AC/HVAC settings.');
  } else if (input.temperature < 21) {
    recs.push('Indoor temperature is low — reduce AC cooling.');
  }

  if (input.humidity > 65) {
    recs.push('Humidity is high — increase AC dehumidification or ventilation.');
  } else if (input.humidity < 35) {
    recs.push('Humidity is low — reduce excessive ventilation or add humidification.');
  }

  if (input.people > 60 && input.ventilation < 60) {
    recs.push('High occupancy — review room capacity and raise ventilation.');
  }

  if (input.ventilation < 30) {
    recs.push('Airflow is low — inspect ventilation distribution.');
  }

  const aqi = input.outdoor?.aqi ?? null;
  if (aqi != null && aqi > 100 && input.windowsOpen) {
    recs.push('Outdoor AQI is high — prefer filtered mechanical fresh air over open windows.');
  }
  if (
    input.outdoor &&
    input.outdoor.temperature > 32 &&
    input.windowsOpen
  ) {
    recs.push('Outdoor air is hotter than indoors — open windows will raise indoor temperature.');
  }

  return recs;
}
