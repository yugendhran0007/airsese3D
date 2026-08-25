import * as THREE from 'three';
import { rotateBoneWorld, type PoseBones } from '../people/realisticPeople';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
/** Sign of an X rotation that swings a limb forward (+Z), matching `applyPose`. */
const FWD = -1;

export type RestPose = { bone: THREE.Object3D; q: THREE.Quaternion }[];

/**
 * Run `fn` with every ancestor rotation of `root` neutralized, then restore.
 * World-axis pose helpers (`rotateBoneWorld`, `WorldXRotator`) assume the
 * avatar's own axes equal world axes — true for the crowd (posed before
 * mounting) but not for the player, whose group is already rotated to the
 * chair's facing. Without this, a seat facing −Z would bend the arms backward.
 */
export function withNeutralAncestors(root: THREE.Object3D, fn: () => void): void {
  // Save/restore the EULER, not the quaternion: restoring a yaw-π quaternion
  // resyncs the euler as the alias (π, 0, π), so `rotation.y` reads 0 and the
  // controller's heading lerp then drives the group to a bogus orientation.
  const saved: { o: THREE.Object3D; e: THREE.Euler }[] = [];
  for (let o = root.parent; o; o = o.parent) {
    saved.push({ o, e: o.rotation.clone() });
    o.rotation.set(0, 0, 0);
  }
  try {
    fn();
  } finally {
    for (const { o, e } of saved) o.rotation.copy(e);
  }
}

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

/** Live-tunable numbers of the laptop pose (exposed as window.__laptopTuning in dev). */
export const LAPTOP_TUNING = { aX: 0.5, fX: 1.3, hX: -0.5, lTwist: 0.9, rTwist: -0.9 };
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__laptopTuning = LAPTOP_TUNING;
}

const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();

/** Twist a forearm about its own elbow→wrist axis (palm rotation without moving the arm). */
function pronate(foreArm: THREE.Object3D | null, hand: THREE.Object3D | null, angle: number): void {
  if (!foreArm || !hand) return;
  foreArm.updateWorldMatrix(true, false);
  const axis = _vb.copy(hand.getWorldPosition(_vb)).sub(foreArm.getWorldPosition(_va)).normalize();
  rotateBoneWorld(foreArm, axis, angle);
}

/**
 * Office laptop-work pose for the player: a tidier version of the crowd's desk
 * pose. Elbows tucked to the sides, forearms level and angled in so the hands
 * hover over the laptop keyboard (0.36 m ahead of the seat point at 0.77 m —
 * see `Laptops`), wrists relaxed downward over the keys, straight back with a
 * slight lean and eyes on the screen. Avatar faces +Z, legs as in `applyPose`.
 */
export function applyLaptopPose(bones: PoseBones): void {
  // Sitting: thighs forward, shins down, feet flat
  rotateBoneWorld(bones.lUpLeg, AXIS_X, FWD * 1.5);
  rotateBoneWorld(bones.rUpLeg, AXIS_X, FWD * 1.5);
  rotateBoneWorld(bones.lLeg, AXIS_X, -FWD * 1.45);
  rotateBoneWorld(bones.rLeg, AXIS_X, -FWD * 1.45);
  rotateBoneWorld(bones.lFoot, AXIS_X, FWD * 0.1);
  rotateBoneWorld(bones.rFoot, AXIS_X, FWD * 0.1);
  // Upper arms: drop almost fully from the T-pose so the elbows rest at the
  // ribs (no flare), then a small forward swing toward the desk
  rotateBoneWorld(bones.lArm, AXIS_Z, -1.42);
  rotateBoneWorld(bones.rArm, AXIS_Z, 1.42);
  rotateBoneWorld(bones.lArm, AXIS_X, FWD * LAPTOP_TUNING.aX);
  rotateBoneWorld(bones.rArm, AXIS_X, FWD * LAPTOP_TUNING.aX);
  // Forearms: sloped down to the keys, angled inward to meet the keyboard centre
  rotateBoneWorld(bones.lForeArm, AXIS_X, FWD * LAPTOP_TUNING.fX);
  rotateBoneWorld(bones.rForeArm, AXIS_X, FWD * LAPTOP_TUNING.fX);
  rotateBoneWorld(bones.lForeArm, AXIS_Y, 0.32);
  rotateBoneWorld(bones.rForeArm, AXIS_Y, -0.32);
  // Pronation: after the T-pose drop the palms face sideways ("gesturing").
  // Twist each forearm about its own elbow→wrist axis (a pure twist moves no
  // vertices of the chain, unlike a world-Z rotation) until palms face the keys.
  pronate(bones.lForeArm, bones.lHand, LAPTOP_TUNING.lTwist);
  pronate(bones.rForeArm, bones.rHand, LAPTOP_TUNING.rTwist);
  // Wrists: negative = flexed down so fingers rest over the keys (positive
  // extends the wrist back, which reads as a palm-up shrug)
  rotateBoneWorld(bones.lHand, AXIS_X, FWD * LAPTOP_TUNING.hX);
  rotateBoneWorld(bones.rHand, AXIS_X, FWD * LAPTOP_TUNING.hX);
  rotateBoneWorld(bones.lHand, AXIS_Y, 0.12);
  rotateBoneWorld(bones.rHand, AXIS_Y, -0.12);
  // Straight, engaged back with a slight forward lean; eyes on the screen
  rotateBoneWorld(bones.spine, AXIS_X, FWD * 0.12);
  rotateBoneWorld(bones.spine2, AXIS_X, FWD * 0.05);
  rotateBoneWorld(bones.head, AXIS_X, FWD * 0.28);
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
