import type { OutdoorConditions } from '../types/environment';

/**
 * The provider seam (spec §39): dummy, weather API, and future physical
 * sensors all satisfy this interface, so the app never cares which is active.
 */
export interface OutdoorProvider {
  readonly id: string;
  readonly isLive: boolean;
  getCurrent(): Promise<OutdoorConditions>;
}
