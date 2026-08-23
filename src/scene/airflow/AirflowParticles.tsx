import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { engine } from '../../simulation/engine';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { ventPositions } from '../office/HvacUnits';

const MAX_PARTICLES = 2600;
const MAX_VENTS = 16;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uVent;      // 0..1 ventilation strength
uniform float uAC;        // 0..1
uniform float uWindow;    // 0..1 window outflow
uniform vec3 uVents[${MAX_VENTS}];
uniform int uVentCount;
uniform vec3 uRoomHalf;   // half extents (x, y=height, z)

attribute float aSeed;

varying float vAlpha;

// Cheap hash noise
float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  float seed = aSeed;
  int vent = int(mod(seed * 1000.0, float(uVentCount)));
  vec3 origin = uVents[vent];

  // Lifetime loops; faster with more ventilation
  float life = 5.0 - uVent * 3.2;
  float phase = fract(uTime / life + seed);

  // Fall from the vent, spreading outward in a cone, curl wiggle
  float ang = seed * 6.28318 + phase * (1.5 + uVent * 2.0);
  float spread = phase * (0.8 + uVent * 1.6 + uAC * 0.6);
  vec3 pos = origin;
  pos.y -= phase * (uRoomHalf.y * 1.7) * (0.55 + uVent * 0.6 + uAC * 0.25);
  pos.x += cos(ang) * spread + sin(uTime * 0.7 + seed * 40.0) * 0.25;
  pos.z += sin(ang) * spread + cos(uTime * 0.6 + seed * 30.0) * 0.25;

  // Window/door outflow drift toward +z wall as particles age
  pos.z += uWindow * phase * phase * uRoomHalf.z * 0.8;

  // Keep above floor
  pos.y = max(pos.y, 0.15);

  vAlpha = smoothstep(0.0, 0.15, phase) * (1.0 - smoothstep(0.7, 1.0, phase));
  vAlpha *= 0.35 + uVent * 0.5;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + hash(seed * 7.0) * 3.0 + uVent * 3.0) * (12.0 / -mv.z);
}
`;

const fragmentShader = /* glsl */ `
uniform float uWarm; // 0 = cyan neon (stylized), 1 = soft dust motes (realistic)
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float mask = smoothstep(0.5, 0.1, d);
  vec3 neon = mix(vec3(0.45, 0.85, 1.0), vec3(0.85, 0.98, 1.0), mask);
  vec3 dust = vec3(0.95, 0.93, 0.86);
  vec3 col = mix(neon, dust, uWarm);
  float alpha = vAlpha * mask * mix(1.0, 0.45, uWarm);
  gl_FragColor = vec4(col, alpha);
}
`;

/** GPU-advected airflow: all motion in the vertex shader, CPU only sets uniforms. */
export function AirflowParticles() {
  const room = useSimStore((s) => s.params.room);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3); // unused, required attribute
    const seeds = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) seeds[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVent: { value: 0.7 },
      uAC: { value: 0.6 },
      uWindow: { value: 0 },
      uWarm: { value: 0 },
      uVents: { value: Array.from({ length: MAX_VENTS }, () => new THREE.Vector3(0, 3, 0)) },
      uVentCount: { value: 4 },
      uRoomHalf: { value: new THREE.Vector3(15, 3, 10) },
    }),
    [],
  );

  // Refresh vent uniform positions when the room changes
  useMemo(() => {
    const vents = ventPositions(room.width, room.length, room.height).slice(0, MAX_VENTS);
    vents.forEach((v, i) => uniforms.uVents.value[i].set(v[0], v[1], v[2]));
    uniforms.uVentCount.value = Math.max(1, vents.length);
    uniforms.uRoomHalf.value.set(room.width / 2, room.height, room.length / 2);
  }, [room, uniforms]);

  useFrame((state, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const p = engine.params;
    const k = 1 - Math.exp(-3 * dt);
    mat.uniforms.uVent.value += (p.ventilation / 100 - mat.uniforms.uVent.value) * k;
    mat.uniforms.uAC.value += (p.ac / 100 - mat.uniforms.uAC.value) * k;
    const windowFlow = (p.windowsOpen ? 0.7 : 0) + (p.doorOpen ? 0.3 : 0);
    mat.uniforms.uWindow.value += (windowFlow - mat.uniforms.uWindow.value) * k;
    const warmTarget = useUiStore.getState().renderMode === 'realistic' ? 1 : 0;
    mat.uniforms.uWarm.value += (warmTarget - mat.uniforms.uWarm.value) * k;

    // Render fewer particles at low ventilation
    if (pointsRef.current) {
      const frac = 0.3 + (p.ventilation / 100) * 0.7;
      geometry.setDrawRange(0, Math.floor(MAX_PARTICLES * frac));
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
