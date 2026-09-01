import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { seededRandom } from '../../utils/math';
import { useUiStore } from '../../state/uiStore';
import type { SeatKind } from '../office/officeLayout';

/**
 * VALID avatar library (UCF + Google, CC-BY 4.0) — photorealistic rigged
 * office people in business outfits, served locally from public/models/people.
 * Bones use standard Mixamo names WITHOUT the "mixamorig:" prefix, so the
 * Soldier's Mixamo clips retarget onto them by renaming tracks.
 */
export const MALE_MODELS = [
  '/models/people/Asian_M_1_Busi.glb',
  '/models/people/Asian_M_2_Busi.glb',
  '/models/people/Asian_M_3_Busi.glb',
  '/models/people/MENA_M_1_Busi.glb',
  '/models/people/MENA_M_3_Busi.glb',
];

export const FEMALE_MODELS = [
  '/models/people/Asian_F_1_Busi.glb',
  '/models/people/Asian_F_2_Busi.glb',
  '/models/people/Asian_F_3_Busi.glb',
  '/models/people/MENA_F_1_Busi.glb',
  '/models/people/MENA_F_2_Busi.glb',
];

export const ALL_PEOPLE_MODELS = [...MALE_MODELS, ...FEMALE_MODELS];

/**
 * Two asset tiers of the same avatars (`scripts/optimize-avatars.mjs`):
 * `people/` = 1024² textures, full geometry (8K/ultra only);
 * `people-lite/` = 512² textures, 40 % of the triangles (Fast/Balanced) —
 * half the download and ~60 % less skinning work per frame.
 */
export function tierUrl(url: string): string {
  return useUiStore.getState().quality === 'ultra' ? url : url.replace('/models/people/', '/models/people-lite/');
}
export const ALL_PEOPLE_MODELS_LITE = ALL_PEOPLE_MODELS.map((u) => u.replace('/models/people/', '/models/people-lite/'));

/** The controllable "YOU" avatar (always the full-quality asset — it is the one you look at). */
export const PLAYER_MODEL = '/models/people/Asian_M_2_Busi.glb';

/** Deterministic model pick, gender-matched to appearanceFor(seed).female, in the current asset tier. */
export function modelForSeed(seed: number, female: boolean): string {
  const pool = female ? FEMALE_MODELS : MALE_MODELS;
  return tierUrl(pool[Math.floor(seededRandom(seed * 43 + 11) * pool.length)]);
}

/**
 * Retarget the Soldier's Mixamo clips onto a VALID rig.
 *
 * The rigs share Mixamo bone names (VALID without the "mixamorig:" prefix)
 * and both rest in a T-pose, but their bind poses differ completely (the
 * Soldier's Hips sits under a −90° X node and its bones rest near identity;
 * VALID bakes axis conversions into each bone's rest rotation). Copying local
 * rotations therefore produces broken poses, so retargeting is done in world
 * space: the clip is sampled on a throw-away Soldier clone, each bone's world
 * rotation delta from its own T-pose is applied to the VALID bone's T-pose
 * world rotation, and the result is converted back into the VALID parent's
 * local frame. Hips translation is carried over as a world-space delta scaled
 * by the hip-height ratio. Scale tracks are dropped (VALID keeps its cm→m
 * conversion as scale 0.01 on the Hips bone).
 */
export function retargetMixamoClips(
  clips: THREE.AnimationClip[],
  soldierScene: THREE.Object3D,
  avatarRoot: THREE.Object3D,
): THREE.AnimationClip[] {
  // Throw-away Soldier skeleton to sample the clips on
  const soldier = SkeletonUtils.clone(soldierScene);
  soldier.position.set(0, 0, 0);
  soldier.rotation.set(0, 0, 0);
  soldier.scale.setScalar(1);
  soldier.updateMatrixWorld(true);
  avatarRoot.updateMatrixWorld(true);

  // Soldier faces −Z at rest, VALID faces +Z: align the Soldier's world by a half turn
  const qAlign = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const qAlignInv = qAlign.clone().invert();

  interface Pair {
    name: string;
    sBone: THREE.Object3D;
    aBone: THREE.Object3D;
    sRestInv: THREE.Quaternion; // inverse of Soldier rest world rotation
    aRest: THREE.Quaternion; // VALID rest world rotation
  }
  const pairs: Pair[] = [];
  const byAvatarBone = new Map<THREE.Object3D, Pair>();
  soldier.traverse((o) => {
    // Match by name, not isBone: the shipped Soldier.glb is stripped to its
    // node hierarchy + clips (scripts/optimize-avatars.mjs), so without a skin
    // GLTFLoader instantiates the joints as plain Object3Ds
    if (!o.name) return;
    const name = o.name.replace(/^mixamorig:?/, '');
    const aBone = avatarRoot.getObjectByName(name);
    if (!aBone) return;
    const pair: Pair = {
      name,
      sBone: o,
      aBone,
      sRestInv: o.getWorldQuaternion(new THREE.Quaternion()).invert(),
      aRest: aBone.getWorldQuaternion(new THREE.Quaternion()),
    };
    pairs.push(pair);
    byAvatarBone.set(aBone, pair);
  });
  const hipsPair = pairs.find((p) => p.name === 'Hips');
  if (!hipsPair) return clips;

  const sHipRest = hipsPair.sBone.getWorldPosition(new THREE.Vector3());
  const aHipRest = hipsPair.aBone.getWorldPosition(new THREE.Vector3());
  const heightRatio = sHipRest.y > 1e-6 ? aHipRest.y / sHipRest.y : 1;
  const aHipsParent = hipsPair.aBone.parent!;
  const parentRestWorld = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const p of pairs) {
    const parent = p.aBone.parent;
    if (parent && !byAvatarBone.has(parent)) {
      parentRestWorld.set(parent, parent.getWorldQuaternion(new THREE.Quaternion()));
    }
  }

  const mixer = new THREE.AnimationMixer(soldier);
  const qS = new THREE.Quaternion();
  const qD = new THREE.Quaternion();
  const qW = new THREE.Quaternion();
  const qP = new THREE.Quaternion();
  const vP = new THREE.Vector3();
  const worldA = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const p of pairs) worldA.set(p.aBone, new THREE.Quaternion());

  const out = clips.map((clip) => {
    const action = mixer.clipAction(clip);
    action.play();
    // Sample at the clip's own key times (Mixamo: 30 fps); fall back to 30 fps
    const hipsTrack = clip.tracks.find((t) => /Hips\.quaternion$/.test(t.name));
    const times = hipsTrack
      ? Array.from(hipsTrack.times)
      : Array.from({ length: Math.max(2, Math.round(clip.duration * 30) + 1) }, (_, i) => i / 30);
    const n = times.length;
    const rot = new Map<Pair, Float32Array>();
    for (const p of pairs) rot.set(p, new Float32Array(n * 4));
    const pos = new Float32Array(n * 3);

    for (let f = 0; f < n; f++) {
      mixer.setTime(times[f]);
      soldier.updateMatrixWorld(true);
      // World-space targets for every mapped bone
      for (const p of pairs) {
        p.sBone.getWorldQuaternion(qS);
        // delta = align · (W_S · R_S⁻¹) · align⁻¹
        qD.copy(qAlign).multiply(qS).multiply(p.sRestInv).multiply(qAlignInv);
        worldA.get(p.aBone)!.copy(qD).multiply(p.aRest);
      }
      // Back to local rotations against the (new) parent world rotation
      for (const p of pairs) {
        const parent = p.aBone.parent!;
        const pw = worldA.get(parent) ?? parentRestWorld.get(parent);
        qP.copy(pw ?? new THREE.Quaternion()).invert();
        qW.copy(qP).multiply(worldA.get(p.aBone)!);
        const arr = rot.get(p)!;
        arr[f * 4] = qW.x;
        arr[f * 4 + 1] = qW.y;
        arr[f * 4 + 2] = qW.z;
        arr[f * 4 + 3] = qW.w;
      }
      // Hips translation: world delta from rest, aligned, height-scaled
      hipsPair.sBone.getWorldPosition(vP).sub(sHipRest).applyQuaternion(qAlign).multiplyScalar(heightRatio).add(aHipRest);
      aHipsParent.worldToLocal(vP);
      pos[f * 3] = vP.x;
      pos[f * 3 + 1] = vP.y;
      pos[f * 3 + 2] = vP.z;
    }
    action.stop();
    mixer.uncacheClip(clip);

    const tracks: THREE.KeyframeTrack[] = [];
    for (const p of pairs) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${p.name}.quaternion`, times, Array.from(rot.get(p)!)));
    }
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, Array.from(pos)));
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });
  mixer.stopAllAction();
  return out;
}

const preparedSources = new WeakSet<THREE.Object3D>();

/**
 * One-time load-cost trim for a VALID avatar straight out of useGLTF (the
 * cached source scene, before cloning). The rigs ship ~65 ARKit facial blend
 * shapes per face/eye/teeth mesh; the app never animates faces, yet three.js
 * builds and uploads a per-geometry morph DataArrayTexture the first time
 * each mesh is drawn — measured at >10 s of main-thread time for a full
 * crowd. Dropping the morph attributes makes every clone render with the
 * plain skinning shader and no 3D-texture upload.
 */
export function prepareAvatarSource(scene: THREE.Object3D): void {
  if (preparedSources.has(scene)) return;
  preparedSources.add(scene);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    if (Object.keys(geo.morphAttributes).length) {
      geo.morphAttributes = {};
      geo.morphTargetsRelative = false;
    }
    mesh.morphTargetInfluences = undefined;
    mesh.morphTargetDictionary = undefined;
  });
}

const clipCache = new WeakMap<THREE.Object3D, THREE.AnimationClip[]>();

/**
 * Retargeted clips for an avatar *model* (keyed by its useGLTF source scene),
 * computed once and shared by every clone of that model. Retargeting samples
 * every frame of every clip through an AnimationMixer, so doing it per
 * instance (player + six walkers) was several hundred ms each on load. The
 * result is valid for any clone because clones share the source rest pose and
 * the Hips.position track is expressed in the parent's local frame, which a
 * uniform root scale does not change.
 */
export function getRetargetedClips(
  soldier: { animations: THREE.AnimationClip[]; scene: THREE.Object3D },
  avatarSource: THREE.Object3D,
): THREE.AnimationClip[] {
  let clips = clipCache.get(avatarSource);
  if (!clips) {
    clips = retargetMixamoClips(soldier.animations, soldier.scene, SkeletonUtils.clone(avatarSource));
    clipCache.set(avatarSource, clips);
  }
  return clips;
}

const tmpVec = new THREE.Vector3();

/**
 * Normalize an avatar clone to a target standing height (meters). Skinned
 * meshes ignore their node transforms (bones drive the vertices), so bounding
 * boxes lie — measure the skeleton instead: the Head joint sits at ~92% of a
 * standing human's height regardless of the rig's source units.
 */
export function normalizeHeight(root: THREE.Object3D, target: number): void {
  root.updateMatrixWorld(true);
  const head = root.getObjectByName('Head');
  if (!head) return;
  const headY = head.getWorldPosition(tmpVec).y;
  if (Number.isFinite(headY) && headY > 1e-6) {
    root.scale.multiplyScalar((target * 0.92) / headY);
  }
}

export interface PoseBones {
  hips: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  spine2: THREE.Object3D | null;
  neck: THREE.Object3D | null;
  head: THREE.Object3D | null;
  lArm: THREE.Object3D | null;
  rArm: THREE.Object3D | null;
  lForeArm: THREE.Object3D | null;
  rForeArm: THREE.Object3D | null;
  lHand: THREE.Object3D | null;
  rHand: THREE.Object3D | null;
  lUpLeg: THREE.Object3D | null;
  rUpLeg: THREE.Object3D | null;
  lLeg: THREE.Object3D | null;
  rLeg: THREE.Object3D | null;
  lFoot: THREE.Object3D | null;
  rFoot: THREE.Object3D | null;
}

export function findPoseBones(root: THREE.Object3D): PoseBones {
  const g = (n: string) => root.getObjectByName(n) ?? null;
  return {
    hips: g('Hips'),
    spine: g('Spine'),
    spine2: g('Spine2'),
    neck: g('Neck'),
    head: g('Head'),
    lArm: g('LeftArm'),
    rArm: g('RightArm'),
    lForeArm: g('LeftForeArm'),
    rForeArm: g('RightForeArm'),
    lHand: g('LeftHand'),
    rHand: g('RightHand'),
    lUpLeg: g('LeftUpLeg'),
    rUpLeg: g('RightUpLeg'),
    lLeg: g('LeftLeg'),
    rLeg: g('RightLeg'),
    lFoot: g('LeftFoot'),
    rFoot: g('RightFoot'),
  };
}

const _qW = new THREE.Quaternion();
const _qR = new THREE.Quaternion();
const _qP = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * Rotate a bone about a WORLD axis (avatar at the origin facing +Z, so X is
 * the sitter's left, Y up, Z forward). VALID bone-local axes are not Mixamo's,
 * so poses are authored in world space and converted to local here.
 */
export function rotateBoneWorld(bone: THREE.Object3D | null, axis: THREE.Vector3, angle: number): void {
  if (!bone || !bone.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_qP);
  _qW.copy(_qP).multiply(bone.quaternion); // current world rotation
  _qR.setFromAxisAngle(axis, angle);
  _qW.premultiply(_qR); // world delta
  bone.quaternion.copy(_qP.invert()).multiply(_qW);
}

/** Per-frame world-X-axis rotation applied on top of a stored base local rotation (breathing, slump). */
export class WorldXRotator {
  private readonly pInv = new THREE.Quaternion();
  private readonly p = new THREE.Quaternion();
  private readonly base = new THREE.Quaternion();
  private readonly r = new THREE.Quaternion();
  constructor(private readonly bone: THREE.Object3D | null, private readonly axis: THREE.Vector3 = AXIS_X) {
    if (bone?.parent) {
      bone.parent.updateWorldMatrix(true, false);
      bone.parent.getWorldQuaternion(this.p);
      this.pInv.copy(this.p).invert();
      this.base.copy(bone.quaternion);
    }
  }
  /** Set rotation `angle` (rad) about the sitter's world X axis (positive = lean back, negative = forward). */
  set(angle: number): void {
    if (!this.bone) return;
    this.r.setFromAxisAngle(this.axis, angle);
    this.bone.quaternion.copy(this.pInv).multiply(this.r).multiply(this.p).multiply(this.base);
  }
}

/**
 * Statically pose an avatar (VALID rigs rest in T-pose) using world-axis
 * rotations; `vary` in [0,1) adds per-person variety. `kind`: desk (typing),
 * meeting (hands on the table, attentive), cafe (leaning back, relaxed) or
 * stand. Avatar faces +Z: thighs forward = rotate about X by −90°; arms drop
 * from the T-pose by rotating about Z (left arm at +X rotates −, right +).
 */
export function applyPose(bones: PoseBones, kind: SeatKind | 'stand', vary: number): void {
  const v = (a: number, b: number) => a + (vary - 0.5) * b;
  const FWD = -1; // sign of an X rotation that swings a limb forward (+Z)
  if (kind !== 'stand') {
    // Thighs forward, shins back down, feet flat
    rotateBoneWorld(bones.lUpLeg, AXIS_X, FWD * 1.5);
    rotateBoneWorld(bones.rUpLeg, AXIS_X, FWD * 1.5);
    rotateBoneWorld(bones.lLeg, AXIS_X, -FWD * 1.45);
    rotateBoneWorld(bones.rLeg, AXIS_X, -FWD * 1.45);
    rotateBoneWorld(bones.lFoot, AXIS_X, FWD * 0.1);
    rotateBoneWorld(bones.rFoot, AXIS_X, FWD * 0.1);
    if (kind === 'desk') {
      // Arms down from the T-pose, then forward to the keyboard, elbows bent
      rotateBoneWorld(bones.lArm, AXIS_Z, -1.2);
      rotateBoneWorld(bones.rArm, AXIS_Z, 1.2);
      rotateBoneWorld(bones.lArm, AXIS_X, FWD * v(0.55, 0.15));
      rotateBoneWorld(bones.rArm, AXIS_X, FWD * v(0.55, 0.15));
      rotateBoneWorld(bones.lForeArm, AXIS_X, FWD * 0.95);
      rotateBoneWorld(bones.rForeArm, AXIS_X, FWD * 0.95);
      // Hands drift inward over the laptop keyboard
      rotateBoneWorld(bones.lForeArm, AXIS_Y, 0.25);
      rotateBoneWorld(bones.rForeArm, AXIS_Y, -0.25);
      rotateBoneWorld(bones.spine, AXIS_X, FWD * v(0.1, 0.08));
      // Eyes on the laptop screen
      rotateBoneWorld(bones.head, AXIS_X, FWD * v(0.32, 0.1));
    } else if (kind === 'meeting') {
      // Forearms resting on the table, upright and attentive
      rotateBoneWorld(bones.lArm, AXIS_Z, -1.3);
      rotateBoneWorld(bones.rArm, AXIS_Z, 1.3);
      rotateBoneWorld(bones.lArm, AXIS_X, FWD * v(0.35, 0.1));
      rotateBoneWorld(bones.rArm, AXIS_X, FWD * v(0.35, 0.1));
      rotateBoneWorld(bones.lForeArm, AXIS_X, FWD * 1.25);
      rotateBoneWorld(bones.rForeArm, AXIS_X, FWD * 1.25);
      rotateBoneWorld(bones.lForeArm, AXIS_Y, 0.35);
      rotateBoneWorld(bones.rForeArm, AXIS_Y, -0.35);
      rotateBoneWorld(bones.spine, AXIS_X, FWD * v(0.04, 0.05));
      // Notes on the laptop in front of them
      rotateBoneWorld(bones.head, AXIS_X, FWD * v(0.22, 0.1));
    } else {
      // Café: leaning back, one hand in the lap, one on the armrest
      rotateBoneWorld(bones.lArm, AXIS_Z, -1.35);
      rotateBoneWorld(bones.rArm, AXIS_Z, 1.35);
      rotateBoneWorld(bones.lArm, AXIS_X, FWD * v(0.2, 0.2));
      rotateBoneWorld(bones.rArm, AXIS_X, FWD * v(0.35, 0.2));
      rotateBoneWorld(bones.lForeArm, AXIS_X, FWD * 0.7);
      rotateBoneWorld(bones.rForeArm, AXIS_X, FWD * 1.1);
      rotateBoneWorld(bones.spine, AXIS_X, -FWD * v(0.12, 0.06));
    }
  } else {
    // Standing: arms relaxed at the sides
    rotateBoneWorld(bones.lArm, AXIS_Z, -1.35);
    rotateBoneWorld(bones.rArm, AXIS_Z, 1.35);
    rotateBoneWorld(bones.lArm, AXIS_X, FWD * v(0.08, 0.1));
    rotateBoneWorld(bones.rArm, AXIS_X, FWD * v(0.08, 0.1));
    rotateBoneWorld(bones.lForeArm, AXIS_X, FWD * 0.3);
    rotateBoneWorld(bones.rForeArm, AXIS_X, FWD * 0.3);
    rotateBoneWorld(bones.spine, AXIS_X, FWD * v(0.02, 0.05));
  }
  rotateBoneWorld(bones.head, AXIS_Y, (vary - 0.5) * (kind === 'desk' ? 0.15 : 0.5));
}

/**
 * Facial-detail LOD, shared by every skinned character in the office.
 *
 * A VALID avatar is ~7 skinned draws and six of them are the eyes, tear glands
 * and teeth — features that carry almost no triangles and cover well under a
 * pixel past a few metres, yet each costs a full skinned draw call. Hiding them
 * at distance is the single cheapest draw-call saving in the scene: measured
 * from the default orbit camera (avatars 22–51 m away) it removes on the order
 * of a hundred draws. Hair and bodies are never culled this way.
 *
 * This lived only in `RealisticCrowd`, so the walkers, the player and anyone
 * else built from an avatar kept drawing full faces at any distance. It is a
 * property of the asset, not of the crowd, so it belongs here.
 */
export const FACE_PART_RE = /eye|gland|teeth/i;

/** Metres past which the facial submeshes stop being worth their draw calls. */
export const BASE_FACE_LOD_DIST = 7;

/** Every facial submesh under `root`, ready to be toggled as a set. */
export function collectFaceParts(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && FACE_PART_RE.test(sm.name)) out.push(sm);
  });
  return out;
}

/**
 * Current LOD distance, honouring the auto-tune detail rung. Read it once per
 * frame and pass it to `applyFaceLod` rather than calling it per character —
 * the crowd runs this for every occupant from a single `useFrame`.
 */
export function faceLodDistance(autoTune: boolean, rungDist: number): number {
  return autoTune ? rungDist : BASE_FACE_LOD_DIST;
}

/**
 * Show or hide a character's facial submeshes for the given camera distance.
 *
 * The guard reads the meshes' **real** visibility rather than a remembered
 * flag: `useAsyncCompile` reveals a subtree by setting `visible = true` on every
 * mesh it hid at mount, so a cached boolean silently desyncs the first time an
 * avatar streams in and the LOD then never re-applies again. Comparing against
 * the mesh itself keeps this self-healing for one property read per frame.
 */
export function applyFaceLod(parts: THREE.SkinnedMesh[], dist: number, threshold: number): void {
  if (parts.length === 0) return;
  const on = dist < threshold;
  if (parts[0].visible === on) return;
  for (let i = 0; i < parts.length; i++) parts[i].visible = on;
}
