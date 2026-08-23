export type Status = 'green' | 'yellow' | 'red';

/** One zone's live environmental state (all simulated unless sensor mode). */
export interface ZoneReading {
  id: ZoneId;
  name: string;
  people: number;
  co2: number; // ppm
  o2: number; // %
  temperature: number; // °C
  humidity: number; // % RH (derived)
  absHumidity: number; // g/m³ (state variable)
  airflow: number; // m/s illustrative
  status: Status;
}

export type ZoneId = 'A' | 'B' | 'C' | 'D';

export interface EnvironmentSnapshot {
  simTime: number; // sim seconds since start
  simClock: string; // formatted HH:MM office clock
  zones: ZoneReading[];
  overall: {
    people: number;
    co2: number;
    o2: number;
    temperature: number;
    humidity: number;
    ventilation: number;
    airflow: number;
    status: Status;
  };
}

export interface OutdoorConditions {
  location: string;
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: number; // deg
  condition: string; // human label
  weatherCode: number; // WMO
  pressure: number; // hPa
  cloudCover: number; // %
  rain: number; // mm
  uvIndex: number;
  aqi: number | null; // US AQI
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
  timestamp: string; // ISO
}

export interface Alert {
  id: string;
  zoneId: ZoneId | 'ALL';
  severity: Exclude<Status, 'green'>;
  title: string;
  detail: string;
  recommendation: string;
  createdAtSim: number;
}

export interface HistorySample {
  t: number; // sim seconds
  co2: number;
  o2: number;
  temperature: number;
  humidity: number;
  people: number;
  ventilation: number;
  outdoorTemp: number | null;
  outdoorAqi: number | null;
}
