import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { engine } from '../../simulation/engine';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';

/** Wall AC units (one per zone side wall) + ceiling vent fans; animation speed follows AC/vent %. */
export function HvacUnits() {
  const room = useSimStore((s) => s.params.room);
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  const { width: W, length: L, height: H } = room;
  const fansRef = useRef<THREE.Group[]>([]);
  const louverRef = useRef<THREE.Mesh[]>([]);

  useFrame((state, dt) => {
    const vent = engine.params.ventilation / 100;
    const ac = engine.params.ac / 100;
    for (const fan of fansRef.current) {
      if (fan) fan.rotation.y += dt * (0.5 + vent * 12);
    }
    for (const louver of louverRef.current) {
      if (louver) louver.rotation.x = -0.4 - Math.sin(state.clock.elapsedTime * 1.2) * 0.25 * ac;
    }
  });

  const acUnits: { pos: [number, number, number]; rotY: number }[] = [
    { pos: [-W / 2 + 0.25, H - 0.55, -L / 4], rotY: Math.PI / 2 },
    { pos: [-W / 2 + 0.25, H - 0.55, L / 4], rotY: Math.PI / 2 },
    { pos: [W / 2 - 0.25, H - 0.55, -L / 4], rotY: -Math.PI / 2 },
    { pos: [W / 2 - 0.25, H - 0.55, L / 4], rotY: -Math.PI / 2 },
  ];

  const ventCols = Math.max(2, Math.round(W / 8));
  const ventRows = Math.max(2, Math.round(L / 8));
  const vents: [number, number][] = [];
  for (let r = 0; r < ventRows; r++) {
    for (let c = 0; c < ventCols; c++) {
      vents.push([
        -W / 2 + ((c + 0.5) * W) / ventCols,
        -L / 2 + ((r + 0.5) * L) / ventRows,
      ]);
    }
  }

  return (
    <group>
      {acUnits.map((unit, i) => (
        <group key={i} position={unit.pos} rotation-y={unit.rotY}>
          <mesh castShadow>
            <boxGeometry args={[2.0, 0.55, 0.4]} />
            <meshStandardMaterial color="#dfe8f5" roughness={0.35} metalness={0.15} />
          </mesh>
          <mesh
            position={[0, -0.24, 0.14]}
            ref={(m) => {
              if (m) louverRef.current[i] = m;
            }}
          >
            <boxGeometry args={[1.8, 0.05, 0.22]} />
            <meshStandardMaterial color="#9fb4d4" roughness={0.4} />
          </mesh>
          {/* Status LED */}
          <mesh position={[0.85, -0.12, 0.21]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={2.5} />
          </mesh>
        </group>
      ))}

      {vents.map(([x, z], i) => (
        <group key={i} position={[x, H - 0.09, z]}>
          <mesh>
            <boxGeometry args={[0.9, 0.08, 0.9]} />
            <meshStandardMaterial color={realistic ? '#ffffff' : '#182742'} roughness={0.6} metalness={realistic ? 0 : 0.4} />
          </mesh>
          {realistic &&
            [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, j) => (
              <mesh key={j} rotation-y={rot} position={[Math.sin(rot) * 0.33, -0.045, Math.cos(rot) * 0.33]}>
                <boxGeometry args={[0.6, 0.015, 0.14]} />
                <meshStandardMaterial color="#dfe2e6" roughness={0.7} />
              </mesh>
            ))}
          {realistic && (
            <mesh position={[0, -0.046, 0]}>
              <boxGeometry args={[0.4, 0.01, 0.4]} />
              <meshStandardMaterial color="#c9ccd1" roughness={0.8} />
            </mesh>
          )}
          <group
            position={[0, -0.05, 0]}
            ref={(g) => {
              if (g) fansRef.current[i] = g;
            }}
          >
            {[0, Math.PI / 2].map((rot, j) => (
              <mesh key={j} rotation-y={rot}>
                <boxGeometry args={[0.72, 0.03, 0.1]} />
                <meshStandardMaterial color={realistic ? '#b4b8bf' : '#3b5a86'} roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
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
