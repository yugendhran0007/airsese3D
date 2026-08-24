/**
 * Realistic-mode interior design layer: brand feature walls, oak slat panels,
 * a slatted timber ceiling raft over the cafeteria, carpet runners along the
 * main aisles, framed wall art and floor planters. Everything is procedural
 * and derived from room dimensions + the office layout, so it follows the
 * room-size sliders. Only mounted in realistic mode (see OfficeShell).
 */
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { OFFICE_THEMES } from '../../config/officeThemes';
import { useOfficeLayout } from './Furniture';
import { Instanced, type Part } from './RealisticFurniture';


const WALL_FACE = 0.1; // building walls are 0.18 m boxes centred on the boundary

/** Vertical oak slats along a wall segment. `axis` = which wall: 'x' walls run along z. */
function slatRun(
  x: number,
  z0: number,
  z1: number,
  ry: number,
  out: Part[],
  pitch = 0.11,
) {
  if (z1 - z0 < 0.6) return;
  for (let z = z0 + pitch / 2; z < z1; z += pitch) out.push({ p: [x, 1.4, z], ry });
}

/**
 * Framed wall posters. The artwork is real image texture (cropped from the
 * source photos into `public/textures/posters/`), so each frame is sized from
 * its own aspect ratio — a poster is never stretched to fit a generic frame.
 * Unlit-ish tone: a low-roughness standard material keeps the print readable
 * under the dark themes without blowing out under the daylight rig.
 */
const POSTERS = {
  imagine: { url: '/textures/posters/imagine.webp', aspect: 1228 / 672 },
  failure: { url: '/textures/posters/failure.webp', aspect: 1 },
  bharathi: { url: '/textures/posters/bharathi.webp', aspect: 1024 / 490 },
} as const;
type PosterId = keyof typeof POSTERS;

interface PosterSpec {
  id: PosterId;
  /** Wall-face point; the frame is built facing +z and rotated by `ry`. */
  p: [number, number, number];
  ry: number;
  /** Frame height in metres — width follows the artwork's aspect. */
  h: number;
}

function Poster({ spec, frame, mat }: { spec: PosterSpec; frame: string; mat: string }) {
  const { url, aspect } = POSTERS[spec.id];
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const h = spec.h;
  const w = h * aspect;
  return (
    <group position={spec.p} rotation-y={spec.ry}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[w + 0.07, h + 0.07, 0.035]} />
        <meshStandardMaterial color={frame} roughness={0.45} metalness={0.35} />
      </mesh>
      {/* Mount board just inside the frame */}
      <mesh position-z={0.019}>
        <planeGeometry args={[w + 0.03, h + 0.03]} />
        <meshStandardMaterial color={mat} roughness={0.9} />
      </mesh>
      {/* Print. A gentle self-emission (the artwork feeding its own emissive
          map) keeps the colours vivid under the dark themes, the way a gallery
          spot-lit print reads — without it a white-ground poster goes muddy
          grey once the wall bounce drops away. */}
      <mesh position-z={0.021}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={0.35}
          roughness={0.5}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

export function InteriorDecor() {
  const room = useSimStore((s) => s.params.room);
  const theme = OFFICE_THEMES[useUiStore((s) => s.officeTheme)];
  const layout = useOfficeLayout();
  const { width: W, length: L, height: H } = room;

  const cafe = layout.areas.find((a) => a.kind === 'cafeteria');
  const meetings = layout.areas.filter((a) => a.kind === 'meeting');
  const backDepth = Math.max(layout.conference.d, ...meetings.map((m) => m.d)) + 0.6;
  const tvZ = 0.5; // open-plan TV sits on the left wall at the cross aisle (WallTvs)
  const featureHalf = 3.2;

  const { slats, slatBacks, art, planters, cafeSlats } = useMemo(() => {
    const slats: Part[] = [];
    const slatBacks: Part[] = [];
    const lx = -W / 2 + WALL_FACE + 0.02;
    const rx = W / 2 - WALL_FACE - 0.02;
    // Left wall: either side of the navy feature wall
    const segsL: [number, number][] = [
      [-L / 2 + backDepth, tvZ - featureHalf - 0.4],
      [tvZ + featureHalf + 0.4, L / 2 - 1.0],
    ];
    for (const [a, b] of segsL) {
      slatRun(lx, a, b, 0, slats);
      if (b - a > 0.6) slatBacks.push({ p: [lx - 0.015, 1.4, (a + b) / 2], ry: 0, s: [1, 1, (b - a) / 1] });
    }
    // Right wall: from the back rooms down to the cafeteria
    const cafeStart = cafe ? cafe.cz - cafe.d / 2 - 0.6 : L / 2 - 1;
    const segsR: [number, number][] = [[-L / 2 + backDepth, cafeStart]];
    for (const [a, b] of segsR) {
      slatRun(rx, a, b, 0, slats);
      if (b - a > 0.6) slatBacks.push({ p: [rx + 0.015, 1.4, (a + b) / 2], ry: 0, s: [1, 1, (b - a) / 1] });
    }

    // Framed posters: spaced along the right wall run, plus one on the left wall
    // between the feature wall and the entrance. Eye level is 1.65 m.
    const art: PosterSpec[] = [];
    const order: PosterId[] = ['imagine', 'failure', 'bharathi'];
    const [ra, rb] = segsR[0];
    if (rb - ra > 6) {
      for (let i = 0; i < 3; i++) {
        const z = ra + ((rb - ra) * (i + 1)) / 4;
        art.push({ p: [rx - 0.05, 1.65, z], ry: -Math.PI / 2, id: order[i], h: order[i] === 'failure' ? 1.15 : 0.95 });
      }
    }
    const [la, lb] = segsL[1];
    if (lb - la > 2.5) {
      art.push({ p: [lx + 0.05, 1.65, (la + lb) / 2], ry: Math.PI / 2, id: 'bharathi', h: 0.8 });
    }

    // Floor planters: flank the entrance, the feature wall and the cafeteria edge
    const planters: [number, number][] = [
      [-1.9, L / 2 - 0.7],
      [1.9, L / 2 - 0.7],
      [lx + 0.45, tvZ - featureHalf + 0.3],
      [lx + 0.45, tvZ + featureHalf - 0.3],
    ];
    if (cafe) planters.push([cafe.cx - cafe.w / 2 - 0.45, cafe.cz + cafe.d / 2 - 0.4]);

    // Slatted timber ceiling raft over the cafeteria
    const cafeSlats: Part[] = [];
    if (cafe) {
      for (let z = cafe.cz - cafe.d / 2 + 0.3; z < cafe.cz + cafe.d / 2 - 0.2; z += 0.16) {
        cafeSlats.push({ p: [cafe.cx, H - 0.32, z], ry: 0, s: [cafe.w - 0.6, 1, 1] });
      }
    }
    return { slats, slatBacks, art, planters, cafeSlats };
  }, [W, L, H, backDepth, cafe, theme]);

  return (
    <group>
      {/* Navy brand feature wall behind the open-plan TV, with an LED cove strip */}
      <group position={[-W / 2 + WALL_FACE + 0.01, 0, tvZ]} rotation-y={Math.PI / 2}>
        <mesh position={[0, (H - 0.3) / 2, 0]}>
          <boxGeometry args={[featureHalf * 2, H - 0.3, 0.03]} />
          <meshStandardMaterial color={theme.feature} roughness={0.55} metalness={0.1} />
        </mesh>
        <mesh position={[0, H - 0.32, 0.03]}>
          <boxGeometry args={[featureHalf * 2 - 0.2, 0.03, 0.03]} />
          <meshStandardMaterial color={theme.cove} emissive={theme.cove} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
        {/* Oak skirting band */}
        <mesh position={[0, 0.35, 0.02]}>
          <boxGeometry args={[featureHalf * 2, 0.7, 0.02]} />
          <meshStandardMaterial color={theme.slat} roughness={0.6} />
        </mesh>
      </group>
      {/* Navy feature panel behind the cafeteria TV on the front wall */}
      {cafe && (
        <group position={[cafe.cx, 0, L / 2 - WALL_FACE - 0.01]} rotation-y={Math.PI}>
          <mesh position={[0, (H - 0.3) / 2, 0]}>
            <boxGeometry args={[Math.min(cafe.w - 0.8, 5.2), H - 0.3, 0.03]} />
            <meshStandardMaterial color={theme.feature} roughness={0.55} metalness={0.1} />
          </mesh>
          <mesh position={[0, H - 0.32, 0.03]}>
            <boxGeometry args={[Math.min(cafe.w - 1.0, 5.0), 0.03, 0.03]} />
            <meshStandardMaterial color={theme.cove} emissive={theme.cove} emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Oak slat panels with a dark backing board */}
      <Instanced parts={slatBacks} shadow={false}>
        <boxGeometry args={[0.01, 2.7, 1]} />
        <meshStandardMaterial color={theme.slatBack} roughness={0.9} />
      </Instanced>
      <Instanced parts={slats} shadow={false}>
        <boxGeometry args={[0.035, 2.7, 0.04]} />
        <meshStandardMaterial color={theme.slat} roughness={0.65} />
      </Instanced>

      {/* Cafeteria timber ceiling raft */}
      <Instanced parts={cafeSlats} shadow={false}>
        <boxGeometry args={[1, 0.12, 0.05]} />
        <meshStandardMaterial color={theme.raft} roughness={0.7} />
      </Instanced>

      {/* Carpet runners along the cross aisle and central spine */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, tvZ]} receiveShadow>
        <planeGeometry args={[W - 0.4, 1.7]} />
        <meshStandardMaterial color={theme.runner} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, (backDepth - 1.5) / 2]} receiveShadow>
        <planeGeometry args={[1.5, L - backDepth - 1.5]} />
        <meshStandardMaterial color={theme.runner} roughness={1} />
      </mesh>
      {/* Entrance mat */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, L / 2 - 1.1]} receiveShadow>
        <planeGeometry args={[3.2, 1.6]} />
        <meshStandardMaterial color={theme.mat} roughness={1} />
      </mesh>

      {/* Framed wall posters (real artwork textures) */}
      <Suspense fallback={null}>
        {art.map((a, i) => (
          <Poster key={i} spec={a} frame={theme.frame} mat={theme.mount} />
        ))}
      </Suspense>

      {/* Floor planters: white pot + foliage */}
      {planters.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={0.3} castShadow>
            <cylinderGeometry args={[0.26, 0.22, 0.6, 20]} />
            <meshStandardMaterial color={theme.pot} roughness={0.4} />
          </mesh>
          {[
            [0, 0.95, 0, 0.34],
            [0.18, 0.8, 0.12, 0.24],
            [-0.16, 0.85, -0.1, 0.26],
            [0.05, 1.2, -0.14, 0.22],
          ].map(([px, py, pz, r], j) => (
            <mesh key={j} position={[px, py, pz]} castShadow>
              <sphereGeometry args={[r, 12, 10]} />
              <meshStandardMaterial color={j % 2 ? '#3f7d3a' : '#2f6a2e'} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
