import { characterTransient } from '../../state/characterStore';
import { engine } from '../../simulation/engine';
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
