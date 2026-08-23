import type { Status, ZoneReading } from '../types/environment';
import { seededRandom } from '../utils/math';

/**
 * Educational per-person "possible effect" model (spec §37 constraints):
 * in degraded zones a deterministic fraction of occupants display possible
 * comfort effects. This is an illustrative visualization of population-level
 * associations — never a diagnosis of any individual.
 */

/** Fraction of a zone's occupants highlighted as possibly affected. */
export function affectedFraction(status: Status): number {
  if (status === 'red') return 0.55;
  if (status === 'yellow') return 0.22;
  return 0;
}

/** Deterministic: is person `index` in this zone highlighted right now? */
export function isPersonAffected(personSeed: number, status: Status): boolean {
  return seededRandom(personSeed * 31 + 7) < affectedFraction(status);
}

/** Possible-effect labels for a zone's current readings (worst first). */
export function possibleEffectsFor(zone: ZoneReading): string[] {
  const out: string[] = [];
  if (zone.co2 > 1400) out.push('headache');
  if (zone.co2 > 1000) out.push('reduced focus / fatigue');
  if (zone.co2 > 1200 || zone.humidity < 32) out.push('eye irritation');
  if (zone.co2 > 1600 || (zone.temperature > 28 && zone.humidity > 65)) out.push('respiratory discomfort');
  if (zone.temperature > 28) out.push('heat discomfort');
  return out;
}

/**
 * Per-person safety level shown as the floor ring colour (spec §37):
 * green = safe, yellow = medium, red = danger. Derived from the zone status
 * and the deterministic affected flag, so two neighbours in a yellow zone can
 * differ (most stay green, the affected share turns yellow); in a red zone
 * everyone is at least medium and the affected share is danger.
 */
export function personStatus(personSeed: number, zoneStatus: Status): Status {
  const affected = isPersonAffected(personSeed, zoneStatus);
  if (zoneStatus === 'red') return affected ? 'red' : 'yellow';
  if (zoneStatus === 'yellow') return affected ? 'yellow' : 'green';
  return 'green';
}
