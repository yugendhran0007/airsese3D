import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PRESENTATION_SCENES } from '../config/scenarios';
import { presentationProgress } from '../simulation/scenarioPlayer';
import { characterTransient } from '../state/characterStore';
import { useUiStore } from '../state/uiStore';

const tmpTarget = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

/**
 * Three camera modes: orbit (default), follow (chase cam behind the
 * character), cinematic (presentation keyframes). Transitions are damped.
 */
export function CameraRig() {
  const cameraMode = useUiStore((s) => s.cameraMode);
  const presentationScene = useUiStore((s) => s.presentationScene);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lookAt = useRef(new THREE.Vector3(0, 1, 0));
  const gl = useThree((s) => s.gl);

  // Follow mode: mouse drag orbits around the character (see them from the
  // front, back or side), wheel zooms. Listeners live on the canvas so DOM
  // panels keep their own pointer events.
  useEffect(() => {
    if (cameraMode !== 'follow') return;
    const el = gl.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    let moved = 0;
    const down = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const ct = characterTransient;
      ct.camYaw -= dx * 0.008;
      ct.camPitch = THREE.MathUtils.clamp(ct.camPitch + dy * 0.006, 0.05, 1.35);
    };
    const up = (e: PointerEvent) => {
      // A real drag must not also register as a click-to-walk
      if (moved > 6) e.stopPropagation();
      dragging = false;
    };
    const wheel = (e: WheelEvent) => {
      characterTransient.camDist = THREE.MathUtils.clamp(characterTransient.camDist + e.deltaY * 0.004, 1.6, 12);
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('wheel', wheel);
    };
  }, [cameraMode, gl]);

  useFrame((state, dt) => {
    const cam = state.camera;
    const k = 1 - Math.exp(-2.2 * dt);

    if (cameraMode === 'follow') {
      const ct = characterTransient;
      // Spherical orbit around the character: yaw relative to heading, pitch above the floor
      const yaw = ct.heading + ct.camYaw;
      const horiz = ct.camDist * Math.cos(ct.camPitch);
      const px = ct.position.x - Math.sin(yaw) * horiz;
      const pz = ct.position.z - Math.cos(yaw) * horiz;
      tmpTarget.set(px, 1.2 + ct.camDist * Math.sin(ct.camPitch), pz);
      cam.position.lerp(tmpTarget, k);
      lookAt.current.lerp(tmpLook.set(ct.position.x, 1.2, ct.position.z), Math.min(1, k * 2));
      cam.lookAt(lookAt.current);
    } else if (cameraMode === 'cinematic') {
      const scene = PRESENTATION_SCENES[presentationScene];
      if (scene) {
        // Slow dolly from `position` to `to` across the scene (ease-in-out), damped
        const p = presentationProgress();
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const to = scene.camera.to ?? scene.camera.position;
        tmpTarget.set(
          THREE.MathUtils.lerp(scene.camera.position[0], to[0], e),
          THREE.MathUtils.lerp(scene.camera.position[1], to[1], e),
          THREE.MathUtils.lerp(scene.camera.position[2], to[2], e),
        );
        cam.position.lerp(tmpTarget, k * 0.8);
        lookAt.current.lerp(tmpLook.set(scene.camera.lookAt[0], scene.camera.lookAt[1], scene.camera.lookAt[2]), k * 0.6);
        cam.lookAt(lookAt.current);
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode === 'orbit'}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={70}
      maxPolarAngle={Math.PI / 2.05}
      target={[0, 1, 0]}
    />
  );
}
