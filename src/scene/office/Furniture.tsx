import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { engine } from '../../simulation/engine';
import { seededRandom } from '../../utils/math';
import { characterTransient } from '../../state/characterStore';
import { useSimStore } from '../../state/simStore';
import { ZONE_IDS } from '../../simulation/zones';
import { buildOfficeLayout, facing, type OfficeLayout, type Seat } from './officeLayout';
import { SCREEN_KINDS, useScreenTextures, type ScreenKind } from './screenContent';

const tmpObj = new THREE.Object3D();

/** Which content a seat's screens show — round-robin so every pod mixes code / AI / security. */
export function screenKindFor(i: number): ScreenKind {
  return SCREEN_KINDS[i % SCREEN_KINDS.length];
}

/**
 * Per-kind instanced screen planes. `place(i, obj)` writes seat i's screen
 * transform into `obj`; seats are bucketed by screenKindFor(i).
 */
function ScreenPlanes({
  count,
  size,
  place,
}: {
  count: number;
  size: [number, number];
  place: (i: number, obj: THREE.Object3D) => void;
}) {
  const textures = useScreenTextures();
  const refs = useRef<Record<ScreenKind, THREE.InstancedMesh | null>>({ code: null, ai: null, security: null });

  useLayoutEffect(() => {
    const n: Record<ScreenKind, number> = { code: 0, ai: 0, security: 0 };
    for (let i = 0; i < count; i++) {
      const k = screenKindFor(i);
      const mesh = refs.current[k];
      if (!mesh) continue;
      place(i, tmpObj);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(n[k]++, tmpObj.matrix);
    }
    for (const k of SCREEN_KINDS) {
      const mesh = refs.current[k];
      if (!mesh) continue;
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [count, place]);

  const cap = Math.max(1, Math.ceil(count / SCREEN_KINDS.length) + 1);
  return (
    <>
      {SCREEN_KINDS.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            refs.current[k] = m;
          }}
          args={[undefined, undefined, cap]}
        >
          <planeGeometry args={size} />
          <meshBasicMaterial map={textures[k]} toneMapped={false} />
        </instancedMesh>
      ))}
    </>
  );
}

export function seatsFlatOf(layout: OfficeLayout): Seat[] {
  return [...layout.seats.A, ...layout.seats.B, ...layout.seats.C, ...layout.seats.D];
}

/** Only the workstation seats (the ones that get monitors/keyboards). */
export function deskSeatsOf(layout: OfficeLayout): Seat[] {
  return seatsFlatOf(layout).filter((s) => s.kind === 'desk');
}

/**
 * Write key `k`'s transform on seat `s`'s laptop into `obj`. Keys live on the
 * far half of the base (toward the hinge); k = KEY_COLS*KEY_ROWS is the
 * spacebar. `depress` sinks the cap (0 = up).
 */
function placeKey(s: Seat, k: number, depress: number, obj: THREE.Object3D): void {
  const [fx, fz] = facing(s.angle);
  const f = s.kind === 'desk' ? 0.36 : 0.92;
  const y = s.kind === 'desk' ? 0.77 : 0.775;
  // Laptop-local axes: fwd = away from the sitter (toward the hinge), side = across the base
  const sx = fz;
  const sz = -fx;
  let across = 0;
  let fwd = 0;
  let scaleX = 1;
  if (k < KEY_COLS * KEY_ROWS) {
    const row = Math.floor(k / KEY_COLS); // 0 = nearest the hinge
    const col = k % KEY_COLS;
    across = (col - (KEY_COLS - 1) / 2) * 0.0275;
    fwd = 0.062 - row * 0.028;
    // Stagger alternate rows slightly, like a real board
    if (row === 1) across += 0.006;
    if (row === 2) across -= 0.005;
  } else {
    // Spacebar: wide cap on the row nearest the sitter
    across = 0;
    fwd = 0.062 - KEY_ROWS * 0.028;
    scaleX = 4.2;
  }
  obj.position.set(s.x + fx * (f + fwd) + sx * across, y + 0.012 - depress, s.z + fz * (f + fwd) + sz * across);
  obj.rotation.set(0, s.angle, 0);
  obj.scale.set(scaleX, 1, 1);
}

/** Real keyboard: 3 keycap rows + spacebar per laptop, animated press/release. */
const KEY_COLS = 10;
const KEY_ROWS = 3;
/** Keys per laptop (grid + spacebar). */
const KEYS_PER = KEY_COLS * KEY_ROWS + 1;
/** How far a pressed key sinks (m). */
const KEY_TRAVEL = 0.0045;
/** Beyond this camera distance the keys stay static (matches the crowd's anim LOD). */
const KEY_ANIM_DIST = 14;

/** Open laptop (base, tilted lid, lit screen, animated keyboard) at every desk and meeting seat — shared by both render modes. */
export function Laptops({ layout }: { layout: OfficeLayout }) {
  const seats = useMemo(() => seatsFlatOf(layout).filter((s) => s.kind !== 'cafe'), [layout]);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const lidRef = useRef<THREE.InstancedMesh>(null);
  const keysRef = useRef<THREE.InstancedMesh>(null);
  const padRef = useRef<THREE.InstancedMesh>(null);
  /** 1 while a laptop's keys were animated last frame (so they get parked once on exit). */
  const wasLive = useRef<Uint8Array>(new Uint8Array(0));
  /** Seat → (zone, per-zone index) so occupancy can be checked live against engine params. */
  const occIndex = useMemo(() => {
    const m = new Map<Seat, { zone: (typeof ZONE_IDS)[number]; idx: number }>();
    for (const z of ZONE_IDS) layout.seats[z].forEach((seat, idx) => m.set(seat, { zone: z, idx }));
    return m;
  }, [layout]);

  useLayoutEffect(() => {
    const base = baseRef.current;
    const lid = lidRef.current;
    if (!base || !lid) return;
    seats.forEach((s, i) => {
      const [fx, fz] = facing(s.angle);
      // Desk seats: laptop on the desk in front of the sitter; meeting seats: on the table past its edge
      const f = s.kind === 'desk' ? 0.36 : 0.92;
      const y = s.kind === 'desk' ? 0.77 : 0.775;
      tmpObj.position.set(s.x + fx * f, y, s.z + fz * f);
      tmpObj.rotation.set(0, s.angle, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      base.setMatrixAt(i, tmpObj.matrix);
      // Lid hinged at the far edge, leaning away from the sitter by ~105°
      tmpObj.position.set(s.x + fx * (f + 0.1), y + 0.1, s.z + fz * (f + 0.1));
      tmpObj.rotation.set(-0.26, s.angle, 0, 'YXZ');
      tmpObj.updateMatrix();
      lid.setMatrixAt(i, tmpObj.matrix);
    });
    for (const m of [base, lid]) {
      m.count = seats.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
    // Keyboard: park every key in the up state, and place one touchpad per laptop
    const keys = keysRef.current;
    const pad = padRef.current;
    if (keys) {
      seats.forEach((s, i) => {
        for (let k = 0; k < KEYS_PER; k++) {
          placeKey(s, k, 0, tmpObj);
          tmpObj.updateMatrix();
          keys.setMatrixAt(i * KEYS_PER + k, tmpObj.matrix);
        }
      });
      keys.count = seats.length * KEYS_PER;
      keys.instanceMatrix.needsUpdate = true;
      keys.computeBoundingSphere();
    }
    if (pad) {
      seats.forEach((s, i) => {
        const [fx, fz] = facing(s.angle);
        const f = s.kind === 'desk' ? 0.36 : 0.92;
        const y = s.kind === 'desk' ? 0.77 : 0.775;
        // Touchpad on the near half of the base, toward the sitter
        tmpObj.position.set(s.x + fx * (f - 0.075), y + 0.0095, s.z + fz * (f - 0.075));
        tmpObj.rotation.set(0, s.angle, 0);
        tmpObj.scale.set(1, 1, 1);
        tmpObj.updateMatrix();
        pad.setMatrixAt(i, tmpObj.matrix);
      });
      pad.count = seats.length;
      pad.instanceMatrix.needsUpdate = true;
      pad.computeBoundingSphere();
    }
    wasLive.current = new Uint8Array(seats.length);
  }, [seats]);

  // Animated typing: on occupied laptops near the camera, keys press and
  // release in quick random strokes (with the same "thinking" pauses as the
  // sitters' hands). Everything else stays parked — zero matrix churn.
  useFrame((state) => {
    const keys = keysRef.current;
    if (!keys) return;
    const t = state.clock.elapsedTime;
    const cam = state.camera.position;
    const perZone = engine.params.peoplePerZone;
    const live = wasLive.current;
    let dirty = false;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      const near = (cam.x - s.x) * (cam.x - s.x) + (cam.z - s.z) * (cam.z - s.z) < KEY_ANIM_DIST * KEY_ANIM_DIST;
      const o = occIndex.get(s);
      const ps = characterTransient.seat;
      const occupied = (o !== undefined && o.idx < perZone[o.zone]) || (!!ps && ps.x === s.x && ps.z === s.z);
      const animate = near && occupied;
      if (!animate) {
        if (live[i]) {
          // Left range / seat emptied: park the keys once
          for (let k = 0; k < KEYS_PER; k++) {
            placeKey(s, k, 0, tmpObj);
            tmpObj.updateMatrix();
            keys.setMatrixAt(i * KEYS_PER + k, tmpObj.matrix);
          }
          live[i] = 0;
          dirty = true;
        }
        continue;
      }
      live[i] = 1;
      const phase = seededRandom(i * 37 + 11) * Math.PI * 2;
      const burst = Math.sin(t * 0.45 + phase) > -0.35 ? 1 : 0;
      for (let k = 0; k < KEYS_PER; k++) {
        // Each key strikes on its own cycle; ^6 keeps it up except a quick dip
        const h = seededRandom(i * 131 + k * 7 + 3);
        const wave = Math.sin(t * (6 + h * 5) + h * Math.PI * 2);
        const press = burst * Math.pow(Math.max(0, wave), 6);
        placeKey(s, k, press * KEY_TRAVEL, tmpObj);
        tmpObj.updateMatrix();
        keys.setMatrixAt(i * KEYS_PER + k, tmpObj.matrix);
      }
      dirty = true;
    }
    if (dirty) keys.instanceMatrix.needsUpdate = true;
  });

  const placeLaptopScreen = useMemo(
    () => (i: number, obj: THREE.Object3D) => {
      const s = seats[i];
      const [fx, fz] = facing(s.angle);
      const f = s.kind === 'desk' ? 0.36 : 0.92;
      const y = s.kind === 'desk' ? 0.77 : 0.775;
      // Lid centre, pushed 7 mm along the lid normal toward the sitter
      const tilt = 0.26;
      const nx = -fx * Math.cos(tilt), ny = -Math.sin(tilt), nz = -fz * Math.cos(tilt);
      obj.position.set(s.x + fx * (f + 0.1) + nx * 0.007, y + 0.1 + ny * 0.007, s.z + fz * (f + 0.1) + nz * 0.007);
      obj.rotation.set(tilt, s.angle + Math.PI, 0, 'YXZ');
      obj.scale.set(1, 1, 1);
    },
    [seats],
  );

  return (
    <group>
      <instancedMesh ref={baseRef} args={[undefined, undefined, Math.max(1, seats.length)]} castShadow>
        <boxGeometry args={[0.32, 0.016, 0.22]} />
        <meshStandardMaterial color="#9a9ea6" roughness={0.35} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={lidRef} args={[undefined, undefined, Math.max(1, seats.length)]} castShadow>
        <boxGeometry args={[0.32, 0.21, 0.01]} />
        <meshStandardMaterial color="#8d9198" roughness={0.35} metalness={0.6} />
      </instancedMesh>
      {/* Keycaps — one instanced mesh for every key of every laptop */}
      <instancedMesh ref={keysRef} args={[undefined, undefined, Math.max(1, seats.length * KEYS_PER)]} frustumCulled={false}>
        <boxGeometry args={[0.022, 0.007, 0.022]} />
        <meshStandardMaterial color="#23262b" roughness={0.6} metalness={0.15} />
      </instancedMesh>
      {/* Touchpads */}
      <instancedMesh ref={padRef} args={[undefined, undefined, Math.max(1, seats.length)]}>
        <boxGeometry args={[0.085, 0.002, 0.055]} />
        <meshStandardMaterial color="#7d8188" roughness={0.3} metalness={0.5} />
      </instancedMesh>
      {/* Lit screen on the lid's sitter-facing face, showing code / AI / security content */}
      <ScreenPlanes count={seats.length} size={[0.29, 0.18]} place={placeLaptopScreen} />
    </group>
  );
}

/** External monitors (with stands) behind the laptop at every desk seat — shared by both render modes. */
export function Monitors({ layout }: { layout: OfficeLayout }) {
  const seatsFlat = useMemo(() => deskSeatsOf(layout), [layout]);
  const monitorRef = useRef<THREE.InstancedMesh>(null);
  const standRef = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const monitor = monitorRef.current;
    const stand = standRef.current;
    const base = baseRef.current;
    if (!monitor || !stand || !base) return;

    seatsFlat.forEach((s, i) => {
      const [fx, fz] = facing(s.angle);
      const rotY = s.angle + Math.PI;

      tmpObj.position.set(s.x + fx * 0.62, 1.0, s.z + fz * 0.62);
      tmpObj.rotation.set(0, rotY, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      monitor.setMatrixAt(i, tmpObj.matrix);

      // Stand neck + base plate connecting monitor to desktop
      tmpObj.position.set(s.x + fx * 0.64, 0.855, s.z + fz * 0.64);
      tmpObj.updateMatrix();
      stand.setMatrixAt(i, tmpObj.matrix);
      tmpObj.position.set(s.x + fx * 0.64, 0.775, s.z + fz * 0.64);
      tmpObj.updateMatrix();
      base.setMatrixAt(i, tmpObj.matrix);
    });
    for (const m of [monitor, stand, base]) {
      m.count = seatsFlat.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [seatsFlat]);

  const placeMonitorScreen = useMemo(
    () => (i: number, obj: THREE.Object3D) => {
      const s = seatsFlat[i];
      const [fx, fz] = facing(s.angle);
      // Just in front of the monitor body's sitter-facing face
      obj.position.set(s.x + fx * 0.6, 1.0, s.z + fz * 0.6);
      obj.rotation.set(0, s.angle + Math.PI, 0);
      obj.scale.set(1, 1, 1);
    },
    [seatsFlat],
  );

  return (
    <group>
      <instancedMesh ref={monitorRef} args={[undefined, undefined, Math.max(1, seatsFlat.length)]}>
        <boxGeometry args={[0.62, 0.38, 0.035]} />
        <meshStandardMaterial color="#0a1220" roughness={0.4} metalness={0.5} />
      </instancedMesh>
      {/* Screen content: code editor / AI dashboard / security SOC */}
      <ScreenPlanes count={seatsFlat.length} size={[0.56, 0.32]} place={placeMonitorScreen} />
      <instancedMesh ref={standRef} args={[undefined, undefined, Math.max(1, seatsFlat.length)]}>
        <boxGeometry args={[0.05, 0.14, 0.04]} />
        <meshStandardMaterial color="#3a4456" roughness={0.5} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[undefined, undefined, Math.max(1, seatsFlat.length)]}>
        <boxGeometry args={[0.18, 0.015, 0.13]} />
        <meshStandardMaterial color="#3a4456" roughness={0.5} metalness={0.6} />
      </instancedMesh>
      <Laptops layout={layout} />
    </group>
  );
}

/** Stylized (procedural) desks and chairs. */
export function Furniture({ layout }: { layout: OfficeLayout }) {
  // Café seats get lounge chairs from <Cafeteria>, rendered in both modes
  const seatsFlat = useMemo(() => seatsFlatOf(layout).filter((s) => s.kind !== 'cafe'), [layout]);
  const pods = layout.pods;

  const deskRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const seatRef = useRef<THREE.InstancedMesh>(null);
  const backRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const desk = deskRef.current;
    const leg = legRef.current;
    const seat = seatRef.current;
    const back = backRef.current;
    if (!desk || !leg || !seat || !back) return;

    pods.forEach((pod, i) => {
      tmpObj.position.set(pod.x, 0.74, pod.z);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      desk.setMatrixAt(i, tmpObj.matrix);

      const legOffsets: [number, number][] = [
        [-1.7, -0.7],
        [1.7, -0.7],
        [-1.7, 0.7],
        [1.7, 0.7],
      ];
      legOffsets.forEach(([dx, dz], j) => {
        tmpObj.position.set(pod.x + dx, 0.37, pod.z + dz);
        tmpObj.updateMatrix();
        leg.setMatrixAt(i * 4 + j, tmpObj.matrix);
      });
    });

    seatsFlat.forEach((s, i) => {
      const [fx, fz] = facing(s.angle);
      tmpObj.position.set(s.x - fx * 0.35, 0.45, s.z - fz * 0.35);
      tmpObj.rotation.set(0, s.angle, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      seat.setMatrixAt(i, tmpObj.matrix);

      tmpObj.position.set(s.x - fx * 0.61, 0.78, s.z - fz * 0.61);
      tmpObj.updateMatrix();
      back.setMatrixAt(i, tmpObj.matrix);
    });

    for (const m of [desk, leg, seat, back]) {
      m.count = m === desk ? pods.length : m === leg ? pods.length * 4 : seatsFlat.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [pods, seatsFlat]);

  return (
    <group>
      <instancedMesh ref={deskRef} args={[undefined, undefined, pods.length]} castShadow receiveShadow>
        <boxGeometry args={[3.7, 0.06, 1.7]} />
        <meshStandardMaterial color="#31507e" roughness={0.55} metalness={0.25} />
      </instancedMesh>
      <instancedMesh ref={legRef} args={[undefined, undefined, pods.length * 4]}>
        <boxGeometry args={[0.07, 0.74, 0.07]} />
        <meshStandardMaterial color="#101a2c" roughness={0.6} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={seatRef} args={[undefined, undefined, seatsFlat.length]} castShadow>
        <boxGeometry args={[0.48, 0.08, 0.48]} />
        <meshStandardMaterial color="#28406a" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={backRef} args={[undefined, undefined, seatsFlat.length]}>
        <boxGeometry args={[0.46, 0.55, 0.07]} />
        <meshStandardMaterial color="#28406a" roughness={0.7} />
      </instancedMesh>
      <Monitors layout={layout} />
    </group>
  );
}

/** Hook: memoized layout for the current room dims (shared by several components). */
export function useOfficeLayout(): OfficeLayout {
  const room = useSimStore((s) => s.params.room);
  return useMemo(() => buildOfficeLayout(room), [room]);
}
