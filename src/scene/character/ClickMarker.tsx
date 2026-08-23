import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { characterTransient } from '../../state/characterStore';

/** Animated ripple ring at the click-to-walk destination. */
export function ClickMarker() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const mesh = ref.current;
    const material = mat.current;
    if (!mesh || !material) return;
    const target = characterTransient.target;
    if (!target) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.set(target.x, 0.05, target.z);
    const age = (performance.now() / 1000 - characterTransient.targetSetAt) % 1;
    const scale = 0.5 + age * 0.8;
    mesh.scale.setScalar(scale);
    material.opacity = 0.8 * (1 - age);
  });

  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.3, 0.4, 32]} />
      <meshBasicMaterial ref={mat} color="#38e1ff" transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
