import type { OutdoorConditions } from '../types/environment';
import type { OutdoorProvider } from './OutdoorProvider';

/**
 * Mode 3 placeholder (spec §8, §42): physical ESP32/MQTT sensors plug in here
 * later by implementing the same provider interface. Intentionally disabled.
 */
export class SensorProviderStub implements OutdoorProvider {
  readonly id = 'sensors';
  readonly isLive = true;

  async getCurrent(): Promise<OutdoorConditions> {
    throw new Error('Physical sensors are not connected. Sensor mode arrives in a future phase.');
  }
}
