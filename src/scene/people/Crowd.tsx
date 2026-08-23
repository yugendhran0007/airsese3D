import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { MAX_PEOPLE, STATUS_COLORS } from '../../config/constants';
import { engine } from '../../simulation/engine';
import { isPersonAffected, personStatus } from '../../simulation/effects';
import { ZONE_IDS } from '../../simulation/zones';
import { useUiStore } from '../../state/uiStore';
import type { Status, ZoneId } from '../../types/environment';
import { seededRandom } from '../../utils/math';
import type { OfficeLayout } from '../office/officeLayout';
import { appearanceFor, makeFaceTexture, SKIRT_DARKEN, TIE_COLORS } from './crowdAppearance';

const tmpObj = new THREE.Object3D();
tmpObj.rotation.order = 'YXZ'; // yaw first, then local pitch — hair/arms tilt correctly at any facing
const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();

const PANTS_COLOR = new THREE.Color('#2b3242');
const GLASSES_COLOR = new THREE.Color('#161a22');
const BADGE_COLOR = new THREE.Color('#f4f7fa');
const SHIRT_FRONT = new THREE.Color('#f2f5f8');
const ringColor = new THREE.Color();

interface Slot {
  x: number;
  z: number;
  angle: number;
  seated: boolean;
  zone: ZoneId;
}

const spawnScale = new Float32Array(MAX_PEOPLE * 4).fill(0);

/** Canvas ⚠ badge texture for affected-person markers. */
export function makeWarnTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.beginPath();
  g.moveTo(64, 10);
  g.lineTo(120, 112);
  g.lineTo(8, 112);
  g.closePath();
  g.fillStyle = 'rgba(255,59,92,0.92)';
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 64px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText('!', 64, 96);
  return new THREE.CanvasTexture(c);
}

/**
 * The workforce: instanced people with textured faces, hair styles, and
 * male/female office outfits (shirt+tie / blouse+skirt), plus status rings
 * and affected-person warning badges. Click a person to inspect them.
 */
export function Crowd({ layout, skipFirst = 0 }: { layout: OfficeLayout; skipFirst?: number }) {
  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const hairCapRef = useRef<THREE.InstancedMesh>(null);
  const hairBackRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const skirtRef = useRef<THREE.InstancedMesh>(null);
  const tieRef = useRef<THREE.InstancedMesh>(null);
  const neckRef = useRef<THREE.InstancedMesh>(null);
  const glassesRef = useRef<THREE.InstancedMesh>(null);
  const badgeRef = useRef<THREE.InstancedMesh>(null);
  const shirtRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const warnRef = useRef<THREE.InstancedMesh>(null);
  /** instanceId → {zone, slotIndex} for click-to-inspect. */
  const mapping = useRef<{ zone: ZoneId; index: number }[]>([]);
  const warnTex = useMemo(makeWarnTexture, []);
  const faceTex = useMemo(makeFaceTexture, []);

  const slots = useMemo(() => {
    const byZone = {} as Record<ZoneId, Slot[]>;
    for (const id of ZONE_IDS) {
      byZone[id] = [
        ...layout.seats[id].map((s) => ({ x: s.x, z: s.z, angle: s.angle, seated: true, zone: id })),
        ...layout.stands[id].map((s) => ({ x: s.x, z: s.z, angle: s.angle, seated: false, zone: id })),
      ];
    }
    return byZone;
  }, [layout]);

  const capacity = MAX_PEOPLE * 4;

  useFrame((state, dt) => {
    const torso = torsoRef.current;
    const head = headRef.current;
    const hairCap = hairCapRef.current;
    const hairBack = hairBackRef.current;
    const arm = armRef.current;
    const leg = legRef.current;
    const skirt = skirtRef.current;
    const tie = tieRef.current;
    const neck = neckRef.current;
    const glasses = glassesRef.current;
    const badge = badgeRef.current;
    const shirt = shirtRef.current;
    const ring = ringRef.current;
    const warn = warnRef.current;
    if (!torso || !head || !hairCap || !hairBack || !arm || !leg || !skirt || !tie || !ring || !warn)
      return;
    if (!neck || !glasses || !badge || !shirt) return;

    const t = state.clock.elapsedTime;
    const people = engine.params.peoplePerZone;
    let idx = 0;
    let armIdx = 0;
    let legIdx = 0;
    let warnIdx = 0;
    let hairBackIdx = 0;
    let skirtIdx = 0;
    let tieIdx = 0;
    let glassesIdx = 0;
    let badgeIdx = 0;
    let shirtIdx = 0;
    mapping.current.length = 0;

    for (const zoneId of ZONE_IDS) {
      const zoneSlots = slots[zoneId];
      const count = Math.min(people[zoneId], zoneSlots.length);
      const status: Status = engine.snapshot.zones.find((z) => z.id === zoneId)?.status ?? 'green';
      tmpColor.set(STATUS_COLORS[status]);

      for (let i = skipFirst; i < count; i++) {
        const slot = zoneSlots[i];
        const seed = i * 17 + zoneId.charCodeAt(0) * 101;
        const phase = seededRandom(seed) * Math.PI * 2;
        const affected = isPersonAffected(seed, status);
        const look = appearanceFor(seed);

        spawnScale[idx] = Math.min(1, spawnScale[idx] + dt * 2.5);
        const ease = 1 - (1 - spawnScale[idx]) * (1 - spawnScale[idx]);

        // Affected people slump: slower bob, forward lean, drooped head
        const bobSpeed = affected ? 1.1 : slot.seated ? 2.2 : 1.4;
        const bob = Math.sin(t * bobSpeed + phase) * (slot.seated ? 0.015 : 0.02);
        const sway = Math.sin(t * 0.9 + phase) * 0.03;
        const lean = affected ? 0.22 : 0;
        const facing = slot.angle + sway;
        const sinF = Math.sin(facing);
        const cosF = Math.cos(facing);

        const torsoY = slot.seated ? 0.72 : 0.95;
        const headY = (slot.seated ? 1.22 : 1.5) - (affected ? 0.07 : 0);
        // Chairs sit slightly away from the slot point — park the body on the chair
        const back = slot.seated ? 0.28 : 0;
        const px = slot.x + sway * 0.4 - Math.sin(slot.angle) * back;
        const pz = slot.z - Math.cos(slot.angle) * back;

        mapping.current[idx] = { zone: zoneId, index: i };

        // Torso (females slightly narrower shoulders)
        tmpObj.position.set(px, torsoY * ease + bob, pz);
        tmpObj.rotation.set(lean, facing, 0);
        tmpObj.scale.set(
          ease * (look.female ? 0.88 : 1),
          ease * (slot.seated ? 0.82 : 1),
          ease * (look.female ? 0.92 : 1),
        );
        tmpObj.updateMatrix();
        torso.setMatrixAt(idx, tmpObj.matrix);
        torso.setColorAt(idx, look.outfit);

        // Head with face texture, tinted to skin tone
        tmpObj.position.set(px, headY * ease + bob * 1.4, pz + lean * 0.18);
        tmpObj.rotation.set(lean * 1.4, facing, 0);
        tmpObj.scale.setScalar(ease);
        tmpObj.updateMatrix();
        head.setMatrixAt(idx, tmpObj.matrix);
        head.setColorAt(idx, look.skin);

        // Hair cap: tilted back so the face stays open
        tmpObj.position.set(px, headY * ease + bob * 1.4 + 0.012, pz + lean * 0.18);
        tmpObj.rotation.set(lean * 1.4 - 0.45, facing, 0);
        tmpObj.scale.setScalar(ease * (look.female ? 1.06 : 1));
        tmpObj.updateMatrix();
        hairCap.setMatrixAt(idx, tmpObj.matrix);
        hairCap.setColorAt(idx, look.hair);

        // Long hair at the back (female)
        if (look.female) {
          tmpObj.position.set(
            px - 0.1 * sinF,
            headY * ease + bob * 1.4 - 0.06,
            pz - 0.1 * cosF + lean * 0.18,
          );
          tmpObj.rotation.set(lean, facing, 0);
          tmpObj.scale.set(ease * 0.85, ease * 1.35, ease * 0.7);
          tmpObj.updateMatrix();
          hairBack.setMatrixAt(hairBackIdx, tmpObj.matrix);
          hairBack.setColorAt(hairBackIdx, look.hair);
          hairBackIdx++;
        }

        // Arms: seated → reaching toward the desk; standing → hanging
        const armAngle = slot.seated ? -1.1 : -0.15 + Math.sin(t * bobSpeed + phase) * 0.06;
        for (const side of [-1, 1]) {
          const ox = cosF * 0.21 * side;
          const oz = -sinF * 0.21 * side;
          tmpObj.position.set(px + ox, (torsoY + 0.1) * ease + bob, pz + oz);
          tmpObj.rotation.set(armAngle + lean, facing, 0.18 * side);
          tmpObj.scale.setScalar(ease);
          tmpObj.updateMatrix();
          arm.setMatrixAt(armIdx, tmpObj.matrix);
          arm.setColorAt(armIdx, tmpColor2.copy(look.outfit).multiplyScalar(0.92));
          armIdx++;
        }

        // Legs: standing people only
        if (!slot.seated) {
          for (const side of [-1, 1]) {
            const ox = cosF * 0.09 * side;
            const oz = -sinF * 0.09 * side;
            tmpObj.position.set(slot.x + ox, 0.3 * ease, slot.z + oz);
            tmpObj.rotation.set(0, facing, 0);
            tmpObj.scale.setScalar(ease);
            tmpObj.updateMatrix();
            leg.setMatrixAt(legIdx, tmpObj.matrix);
            leg.setColorAt(legIdx, PANTS_COLOR);
            legIdx++;
          }
        }

        // Skirt (female office outfit)
        if (look.female) {
          tmpObj.position.set(px, (slot.seated ? 0.5 : 0.62) * ease, pz);
          tmpObj.rotation.set(0, facing, 0);
          tmpObj.scale.set(ease, ease * (slot.seated ? 0.55 : 0.9), ease);
          tmpObj.updateMatrix();
          skirt.setMatrixAt(skirtIdx, tmpObj.matrix);
          skirt.setColorAt(skirtIdx, tmpColor2.copy(look.outfit).multiplyScalar(SKIRT_DARKEN));
          skirtIdx++;
        }

        // Tie (male office outfit)
        if (look.hasTie) {
          tmpObj.position.set(
            px + 0.165 * sinF,
            (torsoY + 0.08) * ease + bob,
            pz + 0.165 * cosF,
          );
          tmpObj.rotation.set(lean, facing, 0);
          tmpObj.scale.setScalar(ease);
          tmpObj.updateMatrix();
          tie.setMatrixAt(tieIdx, tmpObj.matrix);
          tie.setColorAt(tieIdx, TIE_COLORS[seed % TIE_COLORS.length]);
          tieIdx++;
        }

        // Neck connecting head and shirt collar
        tmpObj.position.set(px, (headY - 0.17) * ease + bob, pz + lean * 0.15);
        tmpObj.rotation.set(lean, facing, 0);
        tmpObj.scale.setScalar(ease);
        tmpObj.updateMatrix();
        neck.setMatrixAt(idx, tmpObj.matrix);
        neck.setColorAt(idx, look.skin);

        // Glasses on the face
        if (look.hasGlasses) {
          tmpObj.position.set(
            px + 0.117 * sinF,
            headY * ease + bob * 1.4 + 0.006,
            pz + 0.117 * cosF + lean * 0.18,
          );
          tmpObj.rotation.set(lean * 1.4, facing, 0);
          tmpObj.scale.setScalar(ease);
          tmpObj.updateMatrix();
          glasses.setMatrixAt(glassesIdx, tmpObj.matrix);
          glasses.setColorAt(glassesIdx, GLASSES_COLOR);
          glassesIdx++;
        }

        // White shirt front under blazers (tie renders on top for men)
        if (look.blazer) {
          tmpObj.position.set(px + 0.16 * sinF, (torsoY + 0.09) * ease + bob, pz + 0.16 * cosF);
          tmpObj.rotation.set(lean, facing, 0);
          tmpObj.scale.setScalar(ease);
          tmpObj.updateMatrix();
          shirt.setMatrixAt(shirtIdx, tmpObj.matrix);
          shirt.setColorAt(shirtIdx, SHIRT_FRONT);
          shirtIdx++;
        }

        // ID badge clipped to the chest
        if (look.hasBadge) {
          tmpObj.position.set(
            px + 0.17 * sinF + cosF * 0.085,
            (torsoY + 0.02) * ease + bob,
            pz + 0.17 * cosF - sinF * 0.085,
          );
          tmpObj.rotation.set(lean, facing, 0.05);
          tmpObj.scale.setScalar(ease);
          tmpObj.updateMatrix();
          badge.setMatrixAt(badgeIdx, tmpObj.matrix);
          badge.setColorAt(badgeIdx, BADGE_COLOR);
          badgeIdx++;
        }

        // Status ring — affected people pulse hot red
        const ringPulse = affected ? 1 + Math.sin(t * 5 + phase) * 0.18 : 1;
        tmpObj.position.set(slot.x, 0.03, pz);
        tmpObj.rotation.set(-Math.PI / 2, 0, 0);
        tmpObj.scale.setScalar(ease * ringPulse);
        tmpObj.updateMatrix();
        ring.setMatrixAt(idx, tmpObj.matrix);
        ring.setColorAt(idx, ringColor.set(STATUS_COLORS[personStatus(seed, status)]));

        // Warning badge above affected heads
        if (affected) {
          tmpObj.position.set(slot.x, headY * ease + 0.45 + Math.sin(t * 2.4 + phase) * 0.05, pz);
          tmpObj.rotation.set(0, Math.atan2(state.camera.position.x - slot.x, state.camera.position.z - slot.z), 0);
          tmpObj.scale.setScalar(0.28 * ease);
          tmpObj.updateMatrix();
          warn.setMatrixAt(warnIdx, tmpObj.matrix);
          warnIdx++;
        }

        idx++;
      }
    }

    for (let i = idx; i < capacity; i++) {
      if (spawnScale[i] <= 0) continue;
      spawnScale[i] = Math.max(0, spawnScale[i] - dt * 3);
    }

    torso.count = idx;
    head.count = idx;
    hairCap.count = idx;
    hairBack.count = hairBackIdx;
    ring.count = idx;
    arm.count = armIdx;
    leg.count = legIdx;
    skirt.count = skirtIdx;
    tie.count = tieIdx;
    neck.count = idx;
    glasses.count = glassesIdx;
    badge.count = badgeIdx;
    shirt.count = shirtIdx;
    warn.count = warnIdx;
    for (const m of [torso, head, hairCap, hairBack, ring, arm, leg, skirt, tie, neck, glasses, badge, shirt, warn]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const onPersonClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId == null) return;
    const person = mapping.current[e.instanceId];
    if (person) useUiStore.getState().setSelectedPerson({ index: person.index, zone: person.zone });
  };

  return (
    <group>
      <instancedMesh ref={torsoRef} args={[undefined, undefined, capacity]} castShadow onClick={onPersonClick}>
        <capsuleGeometry args={[0.17, 0.42, 4, 10]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, capacity]} castShadow onClick={onPersonClick}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial map={faceTex} roughness={0.62} />
      </instancedMesh>
      {/* Hair: cap for everyone, long back hair for women */}
      <instancedMesh ref={hairCapRef} args={[undefined, undefined, capacity]}>
        <sphereGeometry args={[0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={hairBackRef} args={[undefined, undefined, capacity]}>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[undefined, undefined, capacity * 2]}>
        <capsuleGeometry args={[0.05, 0.34, 3, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={legRef} args={[undefined, undefined, capacity * 2]}>
        <capsuleGeometry args={[0.06, 0.42, 3, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      {/* Office outfits: A-line skirt + tie */}
      <instancedMesh ref={skirtRef} args={[undefined, undefined, capacity]}>
        <coneGeometry args={[0.27, 0.34, 10]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={tieRef} args={[undefined, undefined, capacity]}>
        <boxGeometry args={[0.05, 0.26, 0.018]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {/* Professional details: neck, glasses, ID badge, blazer shirt front */}
      <instancedMesh ref={neckRef} args={[undefined, undefined, capacity]}>
        <cylinderGeometry args={[0.052, 0.06, 0.1, 8]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={glassesRef} args={[undefined, undefined, capacity]}>
        <boxGeometry args={[0.17, 0.05, 0.022]} />
        <meshStandardMaterial roughness={0.35} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={badgeRef} args={[undefined, undefined, capacity]}>
        <boxGeometry args={[0.07, 0.095, 0.012]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={shirtRef} args={[undefined, undefined, capacity]}>
        <boxGeometry args={[0.15, 0.3, 0.016]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, capacity]}>
        <ringGeometry args={[0.26, 0.34, 24]} />
        <meshBasicMaterial transparent opacity={0.75} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* Affected-person badges (camera-facing) */}
      <instancedMesh ref={warnRef} args={[undefined, undefined, capacity]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={warnTex} transparent depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
