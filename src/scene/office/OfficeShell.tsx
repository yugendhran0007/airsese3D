import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { damp } from 'maath/easing';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { OFFICE_THEMES } from '../../config/officeThemes';
import { seededRandom } from '../../utils/math';
import { RealisticCeiling } from './RealisticCeiling';
import { GlassDoorLeaf } from './ConferenceRoom';
import { InteriorDecor } from './InteriorDecor';

/** Canvas-generated floor texture: dark tiles with a subtle grid. */
function makeFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b2a45';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(140,180,235,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo((i * 512) / 8, 0);
    g.lineTo((i * 512) / 8, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, (i * 512) / 8);
    g.lineTo(512, (i * 512) / 8);
    g.stroke();
  }
  g.fillStyle = 'rgba(140,180,255,0.03)';
  for (let i = 0; i < 300; i++) {
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Light-grey carpet tile texture for realistic mode (reference: grey loop-pile carpet). */
function makeCarpetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b9bcc1';
  g.fillRect(0, 0, 512, 512);
  // Fine horizontal streaks (loop pile) with per-tile tonal variation
  for (let y = 0; y < 512; y += 2) {
    const shade = 0.92 + seededRandom(y * 3 + 7) * 0.16;
    g.fillStyle = `rgba(${Math.round(175 * shade)}, ${Math.round(178 * shade)}, ${Math.round(184 * shade)}, 0.8)`;
    g.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 1400; i++) {
    const x = seededRandom(i * 13 + 1) * 512;
    const y = seededRandom(i * 17 + 3) * 512;
    const w = 6 + seededRandom(i * 5) * 40;
    g.fillStyle = `rgba(${seededRandom(i) > 0.5 ? 215 : 140}, ${seededRandom(i + 1) > 0.5 ? 218 : 144}, 150, ${0.08 + seededRandom(i * 7) * 0.1})`;
    g.fillRect(x, y, w, 1.5);
  }
  // Tile seams every 256 px (= 2 m at the repeat used below)
  g.strokeStyle = 'rgba(90,95,105,0.22)';
  g.lineWidth = 1.5;
  for (const v of [0, 256, 511]) {
    g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 512); g.stroke();
    g.beginPath(); g.moveTo(0, v); g.lineTo(512, v); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const WALL_COLOR = '#243755';
const TRIM_COLOR = '#2c456b';

export function OfficeShell() {
  const room = useSimStore((s) => s.params.room);
  const doorOpen = useSimStore((s) => s.params.doorOpen);
  const windowsOpen = useSimStore((s) => s.params.windowsOpen);
  const realistic = useUiStore((s) => s.renderMode === 'realistic');
  const theme = OFFICE_THEMES[useUiStore((s) => s.officeTheme)];
  const { width: W, length: L, height: H } = room;

  const gridTex = useMemo(makeFloorTexture, []);
  const carpetTex = useMemo(makeCarpetTexture, []);
  const floorTex = realistic ? carpetTex : gridTex;
  const wallColor = realistic ? theme.wall : WALL_COLOR;
  floorTex.repeat.set(W / 4, L / 4);

  const doorRef = useRef<THREE.Group>(null);
  const windowRefs = useRef<THREE.Group[]>([]);

  useFrame((_, dt) => {
    if (doorRef.current) {
      damp(doorRef.current.rotation, 'y', doorOpen ? -1.9 : 0, 0.25, dt);
    }
    for (const w of windowRefs.current) {
      if (w) damp(w.rotation, 'x', windowsOpen ? -0.5 : 0, 0.25, dt);
    }
  });

  const wallT = 0.18;
  const windowCount = Math.max(2, Math.floor(W / 6));
  const windowW = (W * 0.72) / windowCount;

  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial
          map={floorTex}
          color={realistic ? theme.carpet : '#b9c8e6'}
          roughness={realistic ? 0.95 : 0.85}
          metalness={realistic ? 0 : 0.1}
        />
      </mesh>
      {/* Outer glow apron under the building */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[W + 14, L + 14]} />
        <meshBasicMaterial color={realistic ? '#9aa3ae' : '#040810'} />
      </mesh>

      {/* Back wall (north, -z) with glass window band */}
      <mesh position={[0, H * 0.15, -L / 2]} castShadow>
        <boxGeometry args={[W, H * 0.3, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, H * 0.925, -L / 2]}>
        <boxGeometry args={[W, H * 0.15, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      {/* Window panes + frames */}
      {Array.from({ length: windowCount }, (_, i) => {
        const x = -W * 0.36 + windowW * (i + 0.5);
        return (
          <group key={i} position={[x, H * 0.575, -L / 2]}>
            {/* Pane pivots at its top edge so it tilts outward when open */}
            <group
              ref={(g) => {
                if (g) windowRefs.current[i] = g;
              }}
              position={[0, H * 0.275, 0]}
            >
              <mesh position={[0, -H * 0.275, 0]}>
                <boxGeometry args={[windowW - 0.25, H * 0.55, 0.04]} />
                <meshPhysicalMaterial
                  color="#9fd8ff"
                  transparent
                  opacity={0.18}
                  roughness={0.05}
                  metalness={0.1}
                />
              </mesh>
            </group>
            {/* Mullion frame: top, bottom, sides */}
            {([
              [0, H * 0.29, windowW - 0.1, 0.06],
              [0, -H * 0.29, windowW - 0.1, 0.06],
            ] as [number, number, number, number][]).map(([fx, fy, fw, fh], j) => (
              <mesh key={`h${j}`} position={[fx, fy, 0]}>
                <boxGeometry args={[fw, fh, 0.08]} />
                <meshStandardMaterial color={realistic ? '#d8dee8' : TRIM_COLOR} roughness={0.5} metalness={0.35} />
              </mesh>
            ))}
            {[-1, 1].map((side) => (
              <mesh key={`v${side}`} position={[(side * (windowW - 0.16)) / 2, 0, 0]}>
                <boxGeometry args={[0.06, H * 0.58, 0.08]} />
                <meshStandardMaterial color={realistic ? '#d8dee8' : TRIM_COLOR} roughness={0.5} metalness={0.35} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Side walls */}
      <mesh position={[-W / 2, H / 2, 0]}>
        <boxGeometry args={[wallT, H, L]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} transparent opacity={0.96} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]}>
        <boxGeometry args={[wallT, H, L]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} transparent opacity={0.96} />
      </mesh>

      {/* Front wall (south, +z) split around the door opening */}
      <mesh position={[-(W / 4 + 0.6), H / 2, L / 2]}>
        <boxGeometry args={[W / 2 - 1.2, H, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} transparent opacity={0.9} />
      </mesh>
      <mesh position={[W / 4 + 0.6, H / 2, L / 2]}>
        <boxGeometry args={[W / 2 - 1.2, H, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} transparent opacity={0.9} />
      </mesh>
      {/* Header above door */}
      <mesh position={[0, H - (H - 2.2) / 2, L / 2]}>
        <boxGeometry args={[2.4, H - 2.2, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      {/* Door (hinged at left edge). Realistic: framed double glass entrance — the left
          leaf swings with the Main Door toggle, the right leaf stays closed. */}
      <group position={[-1.1, 0, L / 2]} ref={doorRef}>
        {realistic ? (
          <GlassDoorLeaf hingeX={0} z={0} width={1.1} height={2.2} angle={0} dir={-1} realistic />
        ) : (
          <>
            <mesh position={[1.1, 1.1, 0]} castShadow>
              <boxGeometry args={[2.2, 2.2, 0.08]} />
              <meshStandardMaterial color="#2a4a74" roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[1.95, 1.1, 0.07]}>
              <boxGeometry args={[0.06, 0.4, 0.04]} />
              <meshStandardMaterial color="#8fd8ff" emissive="#38a8cc" emissiveIntensity={0.6} />
            </mesh>
          </>
        )}
      </group>
      {realistic && (
        <>
          <GlassDoorLeaf hingeX={1.1} z={L / 2} width={1.1} height={2.2} angle={0} dir={1} realistic />
          {/* Entrance frame + transom glass up to the header */}
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} position={[x, 1.1, L / 2]}>
              <boxGeometry args={[0.1, 2.2, 0.2]} />
              <meshStandardMaterial color="#cfd4db" roughness={0.4} metalness={0.6} />
            </mesh>
          ))}
          <InteriorDecor />
        </>
      )}

      {/* Baseboard accent strip (bloom target, stylized only) */}
      {!realistic && <mesh position={[0, 0.06, -L / 2 + wallT / 2 + 0.02]}>
        <boxGeometry args={[W - 0.4, 0.04, 0.02]} />
        <meshStandardMaterial
          color={realistic ? '#ffe9c4' : '#38e1ff'}
          emissive={realistic ? '#c49a58' : '#1897b8'}
          emissiveIntensity={realistic ? 0.5 : 1.4}
        />
      </mesh>}

      {/* Realistic mode: suspended tile ceiling, LED bars, columns live in RealisticCeiling */}
      {realistic && <RealisticCeiling />}

      {/* Ceiling beams (open ceiling look, stylized) */}
      {!realistic && Array.from({ length: Math.max(2, Math.floor(L / 5)) }, (_, i) => {
        const rows = Math.max(2, Math.floor(L / 5));
        const z = -L / 2 + ((i + 0.5) * L) / rows;
        return (
          <mesh key={i} position={[0, H, z]}>
            <boxGeometry args={[W, 0.12, 0.3]} />
            <meshStandardMaterial color={realistic ? '#c8cfda' : '#0d1626'} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}
