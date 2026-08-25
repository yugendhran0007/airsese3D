import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { characterTransient, useCharacterStore } from '../../state/characterStore';
import {
  applyPose,
  findPoseBones,
  getRetargetedClips,
  normalizeHeight,
  PLAYER_MODEL,
  prepareAvatarSource,
  WorldXRotator,
} from '../people/realisticPeople';
import { applyDancePose, captureRest, restoreRest } from './emotes';

const SOLDIER_URL = '/models/Soldier.glb';

/**
 * Realistic animated human: a VALID business avatar driven by the Soldier's
 * Mixamo Idle/Walk/Run clips retargeted onto its rig. Animation weights
 * crossfade with the controller's live speed.
 *
 * Sitting and dancing bypass the mixer entirely — the Soldier only ships
 * locomotion clips, so those poses are authored in world axes exactly like the
 * seated crowd's (`applyPose`). All actions are stopped first, otherwise the
 * mixer would overwrite the bone rotations every frame.
 */
export function RealisticBody() {
  const { scene } = useGLTF(PLAYER_MODEL);
  const soldier = useGLTF(SOLDIER_URL);
  const activity = useCharacterStore((s) => s.activity);

  const { clone, bones, rest } = useMemo(() => {
    prepareAvatarSource(scene);
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        (o as THREE.Mesh).frustumCulled = false;
      }
    });
    normalizeHeight(c, 1.74);
    const b = findPoseBones(c);
    return { clone: c, bones: b, rest: captureRest(b) };
  }, [scene]);

  const clips = useMemo(() => getRetargetedClips(soldier, scene), [soldier, scene]);
  const { actions } = useAnimations(clips, clone);

  /** Typing rotators, rebuilt whenever the seated pose is (re)applied. */
  const typing = useRef<{ spine: WorldXRotator; head: WorldXRotator; lHand: WorldXRotator; rHand: WorldXRotator } | null>(
    null,
  );

  useEffect(() => {
    const playLocomotion = () => {
      actions.Idle?.reset().play();
      actions.Walk?.reset().play();
      if (actions.Walk) actions.Walk.weight = 0;
      if (actions.Run) {
        actions.Run.reset().play();
        actions.Run.weight = 0;
      }
    };

    if (activity === 'idle') {
      typing.current = null;
      restoreRest(rest);
      clone.position.y = 0;
      playLocomotion();
      return;
    }

    // Sitting / dancing are hand-posed: silence the mixer so it stops writing bones
    for (const action of Object.values(actions)) action?.stop();
    restoreRest(rest);

    if (activity === 'sitting') {
      const kind = characterTransient.seat?.kind ?? 'desk';
      // Drop the body so the hip joint rests on the cushion instead of hovering
      // at standing height (task chair 0.51 m, lounge chair 0.47 m)
      clone.position.y = 0;
      clone.updateMatrixWorld(true);
      const hipY = bones.hips?.getWorldPosition(new THREE.Vector3()).y ?? 0;
      clone.position.y = (kind === 'cafe' ? 0.52 : 0.56) - hipY;
      applyPose(bones, kind, 0.5);
      typing.current =
        kind === 'cafe'
          ? null
          : {
              spine: new WorldXRotator(bones.spine),
              head: new WorldXRotator(bones.head),
              lHand: new WorldXRotator(bones.lForeArm),
              rHand: new WorldXRotator(bones.rForeArm),
            };
    } else {
      typing.current = null;
      clone.position.y = 0;
    }
  }, [activity, actions, bones, clone, rest]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (activity === 'dancing') {
      // rotateBoneWorld composes onto the current rotation, so rebuild from rest each frame
      restoreRest(rest);
      applyDancePose(bones, t);
      return;
    }

    if (activity === 'sitting') {
      const ty = typing.current;
      if (ty) {
        // Breathing plus quick alternating forearm taps on the laptop, with
        // "thinking" pauses — the same cadence as the seated crowd
        const breathe = Math.sin(t * 1.6) * 0.02;
        ty.spine.set(-breathe);
        ty.head.set(-breathe * 0.5);
        const burst = Math.sin(t * 0.45) > -0.35 ? 1 : 0;
        ty.lHand.set(-Math.max(0, Math.sin(t * 7)) * 0.07 * burst);
        ty.rHand.set(-Math.max(0, Math.sin(t * 7 + Math.PI)) * 0.07 * burst);
      }
      return;
    }

    const speed = characterTransient.speed;
    const walk = THREE.MathUtils.clamp(speed / 2.2, 0, 1);
    const run = THREE.MathUtils.clamp((speed - 2.2) / 1.2, 0, 1);
    if (actions.Idle) actions.Idle.weight = 1 - walk;
    if (actions.Walk) actions.Walk.weight = walk * (1 - run);
    if (actions.Run) actions.Run.weight = run;
  });

  // Rest-relative retargeting keeps the VALID rig's own facing (+Z), which
  // already matches the controller's heading.
  return <primitive object={clone} />;
}

useGLTF.preload(PLAYER_MODEL);
useGLTF.preload(SOLDIER_URL);
