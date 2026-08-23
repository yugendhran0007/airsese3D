/**
 * The meeting-room "boss" running an AI session: a standing VALID avatar by
 * the wall display, explaining to the seated team — right arm gesturing at
 * the screen, head turning between the display and the audience. All motion
 * is procedural world-axis bone rotation in useFrame (no React state).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import {
  applyPose,
  findPoseBones,
  modelForSeed,
  normalizeHeight,
  prepareAvatarSource,
  WorldXRotator,
} from './realisticPeople';

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

export function Presenter({ position, rotationY, seed = 7 }: { position: [number, number, number]; rotationY: number; seed?: number }) {
  const url = useMemo(() => modelForSeed(seed, false), [seed]);
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  const { clone, rArm, rForeArm, head, spine } = useMemo(() => {
    prepareAvatarSource(scene);
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).frustumCulled = false;
    });
    normalizeHeight(c, 1.78);
    const b = findPoseBones(c);
    applyPose(b, 'stand', 0.3);
    return {
      clone: c,
      // Right arm raised toward the screen: rotate about world Z (T-pose arm lies along X)
      rArm: new WorldXRotator(b.rArm, AXIS_Z),
      rForeArm: new WorldXRotator(b.rForeArm, AXIS_Z),
      head: new WorldXRotator(b.head, AXIS_Y),
      spine: new WorldXRotator(b.spine),
    };
  }, [scene]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Gesture cycle: point at the screen (~4 s), then open-hand toward the room
    const cycle = (t % 9) / 9;
    const pointing = cycle < 0.45 ? 1 : 0;
    const raise = THREE.MathUtils.lerp(0.55, 1.15, pointing) + Math.sin(t * 1.7) * 0.08;
    rArm.set(raise); // lift from the dropped pose
    rForeArm.set(Math.sin(t * 2.3) * 0.25 + (pointing ? 0.2 : -0.1));
    // Head: look at the display while pointing, at the team otherwise
    head.set(THREE.MathUtils.lerp(0.45, -0.35, pointing) + Math.sin(t * 0.9) * 0.08);
    spine.set(Math.sin(t * 1.4) * 0.02);
  });

  return (
    <group ref={groupRef} position={position} rotation-y={rotationY}>
      <primitive object={clone} />
    </group>
  );
}
