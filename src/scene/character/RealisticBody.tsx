import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { characterTransient } from '../../state/characterStore';
import { getRetargetedClips, normalizeHeight, PLAYER_MODEL, prepareAvatarSource } from '../people/realisticPeople';

const SOLDIER_URL = '/models/Soldier.glb';

/**
 * Realistic animated human: a VALID business avatar driven by the Soldier's
 * Mixamo Idle/Walk/Run clips retargeted onto its rig. Animation weights
 * crossfade with the controller's live speed.
 */
export function RealisticBody() {
  const { scene } = useGLTF(PLAYER_MODEL);
  const soldier = useGLTF(SOLDIER_URL);
  const clone = useMemo(() => {
    prepareAvatarSource(scene);
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        (o as THREE.Mesh).frustumCulled = false;
      }
    });
    normalizeHeight(c, 1.74);
    return c;
  }, [scene]);
  const clips = useMemo(() => getRetargetedClips(soldier, scene), [soldier, scene]);
  const { actions } = useAnimations(clips, clone);

  useEffect(() => {
    actions.Idle?.play();
    actions.Walk?.play();
    if (actions.Walk) actions.Walk.weight = 0;
    if (actions.Run) {
      actions.Run.play();
      actions.Run.weight = 0;
    }
  }, [actions]);

  useFrame(() => {
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
