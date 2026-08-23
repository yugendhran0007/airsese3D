import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { characterTransient, useCharacterStore } from '../../state/characterStore';
import { useUiStore } from '../../state/uiStore';
import { zoneAt } from '../../simulation/zones';
import { engine } from '../../simulation/engine';
import { useKeyboard } from '../../hooks/useKeyboard';
import type { OfficeLayout } from '../office/officeLayout';

const WALK_SPEED = 3.2; // m/s
const BACK_SPEED = 2.0; // m/s — walking backwards is slower
const ZOOM_SPEED = 4.0; // m/s for Q (in) / Shift (out)
const ARRIVE_RADIUS = 0.25;

/**
 * Movement with room-bounds clamping and circle repulsion against desk pods.
 * Three input schemes coexist:
 *  - Arrow keys = "controlled mode", relative to the avatar's own facing:
 *    ↑ forward, ↓ backward (facing kept), → / ← side-step right/left
 *    (facing kept); Q / Shift zoom the chase camera, mouse drag orbits it.
 *  - WASD = camera-relative (W is always "away from the viewer").
 *  - Click-to-walk (FloorClickTarget) toward a floor point.
 * Drives `characterTransient` and pushes zone crossings into the character store.
 */
export function useCharacterController(groupRef: React.RefObject<THREE.Group | null>, layout: OfficeLayout) {
  const keys = useKeyboard();
  const velocity = useRef(new THREE.Vector3());
  const walkPhase = useRef(0);

  useFrame((state, rawDt) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(rawDt, 0.1);
    const ct = characterTransient;

    // --- Input intent (camera-relative on X/Z) ---
    let ix = 0;
    let iz = 0;
    const k = keys.current;
    // ESC leaves follow-cam (presentation mode handles its own ESC)
    if (k.Escape) {
      const ui = useUiStore.getState();
      if (ui.cameraMode === 'follow') ui.setCameraMode('orbit');
      k.Escape = false;
    }
    if (k.KeyW) iz -= 1;
    if (k.KeyS) iz += 1;
    if (k.KeyA) ix -= 1;
    if (k.KeyD) ix += 1;

    // Controlled mode: arrows relative to the avatar's heading, Q/E turn
    let fwd = 0; // +1 forward, -1 back
    let side = 0; // +1 right, -1 left
    if (k.ArrowUp) fwd += 1;
    if (k.ArrowDown) fwd -= 1;
    if (k.ArrowRight) side += 1;
    if (k.ArrowLeft) side -= 1;
    // Q zooms the follow camera in, Shift zooms out (mouse drag orbits, see CameraRig)
    if (k.KeyQ) ct.camDist = Math.max(1.6, ct.camDist - ZOOM_SPEED * dt);
    if (k.ShiftLeft || k.ShiftRight) ct.camDist = Math.min(12, ct.camDist + ZOOM_SPEED * dt);
    let lockHeading = false;

    let vx = 0;
    let vz = 0;
    if (fwd !== 0 || side !== 0) {
      ct.target = null;
      // Heading basis: forward = (sin h, cos h); the avatar's right = (-cos h, sin h)
      const fx = Math.sin(ct.heading);
      const fz = Math.cos(ct.heading);
      const rx = -fz;
      const rz = fx;
      const speed = fwd < 0 ? BACK_SPEED : WALK_SPEED;
      const len = Math.hypot(fwd, side) || 1;
      vx = ((fx * fwd + rx * side) / len) * speed;
      vz = ((fz * fwd + rz * side) / len) * speed;
      // Facing stays put while reversing/side-stepping (no spin-around)
      lockHeading = true;
      const ui = useUiStore.getState();
      if (ui.cameraMode === 'orbit') ui.setCameraMode('follow');
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
      const dx = ct.target.x - ct.position.x;
      const dz = ct.target.z - ct.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < ARRIVE_RADIUS) {
        ct.target = null;
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

    // Desk-pod circle repulsion
    for (const ob of layout.obstacles) {
      const dx = nextX - ob.x;
      const dz = nextZ - ob.z;
      const d = Math.hypot(dx, dz);
      if (d < ob.r && d > 1e-4) {
        nextX = ob.x + (dx / d) * ob.r;
        nextZ = ob.z + (dz / d) * ob.r;
      }
    }

    // Room bounds
    const { width: W, length: L } = engine.params.room;
    nextX = Math.max(-W / 2 + 0.5, Math.min(W / 2 - 0.5, nextX));
    nextZ = Math.max(-L / 2 + 0.5, Math.min(L / 2 - 0.5, nextZ));

    ct.position.x = nextX;
    ct.position.z = nextZ;
    ct.speed = Math.hypot(velocity.current.x, velocity.current.z);
    if (ct.speed > 0.1) {
      if (!lockHeading) ct.heading = Math.atan2(velocity.current.x, velocity.current.z);
      walkPhase.current += dt * ct.speed * 3.4;
    }

    // Apply to mesh: position, facing, walk bob
    group.position.set(nextX, Math.abs(Math.sin(walkPhase.current * 2)) * 0.035 * Math.min(1, ct.speed), nextZ);
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
