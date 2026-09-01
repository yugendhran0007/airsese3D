import { characterTransient } from '../../state/characterStore';
import { engine } from '../../simulation/engine';
import { OUTDOOR_CO2 } from '../../config/constants';
import type { Status } from '../../types/environment';
import { ZONE_IDS } from '../../simulation/zones';
import type { OfficeLayout, Seat } from '../office/officeLayout';

/**
 * Seats nobody is sitting in. Both crowds fill each zone's seat array in order
 * (realistic avatars first, the instanced `Crowd` taking the overflow), so
 * everything from `peoplePerZone[zone]` onward is genuinely empty.
 */
export function freeSeats(layout: OfficeLayout): Seat[] {
  const perZone = engine.params.peoplePerZone;
  const out: Seat[] = [];
  for (const id of ZONE_IDS) {
    const seats = layout.seats[id];
    for (let i = Math.min(perZone[id], seats.length); i < seats.length; i++) out.push(seats[i]);
  }
  return out;
}

/** True when `seat` is the same slot as `other` (seats are value objects rebuilt per layout). */
export function sameSeat(a: Seat | null, b: Seat | null): boolean {
  return !!a && !!b && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
}

/** Nearest free seat to (x, z), or null when every seat is taken. */
export function nearestFreeSeat(layout: OfficeLayout, x: number, z: number, maxDist = Infinity): Seat | null {
  let best: Seat | null = null;
  let bestD = maxDist;
  for (const seat of freeSeats(layout)) {
    const d = Math.hypot(seat.x - x, seat.z - z);
    if (d < bestD) {
      bestD = d;
      best = seat;
    }
  }
  return best;
}

/**
 * True when the player avatar is sitting in the slot at (x, z). Both crowds
 * check this so raising occupancy while seated cannot spawn an NPC into the
 * player's chair.
 */
export function playerOccupies(x: number, z: number): boolean {
  const seat = characterTransient.seat;
  return !!seat && Math.abs(seat.x - x) < 1e-6 && Math.abs(seat.z - z) < 1e-6;
}

/**
 * The free seat with the best air, tempered by how far you would have to walk
 * (spec §20, §29).
 *
 * "Suitable" is not simply "nearest". Air quality in this office is per zone —
 * CO₂ builds where people are and clears where the vents reach — so the seat
 * worth taking is often one zone over, and a chooser that only measures metres
 * would sit you back down in the same bad air you just left.
 *
 * Score is CO₂ above the outdoor baseline plus a status penalty, with distance
 * added at a deliberately gentle weight: crossing the office for genuinely
 * cleaner air is worth it, walking to the far corner to save 20 ppm is not.
 * Ties fall back to the nearer seat, so behaviour stays deterministic.
 */
export function bestAirSeat(layout: OfficeLayout, x: number, z: number): Seat | null {
  const zones = engine.snapshot.zones;
  /** ppm of "regret" per metre walked — small, so air dominates and distance breaks ties. */
  const DISTANCE_WEIGHT = 12;
  /** Flat penalties that keep a walker out of amber and red air even when the ppm gap is narrow. */
  const STATUS_PENALTY = { green: 0, yellow: 350, red: 900 } as const;

  let best: Seat | null = null;
  let bestScore = Infinity;
  for (const seat of freeSeats(layout)) {
    const zone = zones.find((zz) => zz.id === seat.zone);
    if (!zone) continue;
    const score =
      zone.co2 - OUTDOOR_CO2 +
      STATUS_PENALTY[zone.status] +
      Math.hypot(seat.x - x, seat.z - z) * DISTANCE_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = seat;
    }
  }
  return best;
}

/** Air quality at a seat, for tinting its marker. */
export function seatStatus(seat: Seat): Status {
  return engine.snapshot.zones.find((z) => z.id === seat.zone)?.status ?? 'green';
}
