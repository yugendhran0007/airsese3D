import { ZONE_IDS, buildZones, zoneAt } from '../../simulation/zones';
import type { ZoneId } from '../../types/environment';
import type { RoomConfig } from '../../types/simulation';
import { seededRandom } from '../../utils/math';

export interface DeskPod {
  /** Pod center in world space. */
  x: number;
  z: number;
  zone: ZoneId;
}

/** What a seat is for — drives chair/table style, monitors, and the seated pose. */
export type SeatKind = 'desk' | 'meeting' | 'cafe';

export interface Seat {
  x: number;
  z: number;
  /** Facing angle (rad, around Y). Facing vector is (sin, cos). */
  angle: number;
  zone: ZoneId;
  kind: SeatKind;
}

export interface StandSpot {
  x: number;
  z: number;
  angle: number;
  zone: ZoneId;
}

export type AreaKind = 'conference' | 'meeting' | 'cafeteria';

export interface AreaRect {
  kind: AreaKind;
  /** Stable id (used as React key / label). */
  id: string;
  label: string;
  cx: number;
  cz: number;
  /** Full width (x) and depth (z). */
  w: number;
  d: number;
  /** Which side the door gap is on (+1 = +z face, -1 = -z face). */
  doorSide: 1 | -1;
  /** Door gap centre x (world) — the gap is `DOOR_HALF` each side of it. */
  doorX: number;
}

export type ConferenceRect = AreaRect;

export interface CafeTable {
  x: number;
  z: number;
  r: number;
}

export interface OfficeLayout {
  pods: DeskPod[];
  /** Seat slots grouped per zone, deterministic order. */
  seats: Record<ZoneId, Seat[]>;
  /** Overflow standing spots per zone. */
  stands: Record<ZoneId, StandSpot[]>;
  /** Collision volumes for the character controller (see `Obstacle`). */
  obstacles: Obstacle[];
  /** Glass conference hall against the back wall. */
  conference: ConferenceRect;
  /** Every enclosed/special area: conference, meeting rooms, cafeteria. */
  areas: AreaRect[];
  /** Round café tables (cafeteria). */
  cafeTables: CafeTable[];
  /** Structural columns (realistic shell). */
  columns: { x: number; z: number }[];
  /** Floor planter positions (the "trees"), shared by the decor and the collider. */
  planters: { x: number; z: number }[];
}

/**
 * A character-collider volume: a circle (`r`) or an axis-aligned box
 * (`hw`/`hd` half-extents).
 *
 * Round things — planters, columns, café tables, chairs — are circles. Desk
 * pods, meeting tables, lockers and counters are **boxes**, because a circle
 * around a rectangle is wrong in both directions at once: sized to cover the
 * long axis it seals the aisle beside the short one, and sized for the short
 * axis it leaves the ends open. A desk pod is 4.2 × 3.4 m with 0.8 m aisles
 * between pods — there is no radius that both covers the chairs and leaves
 * those aisles walkable.
 */
export interface Obstacle {
  x: number;
  z: number;
  /** Circle radius. Mutually exclusive with hw/hd. */
  r?: number;
  /** Box half-extent on X. */
  hw?: number;
  /** Box half-extent on Z. */
  hd?: number;
}

export const DOOR_HALF = 0.8;

/** Direction a seat faces: (x, z) unit vector. */
export function facing(angle: number): [number, number] {
  return [Math.sin(angle), Math.cos(angle)];
}

/** Conference hall footprint: centered on the back wall (spec-reference build). */
export function conferenceRect(room: RoomConfig): ConferenceRect {
  const w = Math.min(6.4, room.width * 0.24);
  const d = Math.min(4.2, room.length * 0.24);
  return {
    kind: 'conference',
    id: 'conference',
    label: 'CONFERENCE HALL',
    cx: 0,
    cz: -room.length / 2 + d / 2 + 0.25,
    w,
    d,
    doorSide: 1,
    // Door off-centre so no seat sits in the doorway
    doorX: w / 2 - DOOR_HALF - 0.3,
  };
}

/** Two small glass meeting rooms in the back corners + an open cafeteria in the front-right corner. */
function specialAreas(room: RoomConfig, conference: ConferenceRect): AreaRect[] {
  const { width: W, length: L } = room;
  const mw = Math.min(4.4, W * 0.16);
  const md = Math.min(3.8, L * 0.2);
  const meetingZ = -L / 2 + md / 2 + 0.25;
  const areas: AreaRect[] = [conference];
  // Only add the side rooms when the back wall has space left beside the conference hall
  if (W / 2 - conference.w / 2 > mw + 1.6) {
    areas.push({
      kind: 'meeting',
      id: 'meeting-west',
      label: 'MEETING ROOM 1',
      cx: -W / 2 + mw / 2 + 0.3,
      cz: meetingZ,
      w: mw,
      d: md,
      doorSide: 1,
      doorX: -W / 2 + 0.3 + mw - DOOR_HALF - 0.3, // door toward the office interior
    });
    areas.push({
      kind: 'meeting',
      id: 'meeting-east',
      label: 'MEETING ROOM 2',
      cx: W / 2 - mw / 2 - 0.3,
      cz: meetingZ,
      w: mw,
      d: md,
      doorSide: 1,
      doorX: W / 2 - 0.3 - mw + DOOR_HALF + 0.3,
    });
  }
  const cw = Math.min(8.6, W * 0.29);
  const cd = Math.min(4.0, L * 0.22);
  areas.push({
    kind: 'cafeteria',
    id: 'cafeteria',
    label: 'CAFETERIA',
    cx: W / 2 - cw / 2 - 0.2,
    cz: L / 2 - cd / 2 - 0.2,
    w: cw,
    d: cd,
    doorSide: -1,
    doorX: W / 2 - cw / 2 - 0.2,
  });
  return areas;
}

/** Pod footprint + aisle pitch (m). */
const POD_PITCH_X = 5.0;
const POD_PITCH_Z = 4.2;
const POD_MARGIN = 1.6;
const POD_HALF_W = 2.1;
const POD_HALF_D = 1.7;

/** Seat offsets around a pod of 4 (two facing pairs across the desk spine). */
const SEAT_OFFSETS: { dx: number; dz: number; angle: number }[] = [
  { dx: -1.0, dz: -1.15, angle: 0 }, // faces +z toward desk
  { dx: 1.0, dz: -1.15, angle: 0 },
  { dx: -1.0, dz: 1.15, angle: Math.PI },
  { dx: 1.0, dz: 1.15, angle: Math.PI },
];

function inRect(a: AreaRect, x: number, z: number, pad: number): boolean {
  return Math.abs(x - a.cx) < a.w / 2 + pad && Math.abs(z - a.cz) < a.d / 2 + pad;
}

/** Meeting-table size for a glass room (shared by layout, furniture, and seats). */
export function tableSize(a: AreaRect): { tw: number; td: number } {
  return a.kind === 'conference'
    ? { tw: Math.min(3.6, a.w - 2.8), td: Math.min(1.4, a.d - 2.8) }
    : { tw: Math.min(2.0, a.w - 2.2), td: Math.min(1.0, a.d - 2.2) };
}

/** Seats around a rectangular table centred on (cx, cz), all facing the table. */
function tableSeats(
  cx: number,
  cz: number,
  tableW: number,
  tableD: number,
  perLongSide: number,
  ends: boolean,
  kind: SeatKind,
): Seat[] {
  const out: Seat[] = [];
  const gap = 0.65; // seat centre distance from the table edge
  for (let i = 0; i < perLongSide; i++) {
    const x = cx + (perLongSide === 1 ? 0 : -tableW / 2 + 0.45 + (i * (tableW - 0.9)) / (perLongSide - 1));
    out.push({ x, z: cz - tableD / 2 - gap, angle: 0, zone: zoneAt(x, cz), kind });
    out.push({ x, z: cz + tableD / 2 + gap, angle: Math.PI, zone: zoneAt(x, cz), kind });
  }
  if (ends) {
    out.push({ x: cx - tableW / 2 - gap, z: cz, angle: Math.PI / 2, zone: zoneAt(cx, cz), kind });
    out.push({ x: cx + tableW / 2 + gap, z: cz, angle: -Math.PI / 2, zone: zoneAt(cx, cz), kind });
  }
  return out;
}

/** Glass-wall obstacle ring for an enclosed area, leaving the door gap open. */
function glassObstacles(a: AreaRect, obstacles: Obstacle[]) {
  const step = 0.6;
  for (let x = -a.w / 2; x <= a.w / 2 + 1e-6; x += step) {
    const wx = a.cx + x;
    for (const side of [1, -1] as const) {
      const wz = a.cz + (side * a.d) / 2;
      // Skip the door gap on the door face; the opposite face is the building wall anyway
      if (side === a.doorSide && Math.abs(wx - a.doorX) < DOOR_HALF) continue;
      obstacles.push({ x: wx, z: wz, r: 0.32 });
    }
  }
  for (let z = -a.d / 2; z <= a.d / 2 + 1e-6; z += step) {
    obstacles.push({ x: a.cx - a.w / 2, z: a.cz + z, r: 0.32 });
    obstacles.push({ x: a.cx + a.w / 2, z: a.cz + z, r: 0.32 });
  }
}

/** Deterministic desk/seat layout derived purely from room dimensions. */
export function buildOfficeLayout(room: RoomConfig): OfficeLayout {
  const zones = buildZones(room);
  const pods: DeskPod[] = [];
  const deskSeats = { A: [], B: [], C: [], D: [] } as Record<ZoneId, Seat[]>;
  const specialSeats = { A: [], B: [], C: [], D: [] } as Record<ZoneId, Seat[]>;
  const stands = { A: [], B: [], C: [], D: [] } as Record<ZoneId, StandSpot[]>;
  const obstacles: Obstacle[] = [];
  const conference = conferenceRect(room);
  const areas = specialAreas(room, conference);
  const blocked = (x: number, z: number, pad: number) => areas.some((a) => inRect(a, x, z, pad));
  // Pod footprint incl. chairs (±2.1 × ±1.7) + a 0.8 m walking aisle vs. every area rect
  const podBlocked = (x: number, z: number) =>
    areas.some(
      (a) => Math.abs(x - a.cx) < a.w / 2 + POD_HALF_W + 0.8 && Math.abs(z - a.cz) < a.d / 2 + POD_HALF_D + 0.8,
    );

  for (const id of ZONE_IDS) {
    const zone = zones[id];
    const usableW = zone.half[0] * 2 - POD_MARGIN * 2;
    const usableL = zone.half[1] * 2 - POD_MARGIN * 2;
    const cols = Math.max(1, Math.floor(usableW / POD_PITCH_X));
    const rows = Math.max(1, Math.floor(usableL / POD_PITCH_Z));
    const originX = zone.center[0] - ((cols - 1) * POD_PITCH_X) / 2;
    const originZ = zone.center[1] - ((rows - 1) * POD_PITCH_Z) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = originX + c * POD_PITCH_X;
        const z0 = originZ + r * POD_PITCH_Z;
        // Slide the pod toward the room centre (z = 0) until its footprint clears every area
        let placed: number | null = null;
        for (let shift = 0; shift <= 2.0 + 1e-6; shift += 0.5) {
          const z = z0 - Math.sign(z0) * shift;
          if (!podBlocked(x, z)) {
            placed = z;
            break;
          }
        }
        if (placed === null) continue;
        const z = placed;
        pods.push({ x, z, zone: id });
        // The pod footprint *including* its chairs. As a circle this had to be
        // r 1.5 to keep the 0.8 m aisles open, which left the chairs (out at
        // 1.86 m) sticking through the collider.
        // Slightly inside the nominal footprint: the collider is inflated by the
        // walker radius, and pods sit on a 5.0 x 4.2 m pitch, so using the full
        // 2.1 x 1.7 half-extents would shrink the designed 0.8 m aisles to 0.2 m
        // and make walking between desk runs feel like squeezing through a slot.
        // 2.0 x 1.6 still covers the desks (2.1) and the chairs (1.85) once
        // inflated, and leaves 0.4 m of clear aisle either side.
        obstacles.push({ x, z, hw: POD_HALF_W - 0.1, hd: POD_HALF_D - 0.1 });
        for (const s of SEAT_OFFSETS) {
          deskSeats[id].push({ x: x + s.dx, z: z + s.dz, angle: s.angle, zone: id, kind: 'desk' });
        }
      }
    }

    // Standing overflow spots scattered deterministically in the zone.
    for (let i = 0; i < 40; i++) {
      const rx = (seededRandom(i * 7 + id.charCodeAt(0) * 13) - 0.5) * 2;
      const rz = (seededRandom(i * 11 + id.charCodeAt(0) * 29) - 0.5) * 2;
      const sx = zone.center[0] + rx * (zone.half[0] - 1);
      const sz = zone.center[1] + rz * (zone.half[1] - 1);
      if (blocked(sx, sz, 0.4)) continue;
      stands[id].push({
        x: sx,
        z: sz,
        angle: seededRandom(i * 3) * Math.PI * 2,
        zone: id,
      });
    }
  }

  // Meeting seats (conference + meeting rooms) and café seats
  const cafeTables: CafeTable[] = [];
  for (const a of areas) {
    if (a.kind === 'conference') {
      const { tw, td } = tableSize(a);
      for (const s of tableSeats(a.cx, a.cz, tw, td, 3, true, 'meeting')) specialSeats[s.zone].push(s);
      obstacles.push({ x: a.cx, z: a.cz, hw: tw / 2, hd: td / 2 });
      glassObstacles(a, obstacles);
    } else if (a.kind === 'meeting') {
      const { tw, td } = tableSize(a);
      for (const s of tableSeats(a.cx, a.cz, tw, td, 2, false, 'meeting')) specialSeats[s.zone].push(s);
      obstacles.push({ x: a.cx, z: a.cz, hw: tw / 2, hd: td / 2 });
      glassObstacles(a, obstacles);
    } else {
      // Cafeteria: round tables in a row, 4 lounge chairs each
      const pitch = 2.3;
      const cols = Math.max(1, Math.floor((a.w - 1.6) / pitch));
      const rows = Math.max(1, Math.floor((a.d - 2.2) / pitch));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = a.cx - 0.5 - ((cols - 1) * pitch) / 2 + c * pitch;
          // Tables sit toward the back of the area, leaving a walkway along the front edge
          const z = a.cz - ((rows - 1) * pitch) / 2 + r * pitch + 0.4;
          cafeTables.push({ x, z, r: 0.45 });
          obstacles.push({ x, z, r: 0.95 });
          for (let k = 0; k < 4; k++) {
            const ang = (k / 4) * Math.PI * 2 + Math.PI / 4 + (r + c) * 0.35;
            // Chair sits 0.78 m out, facing the table centre
            const sx = x + Math.sin(ang) * 0.78;
            const sz = z + Math.cos(ang) * 0.78;
            specialSeats[zoneAt(sx, sz)].push({ x: sx, z: sz, angle: ang + Math.PI, zone: zoneAt(sx, sz), kind: 'cafe' });
          }
        }
      }
      // Coffee counter along the cafeteria's outer (+x) wall
      for (let z = -a.d / 2 + 0.4; z <= a.d / 2 - 0.4; z += 0.6) {
        obstacles.push({ x: a.cx + a.w / 2 - 0.45, z: a.cz + z, r: 0.45 });
      }
    }
  }

  // Chairs around the meeting and café tables. The tables were already
  // obstacles but their chairs were not, so you could walk straight through the
  // seating and end up standing inside a meeting. The chair centre sits 0.42 m
  // behind its seat point, along the sitter's facing (never assume 0/π).
  for (const id of ZONE_IDS) {
    for (const s of specialSeats[id]) {
      obstacles.push({
        x: s.x - Math.sin(s.angle) * 0.42,
        z: s.z - Math.cos(s.angle) * 0.42,
        r: 0.34,
      });
    }
  }

  // Floor planters ("trees"). Derived here rather than in InteriorDecor so the
  // decor and the character collider cannot drift apart — a planter you can
  // walk through is one that was only ever a mesh.
  const WALL_FACE = 0.1; // building walls are 0.18 m boxes centred on the boundary
  const featureHalf = 3.2; // half-width of the left-wall feature panel (WallTvs)
  const tvZ = 0.5;
  const plx = -room.width / 2 + WALL_FACE + 0.47;
  const cafeArea = areas.find((a) => a.kind === 'cafeteria');
  const planters: { x: number; z: number }[] = [
    { x: -1.9, z: room.length / 2 - 0.7 },
    { x: 1.9, z: room.length / 2 - 0.7 },
    { x: plx, z: tvZ - featureHalf + 0.3 },
    { x: plx, z: tvZ + featureHalf - 0.3 },
  ];
  if (cafeArea) planters.push({ x: cafeArea.cx - cafeArea.w / 2 - 0.45, z: cafeArea.cz + cafeArea.d / 2 - 0.4 });
  for (const p of planters) obstacles.push({ x: p.x, z: p.z, r: 0.42 });

  // Storage lockers along the west wall (0.45 x 1.2 m boxes, backs to the wall).
  for (const lz of [room.length / 4, room.length / 4 + 1.3, -room.length / 4]) {
    obstacles.push({ x: -room.width / 2 + 0.32, z: lz, hw: 0.225, hd: 0.6 });
  }

  // Structural columns on the zone boundary, between the desk rows (clear of the aisles)
  const columns = [
    { x: -room.width / 4, z: -0.9 },
    { x: room.width / 4, z: -0.9 },
  ].filter((c) => !blocked(c.x, c.z, 0.6) && !pods.some((p) => Math.abs(p.x - c.x) < 2.3 && Math.abs(p.z - c.z) < 2.0));
  for (const c of columns) obstacles.push({ x: c.x, z: c.z, r: 0.4 });

  // Fill order per zone: two desk seats, then meeting/café seats, then the rest —
  // so default occupancy already shows full meetings and a busy cafeteria.
  const seats = { A: [], B: [], C: [], D: [] } as Record<ZoneId, Seat[]>;
  for (const id of ZONE_IDS) {
    seats[id] = [...deskSeats[id].slice(0, 2), ...specialSeats[id], ...deskSeats[id].slice(2)];
  }

  return { pods, seats, stands, obstacles, conference, areas, cafeTables, columns, planters };
}
