import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { ACCENT_COLOR, STATUS_COLORS } from '../../config/constants';
import { characterTransient, useCharacterStore, walkToSeat } from '../../state/characterStore';
import { useSimStore } from '../../state/simStore';
import { freeSeats, seatStatus } from './seatPicking';
import type { OfficeLayout, Seat } from '../office/officeLayout';

const tmpColor = new THREE.Color();

/** Free seats within this radius of the avatar light up as click targets. */
const SHOW_RADIUS = 5;
/** Cap on simultaneously offered seats, so a crowded aisle stays readable. */
const MAX_MARKERS = 8;
/** Re-scan for nearby seats at 4 Hz rather than every frame. */
const SCAN_INTERVAL = 0.25;

/**
 * Click-to-sit targets: a pulsing ring on every empty chair near the avatar
 * (or on every empty chair while the seat picker is on). Clicking one walks
 * the avatar over and seats it at the laptop — see `useCharacterController`.
 *
 * Each ring is **tinted by the air quality of the seat's zone** — green good,
 * amber acceptable, red poor — so choosing a chair is choosing air, not just a
 * spot on the floor. It is the same `STATUS_COLORS` scale as the occupants'
 * safety rings and the zone panels, read live from the engine snapshot inside
 * `useFrame` (never lifted into React state, at one lerp per marker per frame).
 *
 * Deliberately 3D-only (no drei `Html`): scene-space labels outrank the DOM
 * panels' z-index, so a floating tag here would paint over the dashboard.
 */
export function SeatTargets({ layout }: { layout: OfficeLayout }) {
  const activity = useCharacterStore((s) => s.activity);
  const seatPicker = useCharacterStore((s) => s.seatPicker);
  // Occupancy decides which seats are empty, so recompute when it moves
  const peoplePerZone = useSimStore((s) => s.params.peoplePerZone);
  const all = useMemo(() => freeSeats(layout), [layout, peoplePerZone]);

  const [shown, setShown] = useState<Seat[]>([]);
  const scanAcc = useRef(0);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const hovered = useRef(-1);

  useFrame((state, dt) => {
    // --- Throttled re-scan of what is in reach ---
    scanAcc.current += dt;
    if (scanAcc.current >= SCAN_INTERVAL) {
      scanAcc.current = 0;
      let next: Seat[] = [];
      if (activity !== 'sitting') {
        const { x, z } = characterTransient.position;
        next = seatPicker
          ? all
          : all
              .filter((s) => Math.hypot(s.x - x, s.z - z) <= SHOW_RADIUS)
              .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
              .slice(0, MAX_MARKERS);
      }
      const changed =
        next.length !== shown.length || next.some((s, i) => s.x !== shown[i].x || s.z !== shown[i].z);
      if (changed) setShown(next);
    }

    // --- Pulse (one loop for every marker, not one subscriber each) ---
    const pulse = 0.55 + Math.sin(state.clock.elapsedTime * 3) * 0.25;
    const k = 1 - Math.exp(-4 * dt); // ease colour changes so a zone tipping over reads as a fade
    for (let i = 0; i < rings.current.length; i++) {
      const mesh = rings.current[i];
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = i === hovered.current ? 0.95 : pulse;
      const s = i === hovered.current ? 1.15 : 1;
      mesh.scale.setScalar(s);
      const seat = shown[i];
      if (seat) {
        tmpColor.set(STATUS_COLORS[seatStatus(seat)]);
        mat.color.lerp(tmpColor, k);
        const disc = mesh.parent?.children[1] as THREE.Mesh | undefined;
        if (disc) (disc.material as THREE.MeshBasicMaterial).color.lerp(tmpColor, k);
      }
    }
  });

  if (activity === 'sitting' || shown.length === 0) return null;

  const onOver = (i: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = i;
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    hovered.current = -1;
    document.body.style.cursor = 'auto';
  };
  const onClick = (seat: Seat) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    hovered.current = -1;
    walkToSeat(seat);
  };

  return (
    <group>
      {shown.map((seat, i) => (
        <group key={`${seat.x.toFixed(2)}:${seat.z.toFixed(2)}`} position={[seat.x, 0, seat.z]}>
          <mesh
            ref={(m) => {
              rings.current[i] = m;
            }}
            rotation-x={-Math.PI / 2}
            position-y={0.06}
            onPointerOver={onOver(i)}
            onPointerOut={onOut}
            onClick={onClick(seat)}
          >
            <ringGeometry args={[0.26, 0.42, 28]} />
            <meshBasicMaterial
              color={ACCENT_COLOR}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Soft disc so the ring reads against the carpet from a low camera */}
          <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
            <circleGeometry args={[0.26, 24]} />
            <meshBasicMaterial color={ACCENT_COLOR} transparent opacity={0.12} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
