import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { OFFICE_THEMES } from '../config/officeThemes';
import { useUiStore } from '../state/uiStore';

/**
 * High-dynamic-range image-based lighting for realistic mode, with zero
 * network assets: a purpose-built "IT office" light rig (a bright daylight
 * window wall with mullions, rows of individual LED tubes in a ceiling grid,
 * warm bounce off the floor and a neutral wall box) is baked through PMREM
 * into a proper HDR environment map.
 *
 * Resolution is tiered (`options.size` on `fromScene`): the PMREM cube is
 * 128² in Fast, 256² in Balanced and **1024²** in 8K/ultra, so glossy
 * surfaces — monitors, glass partitions, the polished floor, chair plastics —
 * reflect the *shape* of the windows and LED tubes instead of a soft blur.
 * The rig is modelled with real gaps (mullions between panes, dark runs
 * between tubes) because a flat panel bakes into a featureless smear no
 * matter how many pixels it gets. Emissive values well above 1.0 are
 * intentional: PMREM keeps them as HDR so tone mapping rolls the highlights
 * off instead of clipping them.
 *
 * The cube camera sits at eye height rather than the origin, so reflections
 * carry the same up/down asymmetry a person standing on the floor would see.
 */
function buildOfficeEnvironment(accent: string, detailed: boolean): THREE.Scene {
  const scene = new THREE.Scene();
  const panel = (w: number, h: number, color: THREE.ColorRepresentation, intensity: number) =>
    new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );

  // Room box: light grey walls (kept dim — it is bounce, not a light source)
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(40, 12, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9ccd2').multiplyScalar(0.55), side: THREE.BackSide }),
  );
  room.position.y = 4;
  scene.add(room);

  // Floor: warm carpet bounce, with a brighter aisle so the polished-floor
  // reflection has a visible bright band running through it
  const floor = panel(40, 40, '#8f8a84', 0.45);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.98;
  scene.add(floor);
  if (detailed) {
    const aisle = panel(4.5, 40, '#b9b4ad', 0.7);
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(0, -1.95, 0);
    scene.add(aisle);
  }

  // Daylight window wall (−z): six bays, each split into panes by dark
  // mullions. The gaps are what make a window read as a window in a reflection.
  const bays = 6;
  for (let i = 0; i < bays; i++) {
    const cx = -15 + i * 6;
    if (detailed) {
      // Two panes per bay, separated by the mullion gap
      for (const [dx, w] of [[-1.45, 2.6], [1.45, 2.6]] as const) {
        const win = panel(w, 6.4, '#dfeaff', 9.5);
        win.position.set(cx + dx, 3.2, -19.9);
        scene.add(win);
      }
      // Transom band above, slightly cooler and brighter (sky, not view)
      const transom = panel(5.6, 1.1, '#c9deff', 12.0);
      transom.position.set(cx, 7.1, -19.88);
      scene.add(transom);
    } else {
      const win = panel(5.6, 6.5, '#dfeaff', 9.0);
      win.position.set(cx, 3.2, -19.9);
      scene.add(win);
    }
  }
  // Sky glow above the window wall
  const sky = panel(40, 2.5, '#9fc3ff', 5.0);
  sky.position.set(0, 8.8, -19.8);
  scene.add(sky);

  // Ceiling: LED tubes in rows. Detailed mode splits each run into individual
  // tubes with dark gaps between them — that cadence is what shows up as a
  // dashed highlight travelling across glossy desks and monitor bezels.
  for (let r = -1; r <= 1; r++) {
    for (let i = 0; i < 5; i++) {
      const baseX = -14 + i * 7;
      if (detailed) {
        for (const seg of [-1.55, 0, 1.55]) {
          const led = panel(1.7, 0.3, '#fff6e6', 22.0);
          led.rotation.x = Math.PI / 2;
          led.position.set(baseX + seg, 9.9, r * 9);
          scene.add(led);
        }
      } else {
        const led = panel(6.0, 0.35, '#fff6e6', 18.0);
        led.rotation.x = Math.PI / 2;
        led.position.set(baseX, 9.9, r * 9);
        scene.add(led);
      }
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

  // Side walls: warm pendant-like spots for rim highlights on people
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
  const quality = useUiStore((s) => s.quality);
  const tvMode = useUiStore((s) => s.tvMode);

  useEffect(() => {
    // The environment is baked once, not per frame, so presentation mode can
    // afford the full-resolution cube at any tier: on a 64" screen the glass,
    // chrome and screen bezels reflect it directly, and a 128²/256² bake is
    // what makes those surfaces read as flat grey smears from across a room.
    const sharpEnv = quality === 'ultra' || tvMode;
    const ultra = quality === 'ultra';
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    // The detailed rig at every tier now: a 512 bake of a simplified rig wastes
    // the resolution it was just given.
    const envScene = buildOfficeEnvironment(accent, true);
    // Sharper mip 0 at higher tiers: a smaller blur sigma preserves the window
    // and LED shapes that the extra resolution is there to capture.
    // Fast 128 -> 512 and Balanced 256 -> 512. This is the room's image-based
    // light, and it is baked ONCE: it costs a slightly longer bake at startup
    // and nothing per frame. Measured on this machine the frame rate is bound by
    // skinned-avatar vertex work, not by fragment or texture cost, so a sharper
    // environment is close to free here while being one of the largest visible
    // quality gains available — 128 is where window mullions and the LED runs
    // smear into a flat grey wash in every glass and chrome reflection.
    const envTexture = pmrem.fromScene(envScene, sharpEnv ? 0.008 : 0.014, 0.1, 100, {
      size: sharpEnv ? 1024 : 512,
      position: new THREE.Vector3(0, 1.6, 0),
    }).texture;
    scene.environment = envTexture;
    // The IBL is the room's ambient light, not a garnish on top of one: the
    // flat ambient/hemisphere terms in `Lighting` were cut back so this can
    // carry it, with the directionality a baked office rig has and a constant
    // term cannot. Ultra keeps a lower value because its four point lights add
    // their own interior fill.
    scene.environmentIntensity = ultra ? 0.85 : 1.15;
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
  }, [gl, scene, accent, quality, tvMode]);

  return null;
}
