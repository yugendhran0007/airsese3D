import * as THREE from 'three';
import { rotateBoneWorld, type PoseBones } from '../people/realisticPeople';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
/** Sign of an X rotation that swings a limb forward (+Z), matching `applyPose`. */
const FWD = -1;

export type RestPose = { bone: THREE.Object3D; q: THREE.Quaternion }[];

/** Snapshot the rig's rest rotations so a procedural pose can be rebuilt from scratch each frame. */
export function captureRest(bones: PoseBones): RestPose {
  const out: RestPose = [];
  for (const bone of Object.values(bones)) {
    if (bone) out.push({ bone, q: bone.quaternion.clone() });
  }
  return out;
}

/** Reset every posed bone back to its rest rotation (rotateBoneWorld composes, so poses must start clean). */
export function restoreRest(rest: RestPose): void {
  for (const { bone, q } of rest) bone.quaternion.copy(q);
}

/**
 * Procedural dance: hips sway and twist, arms pump overhead in alternation,
 * head bobs on the off-beat. The Soldier animation source only ships
 * Idle/Walk/Run, so this is authored in world axes (like `applyPose`) rather
 * than retargeted from a clip. `t` is elapsed seconds.
 */
export function applyDancePose(bones: PoseBones, t: number): void {
  const beat = t * 5.0;
  const s = Math.sin(beat);
  const s2 = Math.sin(beat * 2);

  // Hips: side sway plus a twist into the sway
  rotateBoneWorld(bones.hips, AXIS_Z, s * 0.13);
  rotateBoneWorld(bones.hips, AXIS_Y, s * 0.3);
  // Spine counter-rotates so the torso stays roughly front-on
  rotateBoneWorld(bones.spine, AXIS_Y, -s * 0.2);
  rotateBoneWorld(bones.spine, AXIS_X, FWD * (0.06 + s2 * 0.05));
  rotateBoneWorld(bones.spine2, AXIS_Z, -s * 0.08);

  // Arms up and pumping in alternation. From the T-pose the arms lie along
  // ±X, so a positive Z rotation lifts the left arm and a negative one the right.
  const lLift = 0.45 + s * 0.55;
  const rLift = 0.45 - s * 0.55;
  rotateBoneWorld(bones.lArm, AXIS_Z, lLift);
  rotateBoneWorld(bones.rArm, AXIS_Z, -rLift);
  rotateBoneWorld(bones.lArm, AXIS_X, FWD * 0.25);
  rotateBoneWorld(bones.rArm, AXIS_X, FWD * 0.25);
  // Elbows bent, hands in toward the head
  rotateBoneWorld(bones.lForeArm, AXIS_X, FWD * (0.9 - s * 0.35));
  rotateBoneWorld(bones.rForeArm, AXIS_X, FWD * (0.9 + s * 0.35));

  // Head bobs at double time and follows the sway
  rotateBoneWorld(bones.head, AXIS_X, FWD * (0.08 + s2 * 0.1));
  rotateBoneWorld(bones.head, AXIS_Y, s * 0.25);

  // Weight shifts between the legs: the trailing knee bends on each beat
  rotateBoneWorld(bones.lUpLeg, AXIS_X, FWD * Math.max(0, s) * 0.3);
  rotateBoneWorld(bones.rUpLeg, AXIS_X, FWD * Math.max(0, -s) * 0.3);
  rotateBoneWorld(bones.lLeg, AXIS_X, -FWD * Math.max(0, s) * 0.45);
  rotateBoneWorld(bones.rLeg, AXIS_X, -FWD * Math.max(0, -s) * 0.45);
}
