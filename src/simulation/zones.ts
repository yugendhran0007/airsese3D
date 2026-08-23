import type { ZoneId } from '../types/environment';
import type { RoomConfig } from '../types/simulation';

export const ZONE_IDS: ZoneId[] = ['A', 'B', 'C', 'D'];

/** Edge-adjacent pairs in the 2×2 grid:  A B / C D */
export const ZONE_ADJACENCY: [ZoneId, ZoneId][] = [
  ['A', 'B'],
  ['A', 'C'],
  ['B', 'D'],
  ['C', 'D'],
];

export interface ZoneGeometry {
  id: ZoneId;
  /** Center in world space (room centered at origin, floor at y=0). */
  center: [number, number];
  /** Half extents (x, z). */
  half: [number, number];
  volume: number; // m³
}

/** Build the 2×2 zone grid from room dimensions. A=back-left, B=back-right, C=front-left, D=front-right. */
export function buildZones(room: RoomConfig): Record<ZoneId, ZoneGeometry> {
  const hw = room.width / 4;
  const hl = room.length / 4;
  const volume = ((room.width / 2) * (room.length / 2) * room.height) as number;
  return {
    A: { id: 'A', center: [-hw, -hl], half: [hw, hl], volume },
    B: { id: 'B', center: [hw, -hl], half: [hw, hl], volume },
    C: { id: 'C', center: [-hw, hl], half: [hw, hl], volume },
    D: { id: 'D', center: [hw, hl], half: [hw, hl], volume },
  };
}

/** Which zone contains world position (x, z)? */
export function zoneAt(x: number, z: number): ZoneId {
  if (z < 0) return x < 0 ? 'A' : 'B';
  return x < 0 ? 'C' : 'D';
}
