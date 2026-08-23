export interface AqiBand {
  label: string;
  color: string;
}

/** US AQI band → label + color. */
export function aqiBand(aqi: number | null): AqiBand {
  if (aqi == null) return { label: 'Unavailable', color: '#5a6d8f' };
  if (aqi <= 50) return { label: 'Good', color: '#34d399' };
  if (aqi <= 100) return { label: 'Moderate', color: '#fbbf24' };
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', color: '#fb923c' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#fb5d7c' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#c084fc' };
  return { label: 'Hazardous', color: '#9f1239' };
}
