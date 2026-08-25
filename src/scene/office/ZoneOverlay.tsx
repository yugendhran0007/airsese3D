import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { STATUS_COLORS } from '../../config/constants';
import { engine } from '../../simulation/engine';
import { buildZones, ZONE_IDS } from '../../simulation/zones';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { fmt } from '../../utils/format';

/** Radial-gradient texture reused by all four zone heatmap quads. */
function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Per-zone floor heatmap tinted by status/CO2, plus live floating zone labels. */
export function ZoneOverlay() {
  const room = useSimStore((s) => s.params.room);
  const zones = useMemo(() => buildZones(room), [room]);
  const glowTex = useMemo(makeGlowTexture, []);
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const zoneSnapshots = useSimStore((s) => s.snapshot.zones);
  const realistic = useUiStore((s) => s.renderMode === 'realistic');

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-4 * dt);
    ZONE_IDS.forEach((id, i) => {
      const mat = matRefs.current[i];
      if (!mat) return;
      const reading = engine.snapshot.zones.find((z) => z.id === id);
      if (!reading) return;
      const target = new THREE.Color(STATUS_COLORS[reading.status]);
      mat.color.lerp(target, k);
      // Opacity scales gently with CO2 intensity
      const intensity = Math.min(1, Math.max(0, (reading.co2 - 500) / 1200));
      const targetOpacity = mat.blending === THREE.AdditiveBlending
        ? 0.1 + intensity * 0.25
        : 0.12 + intensity * 0.3;
      mat.opacity += (targetOpacity - mat.opacity) * k;
    });
  });

  return (
    <group>
      {ZONE_IDS.map((id, i) => {
        const zone = zones[id];
        const snap = zoneSnapshots.find((z) => z.id === id);
        return (
          <group key={id} position={[zone.center[0], 0, zone.center[1]]}>
            <mesh key={realistic ? 'real' : 'styled'} rotation-x={-Math.PI / 2} position-y={0.02}>
              <planeGeometry args={[zone.half[0] * 2 - 0.6, zone.half[1] * 2 - 0.6]} />
              <meshBasicMaterial
                ref={(m) => {
                  matRefs.current[i] = m;
                }}
                map={glowTex}
                color={STATUS_COLORS.green}
                transparent
                opacity={0.14}
                depthWrite={false}
                blending={realistic ? THREE.NormalBlending : THREE.AdditiveBlending}
              />
            </mesh>
            <Html
              position={[0, 0.35, 0]}
              center
              distanceFactor={26}
              // Keep scene labels UNDER the DOM panels (glass sits at z 20–40;
              // drei's default range is in the millions and paints over them)
              zIndexRange={[10, 0]}
              style={{ userSelect: 'none' }}
            >
              <div
                onClick={() => useUiStore.getState().setSelectedZone(id)}
                title={`Zone ${id} — click for people & air quality`}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  textAlign: 'center',
                  color: 'rgba(220,235,255,0.9)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>ZONE {id}</div>
                {snap && (
                  <div style={{ fontSize: 11, opacity: 0.85, fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmt(snap.co2)} ppm · {snap.people}👤
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
