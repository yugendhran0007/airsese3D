import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useSimStore } from '../../state/simStore';

/**
 * Drop-in office building (e.g. Sketchfab "Office Studio", CC Attribution —
 * downloadable with a free Sketchfab login). Place the extracted files at
 * public/models/office/scene.gltf (or .glb) and the model becomes the office
 * shell automatically: fitted to the configured room footprint, centered,
 * floor at y=0. Delete the folder to return to the built-in building.
 */
const CANDIDATES = [
  '/models/office/scene.gltf',
  '/models/office/scene.glb',
  '/models/office/office.glb',
  '/models/office/office.gltf',
];

/** Probe which (if any) custom office file exists. */
export function useCustomOfficeUrl(): string | null | 'pending' {
  const [url, setUrl] = useState<string | null | 'pending'>('pending');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const candidate of CANDIDATES) {
        try {
          const res = await fetch(candidate, { method: 'HEAD' });
          const type = res.headers.get('content-type') ?? '';
          if (res.ok && !type.includes('text/html')) {
            if (!cancelled) setUrl(candidate);
            return;
          }
        } catch {
          // keep probing
        }
      }
      if (!cancelled) setUrl(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return url;
}

export function CustomOffice({ url }: { url: string }) {
  const room = useSimStore((s) => s.params.room);
  const { scene } = useGLTF(url);

  const { clone, scale, offset } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Fit the model's footprint to the configured room, keep proportions.
    const fit = Math.min(room.width / Math.max(size.x, 0.01), room.length / Math.max(size.z, 0.01));
    return {
      clone: cloned,
      scale: fit,
      offset: new THREE.Vector3(-center.x * fit, -box.min.y * fit, -center.z * fit),
    };
  }, [scene, room.width, room.length]);

  return (
    <group position={offset} scale={scale}>
      <primitive object={clone} />
    </group>
  );
}
