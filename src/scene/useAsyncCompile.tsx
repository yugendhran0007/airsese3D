import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import type * as THREE from 'three';

import { useFrame, useThree } from '@react-three/fiber';

/** Shader-variant groups compiled + revealed per frame. */
const GROUPS_PER_FRAME = 2;

/**
 * Approximate three.js program-cache key for a drawable: every drawable with
 * the same signature shares one compiled program (give or take parameters
 * this misses, which only makes a group slightly lumpier). Grouping by
 * signature instead of by material instance turns ~400 materials into ~25
 * groups, so the reveal takes a dozen frames rather than hundreds.
 */
function variantKey(o: THREE.Object3D): string {
  const mesh = o as THREE.Mesh;
  const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshPhysicalMaterial;
  const g = mesh.geometry as THREE.BufferGeometry | undefined;
  return [
    m.type,
    m.map ? 'map' : '',
    m.normalMap ? 'nrm' : '',
    m.roughnessMap ? 'rgh' : '',
    m.metalnessMap ? 'mtl' : '',
    m.emissiveMap ? 'ems' : '',
    m.aoMap ? 'ao' : '',
    m.alphaMap ? 'alp' : '',
    m.envMap ? 'env' : '',
    m.transparent ? 'T' : '',
    m.side,
    m.vertexColors ? 'vc' : '',
    m.alphaTest > 0 ? 'at' : '',
    m.flatShading ? 'fs' : '',
    m.clearcoat ? 'cc' : '',
    m.transmission ? 'tr' : '',
    m.sheen ? 'sh' : '',
    (o as THREE.SkinnedMesh).isSkinnedMesh ? 'skin' : '',
    (o as THREE.InstancedMesh).isInstancedMesh ? 'inst' : '',
    g?.attributes.color ? 'gc' : '',
    g?.attributes.uv1 ? 'uv1' : '',
    g?.attributes.tangent ? 'tan' : '',
  ].join('|');
}

/**
 * Mount an object hidden and bring it in a couple of material groups per
 * frame, compiling each group's program just before it is revealed.
 *
 * three.js compiles a material's program on the first draw that uses it. The
 * browser's GPU process performs the native driver compile serially, and any
 * synchronous GL call afterwards waits for that queue to drain — so drawing
 * the whole office at once cost ~3–4 s of frozen main thread cold on
 * Mesa/ANGLE, and several more seconds when the avatars streamed in.
 * `KHR_parallel_shader_compile` / `compileAsync` do not help here: they only
 * parallelise shader translation, the native link still lands on the next
 * sync call as one lump. Pacing the compiles is what works: each frame
 * submits one or two programs (~50–150 ms cold each), so the page stays
 * responsive and the office builds up visibly within the first second.
 * Programs are cached per material variant, so later mounts — and any load
 * with Chrome's shader cache warm — reveal in a handful of frames.
 *
 * Only meshes visible at mount are touched; objects whose visibility is driven
 * elsewhere (status badges) are left alone.
 */
export function useAsyncCompile(ref: RefObject<THREE.Object3D | null>, deps: readonly unknown[]): void {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const queue = useRef<THREE.Object3D[][]>([]);

  useLayoutEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    // Group drawables by shader variant so each revealed group costs one program
    const byMaterial = new Map<string, THREE.Object3D[]>();
    const hidden: THREE.Object3D[] = [];
    obj.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!m || !o.visible || !((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite)) return;
      const key = variantKey(o);
      const list = byMaterial.get(key) ?? [];
      list.push(o);
      byMaterial.set(key, list);
      o.visible = false;
      hidden.push(o);
    });
    queue.current = [...byMaterial.values()];
    return () => {
      queue.current = [];
      for (const o of hidden) o.visible = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFrame(() => {
    const q = queue.current;
    if (!q.length) return;
    for (const group of q.splice(0, GROUPS_PER_FRAME)) {
      for (const o of group) {
        o.visible = true;
        // Builds the program now (lights gathered from the live scene); the
        // draw later this frame then finds it ready
        gl.compile(o, camera, scene);
      }
    }
  });
}

/**
 * Gate a subtree behind useAsyncCompile for its initial mount. Place it just
 * inside a Suspense boundary (the resolved content commits as one unit) or
 * around the initial world so no single frame pays for every shader at once.
 */
export function Compiled({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useAsyncCompile(ref, []);
  return <group ref={ref}>{children}</group>;
}
