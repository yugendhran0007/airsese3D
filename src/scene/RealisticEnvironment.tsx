import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { OFFICE_THEMES } from '../config/officeThemes';
import { useUiStore } from '../state/uiStore';

/**
 * High-dynamic-range image-based lighting for realistic mode, with zero
 * network assets: a purpose-built "IT office" light rig (a bright daylight
 * window wall, rows of linear LED ceiling strips, warm bounce off the floor
 * and a neutral wall box) is baked through PMREM into a proper HDR
 * environment map. Compared with three's generic RoomEnvironment this gives
 * directional daylight in reflections, crisp LED highlights on monitors,
 * chairs and glass, and skin that reads as lit from above rather than
 * uniformly grey. Emissive values well above 1.0 are intentional — PMREM
 * keeps them as HDR so tone mapping can roll the highlights off.
 */
function buildOfficeEnvironment(accent: string): THREE.Scene {
  const scene = new THREE.Scene();
  const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation, intensity: number) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.BackSide }),
    );
    return m;
  };
  const panel = (w: number, h: number, color: THREE.ColorRepresentation, intensity: number) =>
    new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );

  // Room box: light grey walls, slightly darker floor bounce via a separate plane
  const room = box(40, 12, 40, '#c9ccd2', 0.55);
  room.position.y = 4;
  scene.add(room);

  // Floor: warm carpet bounce
  const floor = panel(40, 40, '#8f8a84', 0.45);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.98;
  scene.add(floor);

  // Daylight window wall (−z): big cool HDR panel with mullions splitting it
  for (let i = 0; i < 6; i++) {
    const win = panel(5.6, 6.5, '#dfeaff', 9.0);
    win.position.set(-15 + i * 6, 3.2, -19.9);
    scene.add(win);
  }
  // Sky glow above the windows
  const sky = panel(40, 2.5, '#9fc3ff', 5.0);
  sky.position.set(0, 8.5, -19.8);
  scene.add(sky);

  // Linear LED ceiling strips: three rows, crisp warm-white highlights
  for (let r = -1; r <= 1; r++) {
    for (let i = 0; i < 5; i++) {
      const led = panel(6.0, 0.35, '#fff6e6', 18.0);
      led.rotation.x = Math.PI / 2;
      led.position.set(-14 + i * 7, 9.9, r * 9);
      scene.add(led);
    }
  }
  // Soft ceiling tile glow between the strips
  const ceil = panel(40, 40, '#f4f4f2', 1.6);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 9.97;
  scene.add(ceil);

  // Feature / accent wall (+z): subtle theme-coloured bounce behind the camera
  const feature = panel(40, 8, accent, 0.8);
  feature.position.set(0, 3, 19.9);
  feature.rotation.y = Math.PI;
  scene.add(feature);

  // Side walls: a couple of pendant-like warm spots for rim highlights on people
  for (const x of [-19.9, 19.9]) {
    for (const z of [-8, 4, 14]) {
      const spot = panel(1.2, 1.2, '#ffe2b8', 7.0);
      spot.position.set(x, 6.5, z);
      spot.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(spot);
    }
  }
  return scene;
}

export function RealisticEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const accent = OFFICE_THEMES[useUiStore((s) => s.officeTheme)].accentLight;
  const ultra = useUiStore((s) => s.ultraQuality);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const envScene = buildOfficeEnvironment(accent);
    // Small blur sigma keeps the LED strips and window edges sharp in glossy reflections
    const envTexture = pmrem.fromScene(envScene, 0.02).texture;
    scene.environment = envTexture;
    // Without the ultra point lights the IBL carries more of the ambient
    scene.environmentIntensity = ultra ? 0.55 : 0.8;
    envScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    return () => {
      scene.environment = null;
      envTexture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, accent, ultra]);

  return null;
}
