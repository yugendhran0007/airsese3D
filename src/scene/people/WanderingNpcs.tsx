import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { useSimStore } from '../../state/simStore';
import type { OfficeLayout } from '../office/officeLayout';
import { useUiStore } from '../../state/uiStore';
import { applyFaceLod, collectFaceParts, faceLodDistance, FEMALE_MODELS, getRetargetedClips, MALE_MODELS, normalizeHeight, prepareAvatarSource, tierUrl } from './realisticPeople';
import { detailLevel } from '../../utils/autoTune';

const SOLDIER_URL = '/models/Soldier.glb';
const WALK_SPEED = 1.15; // m/s — casual office pace

/** A route point; `pause` seconds of Idle before moving on (0 = keep walking). */
export interface Waypoint {
  x: number;
  z: number;
  pause?: number;
  /** Face this way (rad) while paused — e.g. toward a meeting table. */
  face?: number;
}

/** One skinned NPC (VALID avatar, retargeted Mixamo Walk/Idle) on a waypoint loop. */
function Npc({
  url,
  female,
  route,
  startIndex,
}: {
  url: string;
  female: boolean;
  route: Waypoint[];
  startIndex: number;
}) {
  const { scene } = useGLTF(url);
  const soldier = useGLTF(SOLDIER_URL);
  const { clone, faceParts } = useMemo(() => {
    prepareAvatarSource(scene);
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      o.castShadow = true;
      // Frustum-culled, not force-drawn. Six walkers at ~7 skinned draws each is
      // 42 draws that were being submitted even when every one of them was
      // behind the camera — which, walking the office in full mode, is most of
      // the time. A skinned mesh's bind-pose sphere under-covers an animated
      // pose, so it is padded generously; the same trick the seated crowd uses.
      const sm = m as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) {
        sm.computeBoundingSphere();
        if (sm.boundingSphere) sm.boundingSphere.radius *= 1.6;
      }
      m.frustumCulled = true;
    });
    normalizeHeight(c, female ? 1.62 : 1.74);
    return { clone: c, faceParts: collectFaceParts(c) };
  }, [scene, female]);
  const clips = useMemo(() => getRetargetedClips(soldier, scene), [soldier, scene]);
  const groupRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(clips, clone);
  const target = useRef((startIndex + 1) % route.length);
  const pauseLeft = useRef(0);
  const walking = useRef(true);

  useEffect(() => {
    if (actions.Walk) {
      actions.Walk.play();
      actions.Walk.time = startIndex * 0.37; // desync strides
    }
    actions.Idle?.play();
    actions.Idle?.setEffectiveWeight(0);
  }, [actions, startIndex]);

  const setWalking = (on: boolean) => {
    if (walking.current === on) return;
    walking.current = on;
    const walk = actions.Walk;
    const idle = actions.Idle;
    if (walk && idle) {
      if (on) {
        walk.enabled = true;
        walk.setEffectiveWeight(1);
        idle.crossFadeTo(walk, 0.35, false);
      } else {
        idle.enabled = true;
        idle.setEffectiveWeight(1);
        walk.crossFadeTo(idle, 0.35, false);
      }
    }
  };

  useFrame((state, rawDt) => {
    const group = groupRef.current;
    if (!group || route.length < 2) return;
    const dt = Math.min(rawDt, 0.1);

    // Facial-detail LOD. Walkers cross the whole floor, so most of the time
    // they are far enough away that their eyes and teeth are sub-pixel — and
    // they are the characters most often seen at a distance.
    applyFaceLod(
      faceParts,
      state.camera.position.distanceTo(group.position),
      faceLodDistance(useUiStore.getState().autoTune, detailLevel().faceDist),
    );

    if (pauseLeft.current > 0) {
      pauseLeft.current -= dt;
      const wp = route[(target.current + route.length - 1) % route.length];
      if (wp.face !== undefined) {
        let dr = wp.face - group.rotation.y;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        group.rotation.y += dr * Math.min(1, dt * 4);
      }
      if (pauseLeft.current <= 0) setWalking(true);
      return;
    }

    const wp = route[target.current];
    const dx = wp.x - group.position.x;
    const dz = wp.z - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3) {
      target.current = (target.current + 1) % route.length;
      if (wp.pause) {
        pauseLeft.current = wp.pause;
        setWalking(false);
      }
      return;
    }
    group.position.x += (dx / dist) * WALK_SPEED * dt;
    group.position.z += (dz / dist) * WALK_SPEED * dt;
    const heading = Math.atan2(dx, dz);
    let dr = heading - group.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    group.rotation.y += dr * Math.min(1, dt * 6);
  });

  const start = route[startIndex];
  return (
    <group ref={groupRef} position={[start.x, 0, start.z]}>
      {/* Rest-relative retargeting keeps the rig's own +Z facing = walking direction */}
      <primitive object={clone} />
    </group>
  );
}

const P = (x: number, z: number, pause = 0, face?: number): Waypoint => ({ x, z, pause, face });

/**
 * Walk-animated employees in realistic mode: they stroll the perimeter and
 * cross aisles, step into the meeting rooms / conference hall and stand in
 * for a moment, queue at the cafeteria counter and chat by the café tables —
 * live human motion beside the seated avatars.
 */
export function WanderingNpcs({ layout }: { layout: OfficeLayout }) {
  const room = useSimStore((s) => s.params.room);
  const routes = useMemo<Waypoint[][]>(() => {
    // Aisles: side corridors along the walls, a cross aisle between the desk
    // rows (columns sit at z ≈ −0.9), the x = 0 spine to the conference door,
    // and a walkway along the cafeteria's front edge.
    const w = room.width / 2 - 1.6;
    const l = room.length / 2 - 1.6;
    const AISLE = 0.5;
    const conf = layout.conference;
    const confFront = conf.cz + conf.d / 2 + 0.8;
    const meetW = layout.areas.find((a) => a.id === 'meeting-west');
    const meetE = layout.areas.find((a) => a.id === 'meeting-east');
    const cafe = layout.areas.find((a) => a.kind === 'cafeteria');
    const walkZ = cafe ? cafe.cz - cafe.d / 2 + 0.6 : l;
    const cafeEntryX = cafe ? cafe.cx - cafe.w / 2 - 0.5 : w;
    const counterX = cafe ? cafe.cx + cafe.w / 2 - 1.2 : w;

    /** Walk in through a room's door, stand just inside beside it (clear of the table and chairs), walk out. */
    const visit = (a: { cx: number; cz: number; w: number; d: number; doorX: number }, standDx: number, face: number, stay: number): Waypoint[] => {
      const front = a.cz + a.d / 2;
      return [P(a.doorX, front + 0.8), P(a.doorX, front - 0.5), P(a.doorX + standDx, front - 0.9, stay, face), P(a.doorX, front - 0.5), P(a.doorX, front + 0.8)];
    };

    // Big loop: west corridor → cross aisle → east corridor → cafeteria walkway → front aisle
    const perimeter: Waypoint[] = [
      P(-w, l - 0.6),
      P(-w, AISLE),
      P(-w, meetW ? meetW.cz + meetW.d / 2 + 0.8 : -l, 2, 0),
      P(-w, AISLE),
      P(w, AISLE),
      P(w, meetE ? meetE.cz + meetE.d / 2 + 0.8 : -l, 2, 0),
      P(w, AISLE),
      P(w - 0.8, walkZ),
      P(cafeEntryX, walkZ),
      P(cafeEntryX, l - 0.6),
    ];
    // Spine + cross aisle, with a stop at the conference door
    const cross: Waypoint[] = [
      P(0, l - 0.6),
      P(0, AISLE),
      P(-w * 0.6, AISLE, 3),
      P(0, AISLE),
      P(conf.doorX, confFront, 4, Math.PI),
      P(0, AISLE),
      P(w * 0.45, AISLE, 2),
      P(0, AISLE),
    ];
    // Conference hall visitor via the x = 0 spine
    const confVisit: Waypoint[] = [
      P(-w * 0.35, AISLE),
      P(conf.doorX, AISLE),
      ...visit(conf, 0.35, -Math.PI * 0.75, 9),
      P(conf.doorX, AISLE),
      P(w * 0.35, AISLE, 2),
      P(0, AISLE),
    ];
    // West meeting room via the west corridor
    const meetVisit: Waypoint[] = meetW
      ? [P(-w * 0.3, AISLE), P(-w, AISLE), P(-w, meetW.cz + meetW.d / 2 + 0.8), ...visit(meetW, 0.45, -Math.PI * 0.6, 8), P(-w, meetW.cz + meetW.d / 2 + 0.8), P(-w, AISLE, 1)]
      : cross;
    // Cafeteria run: front aisle → café walkway → coffee counter → back
    const cafeRun: Waypoint[] = cafe
      ? [
          P(0, l - 0.6, 2),
          P(cafeEntryX, l - 0.6),
          P(cafeEntryX + 0.3, walkZ),
          P(counterX, walkZ, 6, Math.PI / 2),
          P(cafe.cx - 0.6, walkZ, 3, 0),
          P(cafeEntryX, walkZ),
          P(cafeEntryX, l - 0.6),
          P(-w * 0.2, l - 0.6, 2),
        ]
      : perimeter;
    // East meeting room via the east corridor
    const eastVisit: Waypoint[] = meetE
      ? [P(w * 0.5, AISLE, 2), P(w, AISLE), P(w, meetE.cz + meetE.d / 2 + 0.8), ...visit(meetE, -0.45, Math.PI * 0.6, 7), P(w, meetE.cz + meetE.d / 2 + 0.8), P(w, AISLE), P(0, AISLE, 1)]
      : perimeter;
    // Café chatters: two people meet by the tables, chat facing each other, then drift off
    const chatX = cafe ? cafe.cx - cafe.w / 2 + 1.6 : w;
    const cafeChatA: Waypoint[] = cafe
      ? [P(cafeEntryX, l - 0.6), P(cafeEntryX + 0.3, walkZ), P(chatX, walkZ, 14, Math.PI / 2), P(cafeEntryX, walkZ), P(cafeEntryX, l - 0.6, 3), P(-w * 0.5, l - 0.6, 4), P(0, l - 0.6, 2)]
      : cross;
    const cafeChatB: Waypoint[] = cafe
      ? [P(counterX, walkZ, 4, Math.PI / 2), P(chatX + 0.9, walkZ, 14, -Math.PI / 2), P(counterX, walkZ, 3, Math.PI / 2), P(cafe.cx, walkZ, 5, 0)]
      : cross;
    // Reverse perimeter (opposite direction, different pauses)
    const perimeterBack: Waypoint[] = [...perimeter].reverse().map((p) => ({ ...p, pause: p.pause ? 3 : 0 }));
    // Second conference visitor arriving from the east side
    const confVisit2: Waypoint[] = [
      P(w * 0.3, AISLE, 3),
      P(conf.doorX, AISLE),
      ...visit(conf, 0.35, -Math.PI * 0.75, 12),
      P(conf.doorX, AISLE),
      P(w * 0.3, AISLE),
      P(w, AISLE, 2),
      P(w * 0.3, AISLE),
    ];
    return [perimeter, cross, confVisit, meetVisit, cafeRun, eastVisit, cafeChatA, cafeChatB, perimeterBack, confVisit2];
  }, [room, layout]);

  const quality = useUiStore((s) => s.quality);
  void quality; // re-render when the asset tier changes
  return (
    <group>
      <Npc url={tierUrl(MALE_MODELS[3])} female={false} route={routes[0]} startIndex={0} />
      <Npc url={tierUrl(FEMALE_MODELS[4])} female={true} route={routes[1]} startIndex={0} />
      <Npc url={tierUrl(MALE_MODELS[0])} female={false} route={routes[2]} startIndex={0} />
      <Npc url={tierUrl(FEMALE_MODELS[1])} female={true} route={routes[3]} startIndex={0} />
      <Npc url={tierUrl(MALE_MODELS[4])} female={false} route={routes[4]} startIndex={0} />
      <Npc url={tierUrl(FEMALE_MODELS[0])} female={true} route={routes[5]} startIndex={0} />
      <Npc url={tierUrl(MALE_MODELS[1])} female={false} route={routes[6]} startIndex={0} />
      <Npc url={tierUrl(FEMALE_MODELS[2])} female={true} route={routes[7]} startIndex={0} />
      <Npc url={tierUrl(MALE_MODELS[2])} female={false} route={routes[8]} startIndex={3} />
      <Npc url={tierUrl(FEMALE_MODELS[3])} female={true} route={routes[9]} startIndex={0} />
    </group>
  );
}
