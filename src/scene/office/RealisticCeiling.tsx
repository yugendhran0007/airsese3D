import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimStore } from '../../state/simStore';
import { useOfficeLayout } from './Furniture';
import { Instanced, type Part } from './RealisticFurniture';

/** 600 mm suspended ceiling tile grid. */
function makeTileTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3f4f6';
  g.fillRect(0, 0, 256, 256);
  // mineral-fibre speckle
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(120,125,135,${0.05 + ((i * 7919) % 100) / 1000})`;
    g.fillRect((i * 37) % 256, (i * 91) % 256, 1.5, 1.5);
  }
  // T-bar grid
  g.strokeStyle = 'rgba(150,155,165,0.9)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** "FIRE EXIT" running-man sign texture. */
function makeExitTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1fa34a';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffffff';
  g.font = 'bold 34px Inter, Arial, sans-serif';
  g.textAlign = 'left';
  g.fillText('FIRE', 14, 52);
  g.fillText('EXIT', 14, 98);
  // running figure + arrow
  g.beginPath();
  g.arc(150, 36, 10, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = '#ffffff';
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(150, 48);
  g.lineTo(160, 80);
  g.lineTo(175, 104);
  g.moveTo(160, 80);
  g.lineTo(138, 100);
  g.moveTo(150, 52);
  g.lineTo(172, 66);
  g.moveTo(150, 56);
  g.lineTo(128, 72);
  g.stroke();
  g.beginPath();
  g.moveTo(196, 64);
  g.lineTo(240, 64);
  g.moveTo(222, 46);
  g.lineTo(240, 64);
  g.lineTo(222, 82);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Realistic ceiling (reference: modern IT office fit-out) — suspended 600 mm
 * tile grid, rows of linear LED bars, round downlights, grey pendant domes
 * over the cafeteria and conference table, square columns, smoke detectors,
 * and fire-exit signage. The ceiling faces down only, so the top-down camera
 * can still see in.
 */
export function RealisticCeiling() {
  const room = useSimStore((s) => s.params.room);
  const layout = useOfficeLayout();
  const { width: W, length: L, height: H } = room;
  const tileTex = useMemo(makeTileTexture, []);
  const exitTex = useMemo(makeExitTexture, []);
  tileTex.repeat.set(W / 0.6, L / 0.6);

  const parts = useMemo(() => {
    const housing: Part[] = [];
    const trim: Part[] = [];
    const strip: Part[] = [];
    const downlight: Part[] = [];
    const detector: Part[] = [];
    const dome: Part[] = [];
    const cord: Part[] = [];
    const bulb: Part[] = [];
    const column: Part[] = [];

    // Linear LED bars: rows along x every ~3 m, 2.4 m bars with 0.8 m gaps along z
    const rowsX = Math.max(3, Math.round(W / 3.2));
    const barsZ = Math.max(3, Math.round(L / 3.2));
    for (let r = 0; r < rowsX; r++) {
      const x = -W / 2 + ((r + 0.5) * W) / rowsX;
      for (let b = 0; b < barsZ; b++) {
        const z = -L / 2 + ((b + 0.5) * L) / barsZ;
        housing.push({ p: [x, H - 0.05, z], ry: Math.PI / 2 });
        trim.push({ p: [x, H - 0.085, z], ry: Math.PI / 2 });
        strip.push({ p: [x, H - 0.093, z], ry: Math.PI / 2 });
      }
      // Downlights halfway between bar rows
      if (r < rowsX - 1) {
        const dx = x + W / rowsX / 2;
        for (let b = 0; b < barsZ; b++) {
          const z = -L / 2 + ((b + 0.5) * L) / barsZ;
          downlight.push({ p: [dx, H - 0.025, z], ry: 0 });
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      detector.push({ p: [(-W / 2 + ((i % 3) + 0.5) * (W / 3)) * 0.9, H - 0.03, i < 3 ? -L / 4 : L / 4], ry: 0 });
    }
    // Pendants over café tables and the conference table
    const pend: [number, number][] = layout.cafeTables.map((t) => [t.x, t.z]);
    pend.push([layout.conference.cx - 1.1, layout.conference.cz], [layout.conference.cx + 1.1, layout.conference.cz]);
    for (const [x, z] of pend) {
      dome.push({ p: [x, H - 0.62, z], ry: 0 });
      cord.push({ p: [x, H - 0.27, z], ry: 0 });
      bulb.push({ p: [x, H - 0.7, z], ry: 0 });
    }
    for (const c of layout.columns) column.push({ p: [c.x, H / 2, c.z], ry: 0 });
    return { housing, trim, strip, downlight, detector, dome, cord, bulb, column };
  }, [W, L, H, layout]);

  return (
    <group>
      <mesh rotation-x={Math.PI / 2} position-y={H - 0.02}>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial map={tileTex} color="#ffffff" roughness={0.95} />
      </mesh>

      {/* Housings are light so the top-down camera (looking through the ceiling) isn't striped black;
          the dark edge trim + bright underside read as linear LED bars from inside */}
      <Instanced parts={parts.housing} shadow={false}>
        <boxGeometry args={[2.4, 0.06, 0.16]} />
        <meshStandardMaterial color="#d7dae0" roughness={0.6} metalness={0.2} />
      </Instanced>
      <Instanced parts={parts.trim} shadow={false}>
        <boxGeometry args={[2.42, 0.012, 0.17]} />
        <meshStandardMaterial color="#22242a" roughness={0.6} metalness={0.3} />
      </Instanced>
      <Instanced parts={parts.strip} shadow={false}>
        <boxGeometry args={[2.3, 0.01, 0.09]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff8ec" emissiveIntensity={3.2} toneMapped={false} />
      </Instanced>
      <Instanced parts={parts.downlight} shadow={false}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff4dc" emissiveIntensity={2.4} />
      </Instanced>
      <Instanced parts={parts.detector} shadow={false}>
        <cylinderGeometry args={[0.07, 0.08, 0.04, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </Instanced>

      {/* Grey dome pendants */}
      <Instanced parts={parts.dome}>
        <cylinderGeometry args={[0.08, 0.26, 0.24, 20, 1, true]} />
        <meshStandardMaterial color="#c4c7cc" roughness={0.5} metalness={0.2} side={THREE.DoubleSide} />
      </Instanced>
      <Instanced parts={parts.cord} shadow={false}>
        <cylinderGeometry args={[0.008, 0.008, 0.5, 6]} />
        <meshStandardMaterial color="#2a2c30" />
      </Instanced>
      <Instanced parts={parts.bulb} shadow={false}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshStandardMaterial color="#fff6dd" emissive="#ffe3a8" emissiveIntensity={3} toneMapped={false} />
      </Instanced>

      {/* Structural columns */}
      <Instanced parts={parts.column}>
        <boxGeometry args={[0.45, H, 0.45]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.7} />
      </Instanced>

      {/* Fire-exit signs: above the main door and on the back wall */}
      <mesh position={[0, 2.55, L / 2 - 0.2]} rotation-y={Math.PI}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshStandardMaterial map={exitTex} emissive="#2fd26a" emissiveMap={exitTex} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[-W / 4, 2.6, -L / 2 + 0.2]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshStandardMaterial map={exitTex} emissive="#2fd26a" emissiveMap={exitTex} emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}
