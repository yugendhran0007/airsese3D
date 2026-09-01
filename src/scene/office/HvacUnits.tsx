import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { engine } from '../../simulation/engine';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Instanced, type Part } from './RealisticFurniture';

const tmpObj = new THREE.Object3D();

/**
 * One instanced draw for a set of parts that all share a *single* animated
 * rotation.
 *
 * Every ceiling fan in the office spins at the same rate from the same phase,
 * and every wall-AC louver swings on the same sine — so at any instant their
 * orientations are identical and the whole set is one instanced mesh whose
 * matrices are rewritten once a frame. Drawn as individual meshes instead, the
 * cassettes alone were 96 draw calls for ~1 k triangles: pure per-draw driver
 * overhead, which is what an integrated GPU has least of to spare.
 *
 * `spin` receives the shared angle each frame and returns the Euler to apply on
 * top of the part's own `ry`.
 */
function AnimatedInstanced({
  parts,
  axis,
  angle,
  children,
}: {
  parts: Part[];
  axis: 'x' | 'y';
  angle: React.RefObject<number>;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const inst = ref.current;
    if (!inst) return;
    const a = angle.current;
    for (let i = 0; i < parts.length; i++) {
      const t = parts[i];
      tmpObj.position.set(...t.p);
      tmpObj.rotation.set(axis === 'x' ? a : (t.rx ?? 0), axis === 'y' ? t.ry + a : t.ry, 0, 'YXZ');
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      inst.setMatrixAt(i, tmpObj.matrix);
    }
    inst.count = parts.length;
    inst.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, parts.length)]} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
}

/**
 * Wall AC units (one per zone side wall) + ceiling vent cassettes; animation
 * speed follows the AC / ventilation percentages.
 *
 * Everything here is instanced by part rather than assembled as a group per
 * unit. The parts are laid out in world space up front, so a cassette's vanes,
 * grille and body each become one draw for the whole office instead of one per
 * cassette — 96 draws down to 7, with no visual change at all.
 */
export function HvacUnits() {
  const room = useSimStore((s) => s.params.room);
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  const { width: W, length: L, height: H } = room;
  const fanAngle = useRef(0);
  const louverAngle = useRef(-0.4);

  useFrame((state, dt) => {
    const vent = engine.params.ventilation / 100;
    const ac = engine.params.ac / 100;
    fanAngle.current += dt * (0.5 + vent * 12);
    louverAngle.current = -0.4 - Math.sin(state.clock.elapsedTime * 1.2) * 0.25 * ac;
  });

  const parts = useMemo(() => {
    const acBody: Part[] = [];
    const acLouver: Part[] = [];
    const acLed: Part[] = [];
    const ventBody: Part[] = [];
    const vane: Part[] = [];
    const grille: Part[] = [];
    const blade: Part[] = [];

    const acUnits: { pos: [number, number, number]; rotY: number }[] = [
      { pos: [-W / 2 + 0.25, H - 0.55, -L / 4], rotY: Math.PI / 2 },
      { pos: [-W / 2 + 0.25, H - 0.55, L / 4], rotY: Math.PI / 2 },
      { pos: [W / 2 - 0.25, H - 0.55, -L / 4], rotY: -Math.PI / 2 },
      { pos: [W / 2 - 0.25, H - 0.55, L / 4], rotY: -Math.PI / 2 },
    ];
    for (const u of acUnits) {
      const [ux, uy, uz] = u.pos;
      const c = Math.cos(u.rotY);
      const s = Math.sin(u.rotY);
      // Local offsets rotated into world by the unit's own Y rotation.
      const local = (lx: number, ly: number, lz: number): [number, number, number] => [
        ux + lx * c + lz * s,
        uy + ly,
        uz - lx * s + lz * c,
      ];
      acBody.push({ p: u.pos, ry: u.rotY });
      acLouver.push({ p: local(0, -0.24, 0.14), ry: u.rotY });
      acLed.push({ p: local(0.85, -0.12, 0.21), ry: u.rotY });
    }

    const cols = Math.max(2, Math.round(W / 8));
    const rows = Math.max(2, Math.round(L / 8));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -W / 2 + ((c + 0.5) * W) / cols;
        const z = -L / 2 + ((r + 0.5) * L) / rows;
        const y = H - 0.09;
        ventBody.push({ p: [x, y, z], ry: 0 });
        if (realistic) {
          for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            vane.push({ p: [x + Math.sin(rot) * 0.33, y - 0.045, z + Math.cos(rot) * 0.33], ry: rot });
          }
          grille.push({ p: [x, y - 0.046, z], ry: 0 });
        }
        for (const rot of [0, Math.PI / 2]) blade.push({ p: [x, y - 0.05, z], ry: rot });
      }
    }
    return { acBody, acLouver, acLed, ventBody, vane, grille, blade };
  }, [W, L, H, realistic]);

  return (
    <group>
      <Instanced parts={parts.acBody}>
        <boxGeometry args={[2.0, 0.55, 0.4]} />
        <meshStandardMaterial color="#dfe8f5" roughness={0.35} metalness={0.15} />
      </Instanced>
      <AnimatedInstanced parts={parts.acLouver} axis="x" angle={louverAngle}>
        <boxGeometry args={[1.8, 0.05, 0.22]} />
        <meshStandardMaterial color="#9fb4d4" roughness={0.4} />
      </AnimatedInstanced>
      <Instanced parts={parts.acLed} shadow={false}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={2.5} />
      </Instanced>

      <Instanced parts={parts.ventBody} shadow={false}>
        <boxGeometry args={[0.9, 0.08, 0.9]} />
        <meshStandardMaterial
          color={realistic ? '#ffffff' : '#182742'}
          roughness={0.6}
          metalness={realistic ? 0 : 0.4}
        />
      </Instanced>
      {realistic && (
        <>
          <Instanced parts={parts.vane} shadow={false}>
            <boxGeometry args={[0.6, 0.015, 0.14]} />
            <meshStandardMaterial color="#dfe2e6" roughness={0.7} />
          </Instanced>
          <Instanced parts={parts.grille} shadow={false}>
            <boxGeometry args={[0.4, 0.01, 0.4]} />
            <meshStandardMaterial color="#c9ccd1" roughness={0.8} />
          </Instanced>
        </>
      )}
      <AnimatedInstanced parts={parts.blade} axis="y" angle={fanAngle}>
        <boxGeometry args={[0.72, 0.03, 0.1]} />
        <meshStandardMaterial
          color={realistic ? '#b4b8bf' : '#3b5a86'}
          roughness={0.5}
          metalness={0.4}
        />
      </AnimatedInstanced>
    </group>
  );
}

/** Vent world positions for the particle system (x, y, z). */
export function ventPositions(W: number, L: number, H: number): [number, number, number][] {
  const cols = Math.max(2, Math.round(W / 8));
  const rows = Math.max(2, Math.round(L / 8));
  const out: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push([-W / 2 + ((c + 0.5) * W) / cols, H - 0.15, -L / 2 + ((r + 0.5) * L) / rows]);
    }
  }
  return out;
}
