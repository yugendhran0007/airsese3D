import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSimStore } from '../state/simStore';
import { useUiStore } from '../state/uiStore';
import { useWeatherStore } from '../state/weatherStore';
import { OFFICE_THEMES } from '../config/officeThemes';

/**
 * Weather-reactive lighting. Realistic mode gets a brighter daylight rig with
 * higher-resolution shadows; stylized keeps the moody neon look. Cloud cover
 * and rain from live Chennai weather dim and cool the key light in both.
 */
export function Lighting() {
  const room = useSimStore((s) => s.params.room);
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  const quality = useUiStore((s) => s.quality);
  const ultra = quality === 'ultra';
  const fast = quality === 'fast';
  const theme = OFFICE_THEMES[useUiStore((s) => s.officeTheme)];
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  useFrame((_, dt) => {
    const key = keyRef.current;
    const ambient = ambientRef.current;
    if (!key || !ambient) return;
    const outdoor = useWeatherStore.getState().outdoor;
    const cloud = (outdoor?.cloudCover ?? 50) / 100;
    const rainy = (outdoor?.rain ?? 0) > 0.05 ? 1 : 0;

    const k = 1 - Math.exp(-0.8 * dt);
    const targetIntensity = realistic
      ? 3.0 - cloud * 1.2 - rainy * 0.4
      : 3.2 - cloud * 1.1 - rainy * 0.4;
    key.intensity += (targetIntensity - key.intensity) * k;

    const warm = new THREE.Color(realistic ? '#ffeccf' : '#ffe8c8');
    const cool = new THREE.Color('#c8d8f0');
    const target = warm.clone().lerp(cool, cloud * 0.8 + rainy * 0.2);
    key.color.lerp(target, k);

    // Interior lighting compensates when the sky dims (offices keep their lights on)
    const ambientTarget = realistic ? 1.5 + cloud * 0.25 : 1.3 + cloud * 0.2;
    ambient.intensity += (ambientTarget - ambient.intensity) * k;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={realistic ? 1.5 : 1.3} color={realistic ? '#f4f6fa' : '#b8cdf0'} />
      <hemisphereLight
        intensity={realistic ? 1.1 : 0.5}
        color={realistic ? '#ffffff' : '#dce8ff'}
        groundColor={realistic ? '#9a9ca0' : '#1a2438'}
      />
      {/* Key "sun" through the window wall */}
      <directionalLight
        ref={keyRef}
        position={[room.width * 0.35, room.height * 4, -room.length * 0.9]}
        intensity={realistic ? 3.4 : 2.4}
        color="#ffe8c8"
        castShadow={!fast}
        shadow-mapSize={ultra ? [4096, 4096] : realistic ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-room.width * 0.8}
        shadow-camera-right={room.width * 0.8}
        shadow-camera-top={room.length * 0.9}
        shadow-camera-bottom={-room.length * 0.9}
      />
      {/* Cool fill from the opposite side (skipped in Fast) */}
      {!fast && <directionalLight position={[-room.width, room.height * 2.4, room.length]} intensity={0.7} color="#6fa8dc" />}
      {/* Point lights are per-fragment cost on every material; the HDR environment
          map already supplies the ceiling glow, so they only exist in 8K/ultra. */}
      {realistic && ultra && (
        <pointLight
          position={[room.width * 0.34, room.height - 0.5, room.length * 0.36]}
          intensity={45}
          distance={room.width * 0.6}
          color={theme.accentLight}
        />
      )}
      {(ultra || !realistic) && (<>
      <pointLight
        position={[0, room.height - 0.3, 0]}
        intensity={realistic ? 60 : 90}
        distance={room.width * 1.2}
        color={realistic ? '#fdfcf7' : '#cfe4ff'}
      />
      <pointLight
        position={[-room.width / 4, room.height - 0.4, -room.length / 4]}
        intensity={realistic ? 40 : 30}
        distance={room.width}
        color={realistic ? '#fdfcf7' : '#cfe4ff'}
      />
      <pointLight
        position={[room.width / 4, room.height - 0.4, room.length / 4]}
        intensity={realistic ? 40 : 30}
        distance={room.width}
        color={realistic ? '#fdfcf7' : '#cfe4ff'}
      />
      </>)}
    </>
  );
}
