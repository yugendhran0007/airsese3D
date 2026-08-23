import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useSimStore } from '../../state/simStore';
import { seatsFlatOf, Monitors } from './Furniture';
import { useUiStore } from '../../state/uiStore';
import { OFFICE_THEMES } from '../../config/officeThemes';
import { facing, tableSize, type OfficeLayout, type Seat } from './officeLayout';

const tmpObj = new THREE.Object3D();

export const MODEL = (name: string) => `/models/furniture/${name}.gltf`;

/** First mesh (geometry + material) of a KayKit gltf scene. */
function firstMesh(scene: THREE.Object3D): THREE.Mesh {
  let found: THREE.Mesh | null = null;
  scene.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  if (!found) throw new Error('No mesh in gltf');
  return found;
}

export interface InstanceTransform {
  position: [number, number, number];
  rotationY: number;
  scale: number | [number, number, number];
}

/** Instanced copies of one KayKit model. */
export function GltfInstances({ url, transforms }: { url: string; transforms: InstanceTransform[] }) {
  const { scene } = useGLTF(url);
  const mesh = useMemo(() => firstMesh(scene), [scene]);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    transforms.forEach((t, i) => {
      tmpObj.position.set(...t.position);
      tmpObj.rotation.set(0, t.rotationY, 0);
      if (Array.isArray(t.scale)) tmpObj.scale.set(...t.scale);
      else tmpObj.scale.setScalar(t.scale);
      tmpObj.updateMatrix();
      inst.setMatrixAt(i, tmpObj.matrix);
    });
    inst.count = transforms.length;
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [transforms]);

  return (
    <instancedMesh
      ref={ref}
      args={[mesh.geometry, mesh.material, Math.max(1, transforms.length)]}
      castShadow
      receiveShadow
    />
  );
}

/** A rigid part placed many times: position, Y rotation, optional X tilt and scale. */
export interface Part {
  p: [number, number, number];
  ry: number;
  rx?: number;
  rz?: number;
  s?: [number, number, number];
}

/** Instanced procedural part — children are one geometry + one material. */
export function Instanced({
  parts,
  children,
  shadow = true,
}: {
  parts: Part[];
  children: ReactNode;
  shadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    parts.forEach((t, i) => {
      tmpObj.position.set(...t.p);
      tmpObj.rotation.set(t.rx ?? 0, t.ry, t.rz ?? 0, 'YXZ');
      if (t.s) tmpObj.scale.set(...t.s);
      else tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      inst.setMatrixAt(i, tmpObj.matrix);
    });
    inst.count = parts.length;
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [parts]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(1, parts.length)]}
      castShadow={shadow}
      receiveShadow={shadow}
    >
      {children}
    </instancedMesh>
  );
}

/** World-space helper: point at `seat` + forward·f + right·r, at height y. */
function at(seat: { x: number; z: number; angle: number }, f: number, r: number, y: number): [number, number, number] {
  const [fx, fz] = facing(seat.angle);
  // right-hand vector for a Y rotation: (cos, -sin) in (x, z)
  const rx = fz;
  const rz = -fx;
  return [seat.x + fx * f + rx * r, y, seat.z + fz * f + rz * r];
}

// Palette matched to the reference photo: white desks, grey fabric screens,
// beige pedestals, black mesh task chairs, grey carpet, teal lounge chairs.
export const WHITE = '#f4f5f7';
const useTheme = () => OFFICE_THEMES[useUiStore((s) => s.officeTheme)];
const CHAIR_BLACK = '#15161a';
const CHAIR_MESH = '#2a2d33';
const CHROME = '#b9bec6';
export const TEAL = '#1f5f6b';
const CAFE_WOOD = '#4a3426';

/** Black mesh task chair (seat, mesh back, arms, gas lift, 5-star base) at every seat. */
function TaskChairs({ seats }: { seats: Seat[] }) {
  const parts = useMemo(() => {
    const cushion: Part[] = [];
    const back: Part[] = [];
    const arm: Part[] = [];
    const post: Part[] = [];
    const lift: Part[] = [];
    const spoke: Part[] = [];
    const wheel: Part[] = [];
    for (const s of seats) {
      const c = { x: s.x, z: s.z, angle: s.angle };
      const off = -0.42; // chair centre sits behind the seat point
      cushion.push({ p: at(c, off, 0, 0.47), ry: s.angle });
      back.push({ p: at(c, off - 0.22, 0, 0.84), ry: s.angle, rx: -0.12 });
      for (const side of [-1, 1]) {
        arm.push({ p: at(c, off, side * 0.27, 0.69), ry: s.angle });
        post.push({ p: at(c, off - 0.05, side * 0.27, 0.58), ry: s.angle });
      }
      lift.push({ p: at(c, off, 0, 0.27), ry: s.angle });
      for (let i = 0; i < 5; i++) {
        const a = s.angle + (i * Math.PI * 2) / 5;
        spoke.push({ p: at(c, off, 0, 0.05), ry: a });
        const [fx, fz] = facing(a);
        const base = at(c, off, 0, 0.03);
        wheel.push({ p: [base[0] + fx * 0.3, 0.03, base[2] + fz * 0.3], ry: a });
      }
    }
    return { cushion, back, arm, post, lift, spoke, wheel };
  }, [seats]);

  return (
    <group>
      <Instanced parts={parts.cushion}>
        <boxGeometry args={[0.48, 0.08, 0.46]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.85} />
      </Instanced>
      <Instanced parts={parts.back}>
        <boxGeometry args={[0.46, 0.58, 0.05]} />
        <meshStandardMaterial color={CHAIR_MESH} roughness={0.9} />
      </Instanced>
      <Instanced parts={parts.arm} shadow={false}>
        <boxGeometry args={[0.06, 0.03, 0.3]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.6} />
      </Instanced>
      <Instanced parts={parts.post} shadow={false}>
        <boxGeometry args={[0.03, 0.22, 0.03]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.6} />
      </Instanced>
      <Instanced parts={parts.lift} shadow={false}>
        <cylinderGeometry args={[0.025, 0.035, 0.4, 8]} />
        <meshStandardMaterial color={CHROME} roughness={0.3} metalness={0.8} />
      </Instanced>
      <Instanced parts={parts.spoke} shadow={false}>
        <boxGeometry args={[0.05, 0.025, 0.32]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.5} metalness={0.3} />
      </Instanced>
      <Instanced parts={parts.wheel} shadow={false}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#202226" roughness={0.5} />
      </Instanced>
    </group>
  );
}

/** White bench desks with grey privacy screens and beige pedestals. */
function WorkDesks({ layout }: { layout: OfficeLayout }) {
  const theme = useTheme();
  const parts = useMemo(() => {
    const top: Part[] = [];
    const leg: Part[] = [];
    const screen: Part[] = [];
    const rail: Part[] = [];
    const pedestal: Part[] = [];
    const drawerLine: Part[] = [];
    for (const pod of layout.pods) {
      for (const side of [-1, 1]) {
        // One continuous desktop per pod side (two seats), 0.8 m deep
        top.push({ p: [pod.x, 0.74, pod.z + side * 0.45], ry: 0 });
        // A-frame style end legs + a shared centre leg
        for (const lx of [-1.95, 0, 1.95]) {
          leg.push({ p: [pod.x + lx, 0.36, pod.z + side * 0.45], ry: 0 });
        }
      }
      // Grey fabric screen along the desk spine with a white top rail
      screen.push({ p: [pod.x, 0.98, pod.z], ry: 0 });
      rail.push({ p: [pod.x, 1.22, pod.z], ry: 0 });
    }
    for (const s of seatsFlatOf(layout)) {
      if (s.kind !== 'desk') continue;
      const c = { x: s.x, z: s.z, angle: s.angle };
      pedestal.push({ p: at(c, 0.45, 0.62, 0.3), ry: s.angle });
      for (const y of [0.2, 0.42]) drawerLine.push({ p: at(c, 0.14, 0.62, y), ry: s.angle });
    }
    return { top, leg, screen, rail, pedestal, drawerLine };
  }, [layout]);

  return (
    <group>
      <Instanced parts={parts.top}>
        <boxGeometry args={[4.0, 0.04, 0.8]} />
        <meshStandardMaterial color={WHITE} roughness={0.35} metalness={0.02} />
      </Instanced>
      <Instanced parts={parts.leg}>
        <boxGeometry args={[0.06, 0.72, 0.62]} />
        <meshStandardMaterial color={WHITE} roughness={0.4} metalness={0.1} />
      </Instanced>
      <Instanced parts={parts.screen}>
        <boxGeometry args={[3.9, 0.46, 0.03]} />
        <meshStandardMaterial color={theme.deskScreen} roughness={1} />
      </Instanced>
      <Instanced parts={parts.rail} shadow={false}>
        <boxGeometry args={[3.92, 0.025, 0.05]} />
        <meshStandardMaterial color={WHITE} roughness={0.4} />
      </Instanced>
      <Instanced parts={parts.pedestal}>
        <boxGeometry args={[0.42, 0.6, 0.58]} />
        <meshStandardMaterial color={theme.pedestal} roughness={0.6} />
      </Instanced>
      <Instanced parts={parts.drawerLine} shadow={false}>
        <boxGeometry args={[0.44, 0.012, 0.01]} />
        <meshStandardMaterial color="#c9c1ad" roughness={0.8} />
      </Instanced>
    </group>
  );
}

/** White meeting/boardroom tables for the glass rooms. */
function MeetingTables({ layout }: { layout: OfficeLayout }) {
  const parts = useMemo(() => {
    const top: Part[] = [];
    const leg: Part[] = [];
    for (const a of layout.areas) {
      if (a.kind === 'cafeteria') continue;
      const { tw, td } = tableSize(a);
      top.push({ p: [a.cx, 0.74, a.cz], ry: 0, s: [tw, 1, td] });
      for (const lx of [-1, 1]) {
        for (const lz of [-1, 1]) {
          leg.push({ p: [a.cx + lx * (tw / 2 - 0.25), 0.36, a.cz + lz * (td / 2 - 0.2)], ry: 0 });
        }
      }
    }
    return { top, leg };
  }, [layout]);
  return (
    <group>
      <Instanced parts={parts.top}>
        <boxGeometry args={[1, 0.05, 1]} />
        <meshStandardMaterial color={WHITE} roughness={0.3} metalness={0.02} />
      </Instanced>
      <Instanced parts={parts.leg}>
        <boxGeometry args={[0.07, 0.72, 0.07]} />
        <meshStandardMaterial color={CHROME} roughness={0.3} metalness={0.8} />
      </Instanced>
    </group>
  );
}

/** Cafeteria: round dark-wood tables, teal lounge chairs, coffee counter, planters. */
export function Cafeteria({ layout }: { layout: OfficeLayout }) {
  const theme = useTheme();
  const parts = useMemo(() => {
    const area = layout.areas.find((a) => a.kind === 'cafeteria');
    const tableTop: Part[] = [];
    const tableStem: Part[] = [];
    const tableBase: Part[] = [];
    const cup: Part[] = [];
    const seat: Part[] = [];
    const shell: Part[] = [];
    const leg: Part[] = [];
    for (const t of layout.cafeTables) {
      tableTop.push({ p: [t.x, 0.72, t.z], ry: 0 });
      tableStem.push({ p: [t.x, 0.36, t.z], ry: 0 });
      tableBase.push({ p: [t.x, 0.015, t.z], ry: 0 });
      cup.push({ p: [t.x + 0.12, 0.78, t.z - 0.08], ry: 0 });
    }
    for (const s of seatsFlatOf(layout)) {
      if (s.kind !== 'cafe') continue;
      const c = { x: s.x, z: s.z, angle: s.angle };
      seat.push({ p: at(c, -0.3, 0, 0.4), ry: s.angle });
      // Open cylinder shell wraps the back + sides (theta starts behind the sitter)
      shell.push({ p: at(c, -0.3, 0, 0.66), ry: s.angle + Math.PI });
      for (let i = 0; i < 4; i++) {
        const a = s.angle + Math.PI / 4 + (i * Math.PI) / 2;
        const base = at(c, -0.3, 0, 0.17);
        const [fx, fz] = facing(a);
        leg.push({ p: [base[0] + fx * 0.24, 0.17, base[2] + fz * 0.24], ry: a });
      }
    }
    const counter = area
      ? {
          x: area.cx + area.w / 2 - 0.45,
          z: area.cz,
          len: area.d - 0.8,
        }
      : null;
    return { tableTop, tableStem, tableBase, cup, seat, shell, leg, counter, area };
  }, [layout]);

  const { counter, area } = parts;
  return (
    <group>
      <Instanced parts={parts.tableTop}>
        <cylinderGeometry args={[0.45, 0.45, 0.04, 24]} />
        <meshStandardMaterial color={CAFE_WOOD} roughness={0.45} />
      </Instanced>
      <Instanced parts={parts.tableStem} shadow={false}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.4} metalness={0.6} />
      </Instanced>
      <Instanced parts={parts.tableBase} shadow={false}>
        <cylinderGeometry args={[0.26, 0.28, 0.03, 20]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.4} metalness={0.6} />
      </Instanced>
      <Instanced parts={parts.cup} shadow={false}>
        <cylinderGeometry args={[0.04, 0.035, 0.1, 10]} />
        <meshStandardMaterial color="#e8e3d8" roughness={0.5} />
      </Instanced>
      <Instanced parts={parts.seat}>
        <cylinderGeometry args={[0.34, 0.32, 0.14, 20]} />
        <meshStandardMaterial color={theme.lounge} roughness={0.95} />
      </Instanced>
      <Instanced parts={parts.shell}>
        <cylinderGeometry args={[0.37, 0.35, 0.5, 20, 1, true, -Math.PI * 0.55, Math.PI * 1.1]} />
        <meshStandardMaterial color={theme.lounge} roughness={0.95} side={THREE.DoubleSide} />
      </Instanced>
      <Instanced parts={parts.leg} shadow={false}>
        <cylinderGeometry args={[0.018, 0.018, 0.34, 6]} />
        <meshStandardMaterial color={CHAIR_BLACK} roughness={0.5} metalness={0.5} />
      </Instanced>

      {counter && area && (
        <group position={[counter.x, 0, counter.z]}>
          {/* Counter body + stone top */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 1.0, counter.len]} />
            <meshStandardMaterial color={WHITE} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.02, 0]} receiveShadow>
            <boxGeometry args={[0.8, 0.05, counter.len + 0.1]} />
            <meshStandardMaterial color="#d9d4ca" roughness={0.3} />
          </mesh>
          {/* Coffee machine + water dispenser */}
          <mesh position={[0, 1.3, -counter.len / 4]} castShadow>
            <boxGeometry args={[0.45, 0.5, 0.5]} />
            <meshStandardMaterial color="#2a2c30" roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[-0.05, 1.22, -counter.len / 4]}>
            <boxGeometry args={[0.3, 0.08, 0.52]} />
            <meshStandardMaterial color="#0d0e10" emissive="#2f7fd6" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 1.35, counter.len / 4]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.6, 14]} />
            <meshPhysicalMaterial color="#9fd1ff" transparent opacity={0.45} roughness={0.05} />
          </mesh>
          {/* Overhead shelf with mugs */}
          <mesh position={[0.15, 1.9, 0]}>
            <boxGeometry args={[0.35, 0.04, counter.len * 0.8]} />
            <meshStandardMaterial color={WHITE} roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Realistic mode furniture — modelled on a modern IT-office fit-out: white
 * bench desks with grey privacy screens and beige pedestals, black mesh task
 * chairs, white meeting tables, a cafeteria with round tables and teal lounge
 * chairs, and KayKit (CC0) planters/books for dressing.
 */
export function RealisticFurniture({ layout }: { layout: OfficeLayout }) {
  const room = useSimStore((s) => s.params.room);
  const seatsFlat = useMemo(() => seatsFlatOf(layout), [layout]);
  const chairSeats = useMemo(() => seatsFlat.filter((s) => s.kind !== 'cafe'), [seatsFlat]);

  const { width: W, length: L } = room;
  const decor = useMemo(() => {
    const cafe = layout.areas.find((a) => a.kind === 'cafeteria');
    const plants: InstanceTransform[] = [
      { position: [-W / 2 + 0.9, 0, L / 2 - 1.0], rotationY: 0, scale: 1.8 },
      { position: [-W / 2 + 0.9, 0, 0], rotationY: 1.2, scale: 1.6 },
      { position: [W / 2 - 0.9, 0, -L / 2 + 1.0], rotationY: 2.1, scale: 1.8 },
    ];
    if (cafe) {
      plants.push({ position: [cafe.cx - cafe.w / 2 + 0.5, 0, cafe.cz + cafe.d / 2 - 0.6], rotationY: 0.4, scale: 1.9 });
      plants.push({ position: [cafe.cx - cafe.w / 2 + 0.5, 0, cafe.cz - cafe.d / 2 + 0.6], rotationY: 2.6, scale: 1.7 });
    }
    const cactiS: InstanceTransform[] = layout.pods
      .filter((_, i) => i % 3 === 0)
      .map((pod) => ({
        position: [pod.x + 1.6, 0.76, pod.z + 0.45] as [number, number, number],
        rotationY: (pod.x * 13) % Math.PI,
        scale: 0.6,
      }));
    const books: InstanceTransform[] = layout.pods
      .filter((_, i) => i % 3 === 1)
      .map((pod) => ({
        position: [pod.x - 1.5, 0.76, pod.z - 0.45] as [number, number, number],
        rotationY: (pod.z * 7) % Math.PI,
        scale: 0.7,
      }));
    // White storage lockers along the west wall
    const lockers: Part[] = [
      { p: [-W / 2 + 0.32, 0.6, L / 4], ry: 0 },
      { p: [-W / 2 + 0.32, 0.6, L / 4 + 1.3], ry: 0 },
      { p: [-W / 2 + 0.32, 0.6, -L / 4], ry: 0 },
    ];
    const lockerLines: Part[] = lockers.flatMap((l) =>
      [0.3, 0.6, 0.9].map((y) => ({ p: [l.p[0] + 0.23, y, l.p[2]] as [number, number, number], ry: 0 })),
    );
    // Desk-end planters (reference: white oak-trimmed planter boxes with tall
    // foliage capping each bench, like the photo) — one per pod end, alternating sides.
    const planterBox: Part[] = [];
    const planterSoil: Part[] = [];
    const foliage: Part[] = [];
    layout.pods.forEach((pod, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const px = pod.x + side * 2.45;
      const pz = pod.z;
      planterBox.push({ p: [px, 0.36, pz], ry: 0 });
      planterSoil.push({ p: [px, 0.73, pz], ry: 0 });
      // 5 leaf clusters per planter, deterministic jitter
      for (let k = 0; k < 5; k++) {
        const jx = ((i * 7 + k * 13) % 10) / 10 - 0.5;
        const jz = ((i * 11 + k * 5) % 10) / 10 - 0.5;
        const h = 0.35 + ((i + k * 3) % 4) * 0.08;
        foliage.push({
          p: [px + jx * 0.3, 0.74 + h / 2, pz + jz * 1.1],
          ry: (i + k) * 0.7,
          s: [0.28, h, 0.28],
        });
      }
    });
    return { plants, cactiS, books, lockers, lockerLines, planterBox, planterSoil, foliage };
  }, [W, L, layout]);

  return (
    <group>
      <WorkDesks layout={layout} />
      <TaskChairs seats={chairSeats} />
      <MeetingTables layout={layout} />
      <Cafeteria layout={layout} />
      {/* Desk-end planter boxes + foliage (procedural, instanced) */}
      <Instanced parts={decor.planterBox}>
        <boxGeometry args={[0.5, 0.72, 1.4]} />
        <meshStandardMaterial color="#f2f1ec" roughness={0.6} />
      </Instanced>
      <Instanced parts={decor.planterSoil} shadow={false}>
        <boxGeometry args={[0.44, 0.03, 1.34]} />
        <meshStandardMaterial color="#3a2f26" roughness={1} />
      </Instanced>
      <Instanced parts={decor.foliage}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#3f8f4a" roughness={0.85} flatShading />
      </Instanced>
      <GltfInstances url={MODEL('cactus_medium_A')} transforms={decor.plants} />
      <GltfInstances url={MODEL('cactus_small_A')} transforms={decor.cactiS} />
      <GltfInstances url={MODEL('book_set')} transforms={decor.books} />
      <Instanced parts={decor.lockers}>
        <boxGeometry args={[0.45, 1.2, 1.2]} />
        <meshStandardMaterial color={WHITE} roughness={0.5} />
      </Instanced>
      <Instanced parts={decor.lockerLines} shadow={false}>
        <boxGeometry args={[0.01, 0.012, 1.22]} />
        <meshStandardMaterial color="#c2c6cc" roughness={0.8} />
      </Instanced>
      <Monitors layout={layout} />
    </group>
  );
}

useGLTF.preload(MODEL('cactus_medium_A'));
