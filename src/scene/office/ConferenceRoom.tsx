import { Suspense } from 'react';
import * as THREE from 'three';
import { Html, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Presenter } from '../people/Presenter';
import { useScreenTextures } from './screenContent';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { DOOR_HALF, tableSize, type AreaRect, type OfficeLayout } from './officeLayout';

/**
 * One framed glass door leaf: aluminium stile/rail frame, tinted pane and a
 * stainless pull bar. Hinged at `hingeX`; `dir` = which way the leaf extends
 * from the hinge at angle 0 (+1 → −x, −1 → +x), `angle` = swing (rad, + into room).
 */
export function GlassDoorLeaf({
  hingeX,
  z,
  width,
  height,
  angle,
  dir,
  realistic,
}: {
  hingeX: number;
  z: number;
  width: number;
  height: number;
  angle: number;
  dir: 1 | -1;
  realistic: boolean;
}) {
  const frame = realistic ? '#cfd4db' : '#3a4a60';
  const bar = realistic ? '#d9dde3' : '#8fd8ff';
  const ox = -dir * width / 2; // leaf centre offset from hinge
  return (
    <group position={[hingeX, 0, z]} rotation-y={-dir * angle}>
      <group position={[ox, height / 2, 0]}>
        <mesh>
          <boxGeometry args={[width - 0.08, height - 0.08, 0.012]} />
          <meshPhysicalMaterial
            color={realistic ? '#cfe3ee' : '#bfe0f2'}
            transparent
            opacity={realistic ? 0.22 : 0.26}
            roughness={0.03}
            metalness={0.05}
            clearcoat={1}
          />
        </mesh>
        {/* Stiles + rails */}
        {[-1, 1].map((k) => (
          <mesh key={`s${k}`} position={[(k * (width - 0.05)) / 2, 0, 0]}>
            <boxGeometry args={[0.05, height, 0.045]} />
            <meshStandardMaterial color={frame} roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
        {[-1, 1].map((k) => (
          <mesh key={`r${k}`} position={[0, (k * (height - 0.05)) / 2, 0]}>
            <boxGeometry args={[width, 0.05, 0.045]} />
            <meshStandardMaterial color={frame} roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
        {/* Kick plate */}
        <mesh position={[0, -height / 2 + 0.16, 0]}>
          <boxGeometry args={[width, 0.28, 0.03]} />
          <meshStandardMaterial color={frame} roughness={0.35} metalness={0.7} />
        </mesh>
        {/* Vertical pull bar on the free edge, both faces */}
        {[-1, 1].map((f) => (
          <mesh key={`h${f}`} position={[-ox * 0.78, 0.05, f * 0.06]}>
            <cylinderGeometry args={[0.014, 0.014, 0.9, 10]} />
            <meshStandardMaterial color={bar} roughness={0.25} metalness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * One glass-walled room (conference hall or meeting room). Partitions get a
 * door gap at `doorX`; realistic mode uses white frames and a wall display;
 * stylized mode keeps the dark-frame neon look and draws its own table and
 * pendants (realistic tables/pendants come from RealisticFurniture/Ceiling).
 */
function GlassRoom({ area, realistic }: { area: AreaRect; realistic: boolean }) {
  const room = useSimStore((s) => s.params.room);
  const { cx, cz, w, d, doorX, label, kind } = area;
  const glassH = 2.5;
  const frontZ = cz + d / 2;
  const isConference = kind === 'conference';

  const glassMat = (
    <meshPhysicalMaterial
      color={realistic ? '#dbe9f1' : '#bfe0f2'}
      transparent
      opacity={realistic ? 0.12 : 0.16}
      roughness={0.04}
      metalness={0.05}
    />
  );
  const frameMat = (
    <meshStandardMaterial color={realistic ? '#e6e8ec' : '#3a4a60'} roughness={0.5} metalness={realistic ? 0.3 : 0.5} />
  );
  const leftW = doorX - DOOR_HALF - (cx - w / 2);
  const rightW = cx + w / 2 - (doorX + DOOR_HALF);

  return (
    <group>
      {/* Side partitions */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[cx + (side * w) / 2, glassH / 2, cz]}>
            <boxGeometry args={[0.05, glassH, d]} />
            {glassMat}
          </mesh>
          <mesh position={[cx + (side * w) / 2, glassH - 0.03, cz]}>
            <boxGeometry args={[0.09, 0.06, d]} />
            {frameMat}
          </mesh>
          <mesh position={[cx + (side * w) / 2, 0.04, cz]}>
            <boxGeometry args={[0.09, 0.08, d]} />
            {frameMat}
          </mesh>
        </group>
      ))}
      {/* Front panes flanking the door gap */}
      {leftW > 0.05 && (
        <group>
          <mesh position={[cx - w / 2 + leftW / 2, glassH / 2, frontZ]}>
            <boxGeometry args={[leftW, glassH, 0.05]} />
            {glassMat}
          </mesh>
          <mesh position={[cx - w / 2 + leftW / 2, glassH - 0.03, frontZ]}>
            <boxGeometry args={[leftW, 0.06, 0.09]} />
            {frameMat}
          </mesh>
        </group>
      )}
      {rightW > 0.05 && (
        <group>
          <mesh position={[cx + w / 2 - rightW / 2, glassH / 2, frontZ]}>
            <boxGeometry args={[rightW, glassH, 0.05]} />
            {glassMat}
          </mesh>
          <mesh position={[cx + w / 2 - rightW / 2, glassH - 0.03, frontZ]}>
            <boxGeometry args={[rightW, 0.06, 0.09]} />
            {frameMat}
          </mesh>
        </group>
      )}
      {/* Door frame posts + framed double glass doors (one leaf held ajar) */}
      {[-1, 1].map((side) => (
        <mesh key={`p${side}`} position={[doorX + side * DOOR_HALF, glassH / 2, frontZ]}>
          <boxGeometry args={[0.08, glassH, 0.08]} />
          {frameMat}
        </mesh>
      ))}
      <mesh position={[doorX, 2.15, frontZ]}>
        <boxGeometry args={[DOOR_HALF * 2, 0.06, 0.08]} />
        {frameMat}
      </mesh>
      {([-1, 1] as const).map((side) => (
        <GlassDoorLeaf
          key={`d${side}`}
          hingeX={doorX + side * DOOR_HALF}
          z={frontZ}
          width={DOOR_HALF - 0.03}
          height={2.1}
          // Hinge on the outer post; the leaf swings into the room. Left leaf ajar, right leaf wide open.
          angle={side === -1 ? 0.35 : 1.5}
          dir={side}
          realistic={realistic}
        />
      ))}

      {/* Wall display on the building's back wall: the west meeting room runs the
          AI session (neural-head visual), the east one shows code, the conference
          hall the AI training dashboard. */}
      <group position={[cx, isConference ? 1.7 : 1.6, -room.length / 2 + 0.16]}>
        <mesh>
          <boxGeometry args={[isConference ? 2.6 : 1.5, isConference ? 1.35 : 0.85, 0.06]} />
          <meshStandardMaterial color="#0a1220" roughness={0.4} metalness={0.5} />
        </mesh>
        <Suspense fallback={null}>
          <RoomScreen area={area} width={isConference ? 2.4 : 1.38} height={isConference ? 1.15 : 0.75} />
        </Suspense>
      </group>
      {/* AI session: the presenter stands beside the display, facing the table (realistic mode) */}
      {realistic && area.id === 'meeting-west' && (
        <Suspense fallback={null}>
          <Presenter position={[cx + w / 2 - 0.75, 0, -room.length / 2 + 0.85]} rotationY={0.35} />
        </Suspense>
      )}

      {/* Stylized-mode table + pendants (realistic ones come from the furniture/ceiling sets) */}
      {!realistic && (
        <group>
          <mesh position={[cx, 0.74, cz]} castShadow receiveShadow>
            <boxGeometry args={[tableSize(area).tw, 0.06, tableSize(area).td]} />
            <meshStandardMaterial color="#31507e" roughness={0.55} metalness={0.25} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={`l${side}`} position={[cx + side * (isConference ? 1.1 : 0.5), 0, cz]}>
              <mesh position={[0, room.height - 0.45, 0]}>
                <cylinderGeometry args={[0.14, 0.2, 0.16, 12]} />
                <meshStandardMaterial color="#22282f" roughness={0.6} metalness={0.5} />
              </mesh>
              <mesh position={[0, room.height - 0.55, 0]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color="#fff6dd" emissive="#ffdf9e" emissiveIntensity={2.2} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Room label */}
      <Html
        position={[cx, glassH + 0.25, frontZ]}
        center
        distanceFactor={22}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 3,
            color: realistic ? 'rgba(40,48,60,0.85)' : 'rgba(220,235,255,0.85)',
            textShadow: realistic ? '0 1px 4px rgba(255,255,255,0.8)' : '0 1px 6px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Cafeteria floor area + signage (open plan, no walls). */
function CafeteriaArea({ area, realistic }: { area: AreaRect; realistic: boolean }) {
  return (
    <group>
      {/* Darker rug marks the break area */}
      <mesh rotation-x={-Math.PI / 2} position={[area.cx, 0.012, area.cz]} receiveShadow>
        <planeGeometry args={[area.w, area.d]} />
        <meshStandardMaterial color={realistic ? '#8e949c' : '#16284a'} roughness={1} />
      </mesh>
      <Html
        position={[area.cx, 2.6, area.cz - area.d / 2]}
        center
        distanceFactor={22}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 3,
            color: realistic ? 'rgba(40,48,60,0.85)' : 'rgba(220,235,255,0.85)',
            textShadow: realistic ? '0 1px 4px rgba(255,255,255,0.8)' : '0 1px 6px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap',
          }}
        >
          {area.label}
        </div>
      </Html>
    </group>
  );
}

/**
 * All special areas: the glass conference hall on the back wall (rebuilt from
 * the user's view-only Sketchfab reference), two glass meeting rooms in the
 * back corners, and the open cafeteria in the front-right corner.
 */
export function ConferenceRoom({ layout }: { layout: OfficeLayout }) {
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  return (
    <group>
      {layout.areas.map((a) =>
        a.kind === 'cafeteria' ? (
          <CafeteriaArea key={a.id} area={a} realistic={realistic} />
        ) : (
          <GlassRoom key={a.id} area={a} realistic={realistic} />
        ),
      )}
    </group>
  );
}

/** Display content per room. The AI-session screen gets a slow luminous sweep over the neural-head image. */
function RoomScreen({ area, width, height }: { area: AreaRect; width: number; height: number }) {
  const screens = useScreenTextures();
  const aiHead = useTexture('/textures/ai-head.jpg');
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  aiHead.colorSpace = THREE.SRGBColorSpace;
  const kind = area.id === 'meeting-west' ? 'aihead' : area.kind === 'conference' ? 'ai' : 'code';
  useFrame(({ clock }) => {
    if (kind === 'aihead' && matRef.current) {
      // Breathing brightness so the still image reads as a live visual
      const k = 0.9 + Math.sin(clock.elapsedTime * 1.2) * 0.1;
      matRef.current.color.setScalar(k);
    }
  });
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={matRef} map={kind === 'aihead' ? aiHead : screens[kind]} toneMapped={false} />
    </mesh>
  );
}
useTexture.preload('/textures/ai-head.jpg');
