import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { STATUS_COLORS } from '../../config/constants';
import { engine } from '../../simulation/engine';
import { isPersonAffected, personStatus } from '../../simulation/effects';
import { ZONE_IDS } from '../../simulation/zones';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import type { Status, ZoneId } from '../../types/environment';
import { seededRandom } from '../../utils/math';
import type { OfficeLayout, SeatKind } from '../office/officeLayout';
import { appearanceFor } from './crowdAppearance';
import { makeWarnTexture } from './Crowd';
import {
  ALL_PEOPLE_MODELS,
  ALL_PEOPLE_MODELS_LITE,
  applyPose,
  findPoseBones,
  modelForSeed,
  normalizeHeight,
  prepareAvatarSource,
  WorldXRotator,
} from './realisticPeople';

const tmpColor = new THREE.Color();
const tmpObj = new THREE.Object3D();
const tmpVec = new THREE.Vector3();
/** Beyond this camera distance seated avatars freeze their micro-animation (LOD). */
const ANIM_LOD_DIST = 22;

/** Skinned avatars are expensive — beyond this many per zone, the instanced
 * stylized crowd renders the overflow. Covers every seat at default rooms. */
export const REALISTIC_PER_ZONE = 24;
/** Fast mode keeps only a handful of skinned avatars per zone (each is a skinned draw call). */
export function realisticPerZone(quality: 'fast' | 'balanced' | 'ultra'): number {
  return quality === 'fast' ? 4 : quality === 'balanced' ? 12 : REALISTIC_PER_ZONE;
}

interface SlotSpec {
  x: number;
  z: number;
  angle: number;
  seated: boolean;
  kind: SeatKind | 'stand';
}

/** One photorealistic employee: posed VALID avatar + status ring + ⚠ badge. */
function RealPerson({
  slot,
  seed,
  zone,
  index,
  warnTex,
}: {
  slot: SlotSpec;
  seed: number;
  zone: ZoneId;
  index: number;
  warnTex: THREE.Texture;
}) {
  const look = useMemo(() => appearanceFor(seed), [seed]);
  const quality = useUiStore((s) => s.quality);
  const url = useMemo(() => modelForSeed(seed, look.female), [seed, look.female, quality]);
  const { scene } = useGLTF(url);
  const warnRef = useRef<THREE.Sprite>(null);
  const groupRef = useRef<THREE.Group>(null);
  const vary = seededRandom(seed * 53 + 19);
  const phase = seededRandom(seed) * Math.PI * 2;

  const ultra = useUiStore((s) => s.ultraQuality);
  const { clone, spineRot, headRot, lHand, rHand } = useMemo(() => {
    prepareAvatarSource(scene);
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        // Seated crowd never casts shadows outside ultra: the shadow pass would
        // re-skin every avatar a second time each frame
        o.castShadow = ultra;
        (o as THREE.Mesh).frustumCulled = true;
      }
    });
    normalizeHeight(c, look.female ? 1.62 : 1.74);
    const b = findPoseBones(c);
    // Seated: drop the whole body so the hip joint rests just above the cushion
    // (task chair 0.51 m, lounge chair 0.47 m) instead of hovering at standing height
    if (slot.kind !== 'stand' && b.hips) {
      c.updateMatrixWorld(true);
      const hipY = b.hips.getWorldPosition(new THREE.Vector3()).y;
      c.position.y = (slot.kind === 'cafe' ? 0.52 : 0.56) - hipY;
    }
    applyPose(b, slot.kind, vary);
    // Skinned meshes are culled with a bounding sphere computed from the posed
    // skeleton (three ≥ r153), padded for breathing/typing motion
    c.updateMatrixWorld(true);
    c.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) {
        sm.computeBoundingSphere();
        if (sm.boundingSphere) sm.boundingSphere.radius *= 1.25;
      }
    });
    return {
      clone: c,
      spineRot: new WorldXRotator(b.spine),
      headRot: new WorldXRotator(b.head),
      // Typing: forearms tap alternately (desk + meeting seats)
      lHand: slot.kind === 'desk' || slot.kind === 'meeting' ? new WorldXRotator(b.lForeArm) : null,
      rHand: slot.kind === 'desk' || slot.kind === 'meeting' ? new WorldXRotator(b.rForeArm) : null,
    };
  }, [scene, slot.kind, vary, look.female, ultra]);

  // Chairs sit slightly away from the slot point — park the body on the chair
  const back = slot.seated ? 0.28 : 0;
  const px = slot.x - Math.sin(slot.angle) * back;
  const pz = slot.z - Math.cos(slot.angle) * back;

  // Grow-in on spawn, matching the stylized crowd's ease
  useEffect(() => {
    groupRef.current?.scale.setScalar(0.01);
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const status: Status = engine.snapshot.zones.find((z) => z.id === zone)?.status ?? 'green';
    const affected = isPersonAffected(seed, status);

    const group = groupRef.current;
    if (group) {
      const s = Math.min(1, group.scale.x + dt * 2.5);
      group.scale.setScalar(s);
    }

    // LOD: far from the camera the pose is static (bones untouched → no extra work)
    tmpVec.set(px, 1, pz);
    const far = state.camera.position.distanceTo(tmpVec) > ANIM_LOD_DIST;
    if (far && !affected) return;

    // Breathing + affected slump (forward lean = negative world-X rotation)
    const lean = affected ? 0.32 : 0;
    const breathe = Math.sin(t * (affected ? 1.1 : 1.6) + phase) * 0.02;
    spineRot.set(-(lean + breathe));
    headRot.set(-((affected ? 0.4 : 0) + breathe * 0.5));
    // Typing: quick alternating forearm taps with pauses ("thinking") every few seconds
    if (lHand && rHand) {
      const burst = Math.sin(t * 0.45 + phase) > -0.35 ? 1 : 0;
      const rate = affected ? 4 : 7;
      lHand.set(-Math.max(0, Math.sin(t * rate + phase)) * 0.07 * burst);
      rHand.set(-Math.max(0, Math.sin(t * rate + phase + Math.PI)) * 0.07 * burst);
    }

    if (warnRef.current) {
      warnRef.current.visible = affected;
      if (affected) {
        warnRef.current.position.y =
          (slot.seated ? 1.55 : 2.05) + Math.sin(t * 2.4 + phase) * 0.05;
      }
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useUiStore.getState().setSelectedPerson({ index, zone });
  };

  return (
    <group position={[px, 0, pz]} rotation-y={slot.angle}>
      <group ref={groupRef} onClick={onClick}>
        <primitive object={clone} />
      </group>
      <sprite ref={warnRef} scale={[0.28, 0.28, 1]} visible={false}>
        <spriteMaterial map={warnTex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/**
 * Safety rings for every realistic avatar in ONE instanced draw call
 * (green safe · yellow medium · red danger, per person). Employee mode
 * enlarges and brightens them; danger rings pulse. Fully deterministic from
 * seed + zone status, so it needs nothing from the avatar components.
 */
function SafetyRings({ people }: { people: { slot: SlotSpec; seed: number; zone: ZoneId }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const spawn = useRef(new Float32Array(0));
  if (spawn.current.length !== people.length) spawn.current = new Float32Array(people.length);
  const grow = useRef(1);

  useFrame((state, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const employeeMode = useUiStore.getState().employeeMode;
    grow.current += ((employeeMode ? 1.35 : 1) - grow.current) * Math.min(1, dt * 6);
    if (matRef.current) matRef.current.opacity = employeeMode ? 0.95 : 0.7;
    const sp = spawn.current;
    const zones = engine.snapshot.zones;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const zoneStatus: Status = zones.find((z) => z.id === p.zone)?.status ?? 'green';
      const st = personStatus(p.seed, zoneStatus);
      const phase = seededRandom(p.seed) * Math.PI * 2;
      sp[i] = Math.min(1, sp[i] + dt * 2.5);
      const pulse = st === 'red' ? 1 + Math.sin(t * 5 + phase) * 0.18 : st === 'yellow' ? 1 + Math.sin(t * 2.2 + phase) * 0.06 : 1;
      const back = p.slot.seated ? 0.28 : 0;
      tmpObj.position.set(p.slot.x - Math.sin(p.slot.angle) * back, 0.03, p.slot.z - Math.cos(p.slot.angle) * back);
      tmpObj.rotation.set(-Math.PI / 2, 0, 0);
      tmpObj.scale.setScalar(sp[i] * pulse * grow.current);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
      mesh.setColorAt(i, tmpColor.set(STATUS_COLORS[st]));
    }
    mesh.count = people.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, people.length)]} frustumCulled={false}>
      <ringGeometry args={[0.26, 0.34, 28]} />
      <meshBasicMaterial ref={matRef} transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Photorealistic workforce (realistic render mode): every employee is a posed,
 * gender-matched VALID avatar — seated at desks or standing — with the same
 * status rings, affected-person badges, and click-to-inspect as the stylized
 * crowd. Occupancy beyond REALISTIC_PER_ZONE falls back to the instanced crowd.
 */
export function RealisticCrowd({ layout }: { layout: OfficeLayout }) {
  const peoplePerZone = useSimStore((s) => s.params.peoplePerZone);
  const perZone = realisticPerZone(useUiStore((s) => s.quality));
  const warnTex = useMemo(makeWarnTexture, []);

  const slots = useMemo(() => {
    const byZone = {} as Record<ZoneId, SlotSpec[]>;
    for (const id of ZONE_IDS) {
      byZone[id] = [
        ...layout.seats[id].map((s) => ({ x: s.x, z: s.z, angle: s.angle, seated: true, kind: s.kind })),
        ...layout.stands[id].map((s) => ({ x: s.x, z: s.z, angle: s.angle, seated: false, kind: 'stand' as const })),
      ];
    }
    return byZone;
  }, [layout]);

  const people: { slot: SlotSpec; seed: number; zone: ZoneId; index: number }[] = [];
  for (const zoneId of ZONE_IDS) {
    const zoneSlots = slots[zoneId];
    const count = Math.min(peoplePerZone[zoneId], zoneSlots.length, perZone);
    for (let i = 0; i < count; i++) {
      // Same seed formula as the stylized Crowd so identity, gender, and
      // affected-state stay consistent across render modes and the inspector.
      const seed = i * 17 + zoneId.charCodeAt(0) * 101;
      people.push({ slot: zoneSlots[i], seed, zone: zoneId, index: i });
    }
  }

  return (
    <group>
      <SafetyRings key={people.length} people={people} />
      {people.map((p) => (
        <RealPerson
          key={`${p.zone}-${p.index}`}
          slot={p.slot}
          seed={p.seed}
          zone={p.zone}
          index={p.index}
          warnTex={warnTex}
        />
      ))}
    </group>
  );
}

// Preload only the tier we will actually render; the other tier loads on demand
for (const url of useUiStore.getState().quality === 'ultra' ? ALL_PEOPLE_MODELS : ALL_PEOPLE_MODELS_LITE) useGLTF.preload(url);
