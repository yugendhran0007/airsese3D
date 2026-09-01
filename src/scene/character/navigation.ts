/**
 * Walkable-area navigation for the player character (spec §20 — walkable office).
 *
 * Collision alone is not navigation. Pushing a walker out of whatever it has
 * just entered stops it against the obstacle, and if the destination lies
 * straight beyond a desk run there is no sideways input to slide with, so it
 * simply stands there pressed against the desk. Circles hid this — the push-out
 * direction rotates around a circle, which slides you off it by accident — but
 * an axis-aligned face has no such luck, and the walker sticks.
 *
 * So click-to-walk plans a route instead. The office is rasterised once into a
 * coarse walkability grid (obstacles inflated by the walker's radius, so the
 * *body* fits, not just its centre), A* finds a cell path, and the path is then
 * pulled straight again with a line-of-sight pass so the walker takes the
 * natural diagonal across a room rather than a staircase of grid steps.
 *
 * Keyboard movement stays direct and is handled by the collider — you are
 * steering yourself there, and pathfinding your own WASD would feel like the
 * controls fighting you.
 */
import type { Obstacle, OfficeLayout } from '../office/officeLayout';

/** Grid resolution. 0.25 m keeps a 30 x 20 m office at 120 x 80 cells. */
const CELL = 0.25;
/** Clearance kept from the room's own walls. */
const WALL_MARGIN = 0.5;

export interface NavGrid {
  w: number;
  h: number;
  ox: number;
  oz: number;
  /** 1 = blocked. */
  blocked: Uint8Array;
}

function hits(ob: Obstacle, x: number, z: number, pad: number): boolean {
  if (ob.r !== undefined) {
    const r = ob.r + pad;
    const dx = x - ob.x;
    const dz = z - ob.z;
    return dx * dx + dz * dz < r * r;
  }
  if (ob.hw !== undefined && ob.hd !== undefined) {
    return Math.abs(x - ob.x) < ob.hw + pad && Math.abs(z - ob.z) < ob.hd + pad;
  }
  return false;
}

/**
 * Rasterise the office into walkable cells.
 *
 * `pad` is the walker's radius: inflating here rather than at query time means
 * a planned route already has room for the body, and the collider never has to
 * argue with the path.
 */
export function buildNavGrid(layout: OfficeLayout, roomW: number, roomL: number, pad: number): NavGrid {
  const ox = -roomW / 2;
  const oz = -roomL / 2;
  const w = Math.ceil(roomW / CELL);
  const h = Math.ceil(roomL / CELL);
  const blocked = new Uint8Array(w * h);
  const limX = roomW / 2 - WALL_MARGIN;
  const limZ = roomL / 2 - WALL_MARGIN;

  for (let j = 0; j < h; j++) {
    const z = oz + (j + 0.5) * CELL;
    for (let i = 0; i < w; i++) {
      const x = ox + (i + 0.5) * CELL;
      if (Math.abs(x) > limX || Math.abs(z) > limZ) {
        blocked[j * w + i] = 1;
        continue;
      }
      for (const ob of layout.obstacles) {
        if (hits(ob, x, z, pad)) {
          blocked[j * w + i] = 1;
          break;
        }
      }
    }
  }
  return { w, h, ox, oz, blocked };
}

const idx = (g: NavGrid, i: number, j: number) => j * g.w + i;
const free = (g: NavGrid, i: number, j: number) =>
  i >= 0 && j >= 0 && i < g.w && j < g.h && g.blocked[idx(g, i, j)] === 0;

function toCell(g: NavGrid, x: number, z: number): [number, number] {
  return [
    Math.min(g.w - 1, Math.max(0, Math.floor((x - g.ox) / CELL))),
    Math.min(g.h - 1, Math.max(0, Math.floor((z - g.oz) / CELL))),
  ];
}
const cellX = (g: NavGrid, i: number) => g.ox + (i + 0.5) * CELL;
const cellZ = (g: NavGrid, j: number) => g.oz + (j + 0.5) * CELL;

/**
 * Nearest walkable cell by ring search.
 *
 * Both ends of a route need this: you can click a desk (blocked), and you can
 * be standing inside an obstacle already — seated at your own desk, which is
 * well inside the pod footprint.
 */
function nearestFree(g: NavGrid, i0: number, j0: number, maxRings = 40): [number, number] | null {
  if (free(g, i0, j0)) return [i0, j0];
  for (let r = 1; r <= maxRings; r++) {
    for (let d = -r; d <= r; d++) {
      const cand: [number, number][] = [
        [i0 + d, j0 - r],
        [i0 + d, j0 + r],
        [i0 - r, j0 + d],
        [i0 + r, j0 + d],
      ];
      for (const [i, j] of cand) if (free(g, i, j)) return [i, j];
    }
  }
  return null;
}

/** True if a straight line between two world points stays walkable. */
function clearLine(g: NavGrid, ax: number, az: number, bx: number, bz: number): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(dist / (CELL * 0.5));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const [i, j] = toCell(g, ax + (bx - ax) * t, az + (bz - az) * t);
    if (!free(g, i, j)) return false;
  }
  return true;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * A* from `from` to `to`, returned as world-space waypoints.
 *
 * Returns `null` when there is no route at all; returns a route to the closest
 * reachable point when the destination itself is unreachable, because walking
 * as far as you can is friendlier than refusing to move.
 */
export function findPath(
  g: NavGrid,
  from: { x: number; z: number },
  to: { x: number; z: number },
): { x: number; z: number }[] | null {
  const s = nearestFree(g, ...toCell(g, from.x, from.z));
  const t = nearestFree(g, ...toCell(g, to.x, to.z));
  if (!s || !t) return null;
  const [si, sj] = s;
  const [ti, tj] = t;
  if (si === ti && sj === tj) return [{ x: to.x, z: to.z }];

  const n = g.w * g.h;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const open: number[] = [];
  const inOpen = new Uint8Array(n);
  const start = idx(g, si, sj);
  const goal = idx(g, ti, tj);
  const heur = (i: number, j: number) => Math.hypot(i - ti, j - tj);

  gScore[start] = 0;
  open.push(start);
  inOpen[start] = 1;
  let best = start;
  let bestH = heur(si, sj);

  while (open.length) {
    // Small maps — a linear scan for the lowest f beats maintaining a heap.
    let bi = 0;
    let bf = Infinity;
    for (let k = 0; k < open.length; k++) {
      const c = open[k];
      const f = gScore[c] + heur(c % g.w, (c / g.w) | 0);
      if (f < bf) {
        bf = f;
        bi = k;
      }
    }
    const cur = open[bi];
    open.splice(bi, 1);
    inOpen[cur] = 0;
    if (cur === goal) {
      best = goal;
      break;
    }
    const ci = cur % g.w;
    const cj = (cur / g.w) | 0;
    const ch = heur(ci, cj);
    if (ch < bestH) {
      bestH = ch;
      best = cur;
    }
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (!free(g, ni, nj)) continue;
      // No corner-cutting: a diagonal needs both orthogonal neighbours open, or
      // the walker clips the corner of a desk on the way past.
      if (di !== 0 && dj !== 0 && (!free(g, ci + di, cj) || !free(g, ci, cj + dj))) continue;
      const ni2 = idx(g, ni, nj);
      const tentative = gScore[cur] + cost;
      if (tentative < gScore[ni2]) {
        gScore[ni2] = tentative;
        came[ni2] = cur;
        if (!inOpen[ni2]) {
          open.push(ni2);
          inOpen[ni2] = 1;
        }
      }
    }
  }

  if (came[best] === -1 && best !== start) return null;
  const cells: number[] = [];
  for (let c: number = best; c !== -1; c = came[c]) {
    cells.push(c);
    if (c === start) break;
  }
  cells.reverse();

  // String-pulling: keep only the waypoints the walker actually has to turn at,
  // so it crosses a room on one clean diagonal instead of a grid staircase.
  const pts = cells.map((c) => ({ x: cellX(g, c % g.w), z: cellZ(g, (c / g.w) | 0) }));
  if (best === goal) pts.push({ x: to.x, z: to.z });
  const out: { x: number; z: number }[] = [];
  let anchorX = from.x;
  let anchorZ = from.z;
  for (let k = 0; k < pts.length; k++) {
    const next = pts[k + 1];
    if (next && clearLine(g, anchorX, anchorZ, next.x, next.z)) continue;
    out.push(pts[k]);
    anchorX = pts[k].x;
    anchorZ = pts[k].z;
  }
  return out.length ? out : [{ x: to.x, z: to.z }];
}
