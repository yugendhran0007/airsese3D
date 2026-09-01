/**
 * Flowing air ribbons — the air each zone is actually getting (spec §12, §21).
 *
 * These answer the question a person in the room actually has: *is the air
 * reaching me, or am I sitting in air nobody is replacing?* One ribbon per zone
 * sweeps down from that zone's ceiling vent, curls through the space and
 * finishes at breathing height near the middle of the zone, where the people are.
 *
 * Two channels carry the meaning, and they deliberately agree:
 *
 *  - **Colour and presence together.** The ribbon runs white → red on outdoor
 *    air per person — the *same* number `HvacCard` prints, from the same
 *    `achFresh()` the engine integrates with, so the ribbon and the card cannot
 *    tell different stories. Crucially the opacity ramp starts at zero on that
 *    same value, so **white air is invisible by construction**: air that is fine
 *    draws nothing at all, the ribbon only fades in as the air degrades, and by
 *    the time you can see it it is already tinting red. The visualization stays
 *    silent while there is nothing to report, which is what makes its appearance
 *    mean something. Below a perceptible alpha the mesh's `visible` is cleared
 *    so the draw is skipped rather than blending a transparent tube.
 *  - **Motion** carries it again: the travelling streaks slow as ventilation
 *    drops and slow further as the zone goes red, so under-ventilated air
 *    visibly *stops flowing* rather than merely changing hue. A colour is read
 *    once and then stops being noticed; a change of movement keeps signalling.
 *
 * Per-frame data never enters React: the ribbons read `engine.snapshot` and
 * `engine.params` straight from `useFrame` and ease their own uniforms.
 *
 * These are now the *only* airflow visual. The ambient mote streaks that used to
 * drift from every vent (`AirflowParticles`) were removed at the user's request
 * after several passes failed to stop them reading as falling rain; recover them
 * from git history rather than rewriting them if they are ever wanted back.
 *
 * Cost is deliberately trivial — four tubes, ~3 k triangles, four draws. Measured
 * on this project, transparency and overdraw at this scale are free; the frame
 * is spent on skinned avatars, not on ribbons like these.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { STATUS_COLORS } from '../../config/constants';
import { engine } from '../../simulation/engine';
import { achFresh } from '../../simulation/physics';
import { buildZones, ZONE_IDS } from '../../simulation/zones';
import { useSimStore } from '../../state/simStore';
import { useWeatherStore } from '../../state/weatherStore';
import type { ZoneId } from '../../types/environment';

/** Outdoor air per person (L/s) at or above which a zone reads fully "flowing". */
const LPS_GOOD = 10;
/** At or below this the zone reads fully stagnant. Matches `HvacCard`'s bands. */
const LPS_BAD = 4;
/** Below this much degradation nothing is drawn at all — clean air is invisible. */
const SHOW_FROM = 0.1;
/** By this much degradation the ribbon is at full presence. */
const SHOW_FULL = 0.55;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uSpeed;     // how fast the streaks travel — this is "is it moving?"
uniform float uBad;       // 0 = fresh air reaching people, 1 = stagnant
uniform float uStrength;  // overall presence
uniform vec3 uCool;       // clean air — white, and faded to nothing
uniform vec3 uWarm;       // danger red
varying vec2 vUv;

void main() {
  float u = vUv.x;
  // Travelling bright bands along the ribbon's length: the flow itself.
  float t = u * 3.0 - uTime * uSpeed;
  float streak = pow(abs(sin(t * 3.14159265)), 12.0);
  // Fade both ends so it reads as a ribbon of moving air, not a solid tube.
  float ends = smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.82, 1.0, u));
  // Bright core along the tube with soft shoulders.
  float radial = 1.0 - abs(vUv.y * 2.0 - 1.0);
  radial = pow(max(radial, 0.0), 1.5);

  vec3 col = mix(uCool, uWarm, uBad);
  float a = (0.10 + streak * 0.9) * ends * radial * uStrength;
  gl_FragColor = vec4(col * (0.6 + streak * 1.6), a);
}
`;

/**
 * A descending swirl through one zone: out of the ceiling vent, a wide sweep,
 * then a curl that settles at breathing height near the middle of the zone.
 * Shaped after the reference imagery — a single continuous stroke of air rather
 * than a straight jet, because a straight line down from a diffuser is not what
 * a four-way cassette actually does.
 */
function zoneCurve(cx: number, cz: number, hw: number, hd: number, height: number): THREE.CatmullRomCurve3 {
  const w = hw * 0.9;
  const d = hd * 0.9;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx, height - 0.28, cz - d * 0.55),
    new THREE.Vector3(cx + w * 0.55, height - 1.05, cz - d * 0.2),
    new THREE.Vector3(cx + w * 0.25, 1.95, cz + d * 0.45),
    new THREE.Vector3(cx - w * 0.5, 1.4, cz + d * 0.15),
    new THREE.Vector3(cx - w * 0.18, 1.15, cz - d * 0.35),
    new THREE.Vector3(cx + w * 0.3, 1.05, cz - d * 0.05),
  ]);
}

interface Ribbon {
  id: ZoneId;
  geometry: THREE.TubeGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
}

export function AirflowRibbons() {
  const room = useSimStore((s) => s.params.room);

  const ribbons = useMemo<Ribbon[]>(() => {
    const zones = buildZones(room);
    const cool = new THREE.Color('#ffffff');
    const warm = new THREE.Color(STATUS_COLORS.red);
    return ZONE_IDS.map((id) => {
      const z = zones[id];
      const curve = zoneCurve(z.center[0], z.center[1], z.half[0], z.half[1], room.height);
      const geometry = new THREE.TubeGeometry(curve, 72, 0.1, 6, false);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 1 },
          uBad: { value: 0 },
          // Starts invisible: an office that is fine shows nothing.
          uStrength: { value: 0 },
          uCool: { value: cool.clone() },
          uWarm: { value: warm.clone() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = true;
      mesh.visible = false;
      return { id, geometry, material, mesh };
    });
  }, [room]);

  // Dispose the previous set when the room changes — these are built by hand,
  // so nothing else will reclaim them.
  const prev = useRef<Ribbon[]>([]);
  if (prev.current !== ribbons) {
    for (const r of prev.current) {
      r.geometry.dispose();
      r.material.dispose();
    }
    prev.current = ribbons;
  }

  useFrame((state, dt) => {
    const p = engine.params;
    const snap = engine.snapshot;
    const wind = useWeatherStore.getState().outdoor?.windSpeed ?? 10;
    const { total } = achFresh({
      ventilation: p.ventilation / 100,
      freshAir: p.freshAir / 100,
      windowsOpen: p.windowsOpen,
      doorOpen: p.doorOpen,
      windSpeedKmh: wind,
    });
    // Each zone is a quarter of the room's floor area at full height.
    const zoneVolume = (p.room.width / 2) * (p.room.length / 2) * p.room.height;
    const freshLps = (total * zoneVolume) / 3.6;
    const ventFrac = Math.min(1, (p.ventilation / 100) * (p.freshAir / 100));
    // Frame-rate independent easing, as elsewhere in the scene.
    const k = 1 - Math.exp(-dt * 2.2);

    for (const r of ribbons) {
      const reading = snap.zones.find((z) => z.id === r.id);
      const people = reading?.people ?? 0;
      // Nobody in the zone means nobody is loading the air: read it as fresh.
      const perPerson = people > 0 ? freshLps / people : Number.POSITIVE_INFINITY;
      const bad = Number.isFinite(perPerson)
        ? Math.min(1, Math.max(0, (LPS_GOOD - perPerson) / (LPS_GOOD - LPS_BAD)))
        : 0;
      // Stagnant air should visibly stop moving, not merely turn red.
      const speed = (0.3 + ventFrac * 1.8) * (1 - bad * 0.62);
      // Air that is fine is not drawn. The colour ramp starts at white and the
      // opacity ramp starts at zero on the *same* value, so white air is by
      // construction invisible: the ribbon only fades in as the air degrades,
      // and by the time it is visible it is already tinting toward red. The
      // visualization stays silent while there is nothing to say.
      const show = Math.min(1, Math.max(0, (bad - SHOW_FROM) / (SHOW_FULL - SHOW_FROM)));
      const strength = show * (0.55 + ventFrac * 0.35);

      const u = r.material.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uBad.value += (bad - u.uBad.value) * k;
      u.uSpeed.value += (speed - u.uSpeed.value) * k;
      u.uStrength.value += (strength - u.uStrength.value) * k;
      // Below a perceptible alpha there is nothing to composite, so skip the
      // draw outright rather than blending a fully transparent tube.
      r.mesh.visible = u.uStrength.value > 0.004;
    }
  });

  return (
    <group>
      {ribbons.map((r) => (
        // Rendered as primitives so `useFrame` can flip `visible` on the actual
        // object without a ref per ribbon.
        <primitive key={r.id} object={r.mesh} />
      ))}
    </group>
  );
}
