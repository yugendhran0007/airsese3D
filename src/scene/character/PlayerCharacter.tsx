import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { STATUS_COLORS } from '../../config/constants';
import { engine } from '../../simulation/engine';
import { useCharacterStore } from '../../state/characterStore';
import { useUiStore } from '../../state/uiStore';
import { useCharacterController } from './useCharacterController';
import { RealisticBody } from './RealisticBody';
import { Compiled } from '../useAsyncCompile';
import type { OfficeLayout } from '../office/officeLayout';

/**
 * Procedural capsule body: stylized mode, and the loading fallback in realistic
 * mode. It has no skeleton, so sitting is expressed by dropping the whole body
 * onto the cushion rather than by posing limbs.
 */
function StylizedBody() {
  const ref = useRef<THREE.Group>(null);
  const seated = useCharacterStore((s) => s.activity === 'sitting');
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const targetY = seated ? -0.42 : 0;
    g.position.y += (targetY - g.position.y) * Math.min(1, dt * 8);
  });
  return (
    <group ref={ref}>
      {/* Legs */}
      <mesh position={[-0.09, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1a2b47" roughness={0.8} />
      </mesh>
      <mesh position={[0.09, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1a2b47" roughness={0.8} />
      </mesh>
      {/* Torso — accent outfit so "you" reads instantly */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.45, 4, 12]} />
        <meshStandardMaterial color="#1ec8e8" emissive="#0e7f9c" emissiveIntensity={0.35} roughness={0.55} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.135, 14, 12]} />
        <meshStandardMaterial color="#e8b48f" roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The controllable employee ("You"): distinct cyan outfit, glow status ring,
 * name tag. Ring color tracks the zone the character is standing in.
 */
export function PlayerCharacter({ layout }: { layout: OfficeLayout }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const zone = useCharacterStore((s) => s.zone);
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  useCharacterController(groupRef, layout);

  useFrame((state, dt) => {
    if (!ringMat.current) return;
    const status = engine.snapshot.zones.find((z) => z.id === zone)?.status ?? 'green';
    const target = new THREE.Color(STATUS_COLORS[status]);
    ringMat.current.color.lerp(target, 1 - Math.exp(-6 * dt));
    ringMat.current.opacity = 0.75 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
  });

  return (
    <group ref={groupRef} position={[-2, 0, 4]}>
      {realistic ? (
        // GLB loads must not suspend the whole scene (the only boundary above
        // is the Canvas-level one): show the stylized body until the avatar lands
        <Suspense fallback={<StylizedBody />}>
          <Compiled>
            <RealisticBody />
          </Compiled>
        </Suspense>
      ) : (
        <StylizedBody />
      )}
      {/* Status ring */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
        <ringGeometry args={[0.32, 0.44, 32]} />
        <meshBasicMaterial ref={ringMat} transparent side={THREE.DoubleSide} />
      </mesh>
      {/* Name tag */}
      <Html position={[0, 1.95, 0]} center distanceFactor={14} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: '#a8ecff',
            background: 'rgba(8,18,34,0.75)',
            border: '1px solid rgba(56,225,255,0.4)',
            borderRadius: 8,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          YOU
        </div>
      </Html>
    </group>
  );
}
