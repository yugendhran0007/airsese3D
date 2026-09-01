import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { characterTransient, jump, standUp, toggleDance, useCharacterStore, walkToSeat } from '../../state/characterStore';
import { useUiStore } from '../../state/uiStore';
import { zoneAt } from '../../simulation/zones';
import { engine } from '../../simulation/engine';
import { useKeyboard } from '../../hooks/useKeyboard';
import { bestAirSeat, nearestFreeSeat } from './seatPicking';
import { buildNavGrid, findPath } from './navigation';
import type { OfficeLayout } from '../office/officeLayout';

const WALK_SPEED = 3.2; // m/s
const ZOOM_SPEED = 4.0; // m/s for Q (in) / Shift (out)
/** rad/s for Ctrl + ← / → turn-on-the-spot — a full circle in about 2.4 s. */
const TURN_SPEED = 2.6;
const ARRIVE_RADIUS = 0.25;
/**
 * How close counts as "at the chair".
 *
 * Deliberately looser than a floor click: the seat owns the sitter's placement
 * once seated, so the avatar snaps into the chair regardless, and requiring the
 * walker to land within 0.2 m meant a route that stopped a hand's width short —
 * against a neighbouring chair, say — never seated at all.
 */
const SEAT_ARRIVE_RADIUS = 0.3;
const GRAVITY = 11; // m/s^2
/**
 * The walker's own radius. Collision is resolved against obstacles *inflated*
 * by this, so the body stops against a table rather than its centre point
 * reaching the table's edge — which is what let the avatar visibly overlap
 * furniture even while the collider said it was outside.
 */
const BODY_RADIUS = 0.3;
/** Resolution passes per frame, so touching two obstacles settles instead of
 *  bouncing between them. */
const COLLIDE_PASSES = 3;

/**
 * Does this obstacle contain the point, allowing for the walker's own radius?
 *
 * Used to let F-to-sit through: a desk seat sits *inside* its pod's footprint
 * by design, so the walk to it has to be allowed through the very obstacle that
 * models the pod. Testing containment rather than a fixed exemption radius is
 * what makes this work for a 4 x 3.2 m pod as well as for a chair.
 */
function obstacleHolds(ob: { x: number; z: number; r?: number; hw?: number; hd?: number }, x: number, z: number, pad: number) {
  if (ob.r !== undefined) return Math.hypot(x - ob.x, z - ob.z) < ob.r + pad;
  if (ob.hw !== undefined && ob.hd !== undefined) {
    return Math.abs(x - ob.x) < ob.hw + pad && Math.abs(z - ob.z) < ob.hd + pad;
  }
  return false;
}
/**
 * How far the avatar will walk to reach a seat when pressing F *if* air quality
 * cannot decide it — the fallback when every zone reads the same.
 */
const SIT_REACH = 6;

/**
 * Movement with room-bounds clamping and circle repulsion against desk pods.
 * Three input schemes coexist:
 *  - **WASD and the arrow keys are the same thing**: a camera-relative walk
 *    vector, where W / ↑ is always "away from the viewer", and **the body turns
 *    to face wherever it is actually going**. Arrows used to be a separate
 *    "controlled mode" relative to the avatar's own facing, with the heading
 *    pinned so that ← / → side-stepped and ↓ walked backwards without turning.
 *    That reads as a fault rather than a feature: press left and the avatar
 *    slides sideways still facing away, looking dragged rather than walked. A
 *    body that does not turn toward its direction of travel has no apparent
 *    intent, so nothing pins the heading any more.
 *  - Ctrl + ← / → (or Ctrl + A / D) turns the body on the spot through a full
 *    circle. Holding Ctrl suppresses the walk those same keys would otherwise
 *    do, so the avatar pivots instead of moving off. The
 *    chase camera stores its yaw *relative to* `heading` (see CameraRig), so
 *    the view swings round with the body and you end up looking wherever you
 *    turned to face — which is the point of turning rather than walking off.
 *  - Click-to-walk (FloorClickTarget) toward a floor point, or onto a seat
 *    marker (SeatTargets) which seats the avatar at its laptop on arrival.
 * F sits at / stands up from the nearest free seat, Space (or J) jumps, G
 * toggles the dance emote; any movement input cancels sitting or dancing.
 * Drives `characterTransient` and pushes zone crossings into the character store.
 */
export function useCharacterController(groupRef: React.RefObject<THREE.Group | null>, layout: OfficeLayout) {
  const keys = useKeyboard();
  const velocity = useRef(new THREE.Vector3());
  const walkPhase = useRef(0);
  /** Planned route for the current click-to-walk target, and what it was planned for. */
  const path = useRef<{ x: number; z: number }[]>([]);
  const plannedFor = useRef<{ x: number; z: number } | null>(null);
  /** Stall watchdog: where we were, how long we have been there, and whether we already replanned. */
  const stall = useRef({ x: 0, z: 0, t: 0, replanned: false });

  // The walkability grid only changes when the office does.
  const nav = useMemo(
    () => buildNavGrid(layout, engine.params.room.width, engine.params.room.length, BODY_RADIUS),
    [layout],
  );

  // F sit/stand, G dance, J jump — on the keydown event itself (edge-triggered),
  // not the frame poll: a quick tap can begin and end inside one frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const ct = characterTransient;
      if (e.code === 'KeyF') {
        if (ct.seat || useCharacterStore.getState().activity === 'dancing') {
          standUp();
        } else {
          // Pick by air, not by proximity. CO₂ builds where people are and
          // clears where the vents reach, so the nearest free chair is often
          // the one in the air you just walked out of. `bestAirSeat` weighs
          // the zone's CO₂ and status against the walk, and only crosses the
          // office when the air there is genuinely better.
          const seat =
            bestAirSeat(layout, ct.position.x, ct.position.z) ??
            nearestFreeSeat(layout, ct.position.x, ct.position.z, SIT_REACH);
          if (seat) walkToSeat(seat);
        }
      } else if (e.code === 'KeyG') {
        toggleDance();
      } else if (e.code === 'KeyJ' || e.code === 'Space') {
        if (e.code === 'Space') {
          // Space is shared, so it yields to whoever has a better claim on it.
          // During a scripted presentation it steps to the next scene
          // (PresentationOverlay owns it then), and with a control focused it
          // must still activate that control — pressing Space right after
          // clicking a button should press the button again, not launch the
          // avatar over the desks.
          if (useUiStore.getState().activeScenario === 'presentation') return;
          if (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SELECT') return;
          e.preventDefault(); // otherwise the page scrolls
        }
        jump();
      } else if (e.code === 'Escape') {
        // Edge-triggered here for the same reason F/G/J are: the frame poll
        // reads a key map that keyup clears, so a tap that starts and ends
        // inside one frame is never seen. At 60 fps that lost roughly one tap
        // in five; at 20 fps on a large display it lost most of them, and Esc
        // appeared to have simply stopped working.
        const ui = useUiStore.getState();
        if (ui.cameraMode === 'follow') ui.setCameraMode('orbit');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout]);

  useFrame((state, rawDt) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(rawDt, 0.1);
    const ct = characterTransient;
    // Stall watchdog. No collider and no planner is perfect, and the failure
    // mode that actually matters to a user is the avatar standing still against
    // some furniture forever because it still believes it is walking somewhere.
    // If a target is live but the walker has not moved for a beat: replan once,
    // and if that does not help either, take the seat if we are close enough to
    // one, otherwise give up the target so control returns to the player.
    if (ct.target) {
      const moved = Math.hypot(ct.position.x - stall.current.x, ct.position.z - stall.current.z);
      if (moved > 0.08) {
        stall.current = { x: ct.position.x, z: ct.position.z, t: 0, replanned: stall.current.replanned };
      } else {
        stall.current.t += dt;
        if (stall.current.t > 1.0) {
          stall.current.t = 0;
          if (!stall.current.replanned) {
            stall.current.replanned = true;
            path.current = findPath(nav, ct.position, ct.target) ?? [];
          } else if (ct.pendingSeat && Math.hypot(ct.target.x - ct.position.x, ct.target.z - ct.position.z) < 1.5) {
            ct.seat = ct.pendingSeat;
            ct.pendingSeat = null;
            ct.target = null;
            useCharacterStore.getState().setActivity('sitting');
          } else {
            ct.target = null;
            ct.pendingSeat = null;
          }
        }
      }
    } else {
      stall.current.replanned = false;
    }

    // Any route belongs to a live target. Dropping it the moment the target
    // goes (keyboard input, arrival, sitting down) stops a stale path being
    // reused if the same point is clicked again from somewhere else.
    if (!ct.target && plannedFor.current) {
      plannedFor.current = null;
      path.current = [];
    }

    // --- Input intent (camera-relative on X/Z) ---
    let ix = 0;
    let iz = 0;
    const k = keys.current;
    if (k.KeyW) iz -= 1;
    if (k.KeyS) iz += 1;
    if (k.KeyA) ix -= 1;
    if (k.KeyD) ix += 1;

    // Arrows drive the same camera-relative vector as WASD.
    //
    // They used to be a separate "controlled mode" relative to the avatar's own
    // facing, with the heading pinned: left/right side-stepped and down walked
    // backwards, both without turning the body. That reads as a bug rather than
    // a feature — you press left, the avatar slides left still facing away, and
    // it looks like the character is being dragged rather than walking. A body
    // that does not turn toward where it is going has no apparent intent. Both
    // schemes now steer the same way and the heading follows the motion that
    // actually happened, so any change of direction turns the body to face it.
    if (k.ArrowUp) iz -= 1;
    if (k.ArrowDown) iz += 1;
    if (k.ArrowLeft) ix -= 1;
    if (k.ArrowRight) ix += 1;
    // Q zooms the follow camera in, Shift zooms out (mouse drag orbits, see CameraRig)
    if (k.KeyQ) ct.camDist = Math.max(1.6, ct.camDist - ZOOM_SPEED * dt);
    if (k.ShiftLeft || k.ShiftRight) ct.camDist = Math.min(12, ct.camDist + ZOOM_SPEED * dt);
    // Ctrl + left/right: turn the whole body on the spot. Ctrl zeroes the
    // translation those keys carry so the avatar pivots rather than walking.
    let turn = 0;
    if (k.ControlLeft || k.ControlRight) {
      if (k.ArrowLeft || k.KeyA) turn += 1;
      if (k.ArrowRight || k.KeyD) turn -= 1;
      ix = 0;
      iz = 0;
    }

    // Any movement input leaves the chair / stops dancing — turning counts, or
    // Ctrl would appear dead while seated, since a seat owns its sitter's facing.
    const moving = ix !== 0 || iz !== 0;
    if ((moving || turn !== 0) && (ct.seat || useCharacterStore.getState().activity === 'dancing')) standUp();
    if (turn !== 0) {
      ct.heading += turn * TURN_SPEED * dt;
      ct.target = null; // turning cancels a click-to-walk destination
      const ui = useUiStore.getState();
      if (ui.cameraMode === 'orbit') ui.setCameraMode('follow');
    }
    const activity = useCharacterStore.getState().activity;

    let vx = 0;
    let vz = 0;
    if (ct.seat) {
      // Parked on the chair: the seat owns position and facing
      velocity.current.set(0, 0, 0);
      ct.target = null;
    } else if (ix !== 0 || iz !== 0) {
      // Keyboard overrides click target
      ct.target = null;
      // Move relative to camera yaw so "W" is always "away from viewer"
      const camDir = new THREE.Vector3();
      state.camera.getWorldDirection(camDir);
      const yaw = Math.atan2(camDir.x, camDir.z);
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const len = Math.hypot(ix, iz) || 1;
      const nx = ix / len;
      const nz = iz / len;
      vx = (nx * cos + nz * sin) * WALK_SPEED;
      vz = (-nx * sin + nz * cos) * WALK_SPEED;
      // Auto-enter follow cam on first key press
      const ui = useUiStore.getState();
      if (ui.cameraMode === 'orbit') ui.setCameraMode('follow');
    } else if (ct.target) {
      // Plan a route the first time this target is seen, then follow it.
      // Walking straight at the target only works in an empty room: with desk
      // runs in the way the walker ends up pressed flat against a desk face
      // with no sideways input to slide along it, and just stops there.
      if (!plannedFor.current || plannedFor.current.x !== ct.target.x || plannedFor.current.z !== ct.target.z) {
        plannedFor.current = { x: ct.target.x, z: ct.target.z };
        // Seats are planned for too. A seat is deliberately inside furniture, so
        // it is never a walkable cell — the planner routes to the nearest one
        // beside it and appends the seat as the final waypoint, and the
        // exemption above lets the last leg walk in. Walking straight at a seat
        // instead only works when nothing is in the way, which is false for the
        // conference hall: its chairs are behind a glass wall with one door.
        path.current = findPath(nav, ct.position, ct.target) ?? [];
      }
      // Retire waypoints as they are reached; the last one is the target.
      while (path.current.length > 1) {
        const wp = path.current[0];
        if (Math.hypot(wp.x - ct.position.x, wp.z - ct.position.z) > 0.35) break;
        path.current.shift();
      }
      const aim = path.current.length ? path.current[0] : ct.target;
      const dx = aim.x - ct.position.x;
      const dz = aim.z - ct.position.z;
      const dist = Math.hypot(dx, dz);
      const toTarget = Math.hypot(ct.target.x - ct.position.x, ct.target.z - ct.position.z);
      if (toTarget < (ct.pendingSeat ? SEAT_ARRIVE_RADIUS : ARRIVE_RADIUS)) {
        ct.target = null;
        path.current = [];
        plannedFor.current = null;
        if (ct.pendingSeat) {
          // Arrived at the chair — sit down at the laptop
          ct.seat = ct.pendingSeat;
          ct.pendingSeat = null;
          useCharacterStore.getState().setActivity('sitting');
        }
      } else {
        const speed = Math.min(WALK_SPEED, dist * 2.5 + 0.4);
        vx = (dx / dist) * speed;
        vz = (dz / dist) * speed;
      }
    }

    // Smooth acceleration
    velocity.current.x += (vx - velocity.current.x) * Math.min(1, dt * 10);
    velocity.current.z += (vz - velocity.current.z) * Math.min(1, dt * 10);

    let nextX = ct.position.x + velocity.current.x * dt;
    let nextZ = ct.position.z + velocity.current.z * dt;

    // Desk-pod circle repulsion. A chair lives inside its pod's circle, so
    // while walking to a seat the pod that contains the target is exempt —
    // otherwise the avatar slides around the rim forever and never arrives.
    // Collision. Obstacles are inflated by the walker's own radius, resolved
    // over a few passes so that standing in the corner between two of them
    // settles rather than ping-ponging, and the result is fed back into the
    // velocity below so the walk animation and facing follow where the body
    // actually went.
    for (let pass = 0; pass < COLLIDE_PASSES; pass++) {
      let hit = false;
      for (const ob of layout.obstacles) {
        // Walking to a seat is allowed through whatever contains that seat, and
        // past the chairs immediately around it. Taking a free chair between two
        // occupied ones means squeezing between them, which is what a person
        // does; without this, adding chairs to the collider quietly made some
        // free seats unreachable and F-to-sit simply failed on them.
        if (ct.pendingSeat && ct.target) {
          if (obstacleHolds(ob, ct.target.x, ct.target.z, BODY_RADIUS + 0.15)) continue;
          if (ob.r !== undefined && ob.r <= 0.5 && Math.hypot(ct.target.x - ob.x, ct.target.z - ob.z) < 1.0) continue;
        }
        if (ob.r !== undefined) {
          const rad = ob.r + BODY_RADIUS;
          const dx = nextX - ob.x;
          const dz = nextZ - ob.z;
          const d = Math.hypot(dx, dz);
          if (d >= rad || d <= 1e-4) continue;
          // Already inside before this step (stood up out of a chair, layout
          // changed underneath): let them walk out — no closer to the centre
          // than they were, but never ejected.
          const was = Math.hypot(ct.position.x - ob.x, ct.position.z - ob.z);
          const keep = was < rad ? Math.max(was, d) : rad;
          if (d >= keep) continue;
          nextX = ob.x + (dx / d) * keep;
          nextZ = ob.z + (dz / d) * keep;
          hit = true;
        } else if (ob.hw !== undefined && ob.hd !== undefined) {
          const hw = ob.hw + BODY_RADIUS;
          const hd = ob.hd + BODY_RADIUS;
          const dx = nextX - ob.x;
          const dz = nextZ - ob.z;
          const px = hw - Math.abs(dx);
          const pz = hd - Math.abs(dz);
          if (px <= 0 || pz <= 0) continue;
          // Push out along the shallower axis — the nearest way out, which is
          // what makes sliding along a desk run feel like sliding rather than
          // catching on a corner.
          const wasX = hw - Math.abs(ct.position.x - ob.x);
          const wasZ = hd - Math.abs(ct.position.z - ob.z);
          if (wasX > 0 && wasZ > 0) {
            // Inside already — a seated avatar sits well inside its own pod, so
            // ejecting here would fling them across the aisle on standing up.
            // Only refuse to go deeper on whichever axis is the nearest exit.
            if (wasX <= wasZ) {
              if (px > wasX) nextX = ct.position.x;
            } else if (pz > wasZ) {
              nextZ = ct.position.z;
            }
            continue;
          }
          if (px < pz) nextX = ob.x + (dx < 0 ? -hw : hw);
          else nextZ = ob.z + (dz < 0 ? -hd : hd);
          hit = true;
        }
      }
      if (!hit) break;
    }

    // Room bounds
    const { width: W, length: L } = engine.params.room;
    nextX = Math.max(-W / 2 + 0.5, Math.min(W / 2 - 0.5, nextX));
    nextZ = Math.max(-L / 2 + 0.5, Math.min(L / 2 - 0.5, nextZ));

    // The seat, not the walk integrator, owns the seated pose's placement
    if (ct.seat) {
      nextX = ct.seat.x - Math.sin(ct.seat.angle) * 0.28;
      nextZ = ct.seat.z - Math.cos(ct.seat.angle) * 0.28;
      ct.heading = ct.seat.angle;
    }

    // Jump arc (runs independently of the walk state so you can hop while moving)
    if (ct.jumpVel !== 0 || ct.yOffset > 0) {
      ct.jumpVel -= GRAVITY * dt;
      ct.yOffset += ct.jumpVel * dt;
      if (ct.yOffset <= 0) {
        ct.yOffset = 0;
        ct.jumpVel = 0;
      }
    }
    if (activity === 'dancing') ct.emoteT += dt;

    // Velocity follows the motion that actually happened, so a walker pressed
    // against a desk stops instead of grinding at full speed into it, and the
    // heading (derived from velocity below) never points into the obstacle.
    if (dt > 1e-4) {
      velocity.current.x = (nextX - ct.position.x) / dt;
      velocity.current.z = (nextZ - ct.position.z) / dt;
    }
    ct.position.x = nextX;
    ct.position.z = nextZ;
    ct.speed = Math.hypot(velocity.current.x, velocity.current.z);
    if (ct.speed > 0.1) {
      // Always face where the body actually went. Nothing pins the heading any
      // more: a character that walks one way while facing another reads as a
      // fault, not as a manoeuvre.
      ct.heading = Math.atan2(velocity.current.x, velocity.current.z);
      walkPhase.current += dt * ct.speed * 3.4;
    }

    // Apply to mesh: position, facing, walk bob
    const bob = Math.abs(Math.sin(walkPhase.current * 2)) * 0.035 * Math.min(1, ct.speed);
    const danceBounce = activity === 'dancing' ? Math.abs(Math.sin(ct.emoteT * 5)) * 0.06 : 0;
    group.position.set(nextX, bob + ct.yOffset + danceBounce, nextZ);
    const targetRot = ct.heading;
    let dr = targetRot - group.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    group.rotation.y += dr * Math.min(1, dt * 12);

    // Zone crossing → store (HUD)
    const zone = zoneAt(nextX, nextZ);
    if (useCharacterStore.getState().zone !== zone) {
      useCharacterStore.getState().setZone(zone);
    }
  });

  return { walkPhase };
}
