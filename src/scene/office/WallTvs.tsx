/**
 * Wall-mounted TVs playing ONLY the Finstein brand animation (the user's
 * choice): the stepped-F mark builds in, the wordmark wipes in, the tagline
 * fades up, a light sweep and breathe on the hold, then a clean loop — over
 * a subtle drifting-network background. No slides, ticker or data.
 * The screen is a CanvasTexture repainted from useFrame (no React re-renders),
 * following the per-frame-data-stays-out-of-React rule.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { OfficeLayout } from './officeLayout';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { useThree } from '@react-three/fiber';
import { seededRandom } from '../../utils/math';

const SCREEN_W = 2.2; // m
/** Building walls are 0.18 m boxes centred on the room boundary; keep the bracket clear of the inner face. */
const WALL_INSET = 0.2;
const SCREEN_H = SCREEN_W * 9 / 16;
const TEX_W = 1024;
const TEX_H = 576;
/** Logo loop length (seconds): build in → hold → fade out. */
const LOOP = 8;
const NAVY = '#0b1a33';
const NAVY_2 = '#10264d';
const BLUE_DARK = '#1f5fa8';
const BLUE = '#3a8fd6';
const BLUE_LIGHT = '#7cc4f0';

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeBack = (t: number) => { const k = clamp01(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

/* ---------- Subtle brand background: drifting network of nodes ---------- */
const NODES = Array.from({ length: 36 }, (_, i) => ({
  x: seededRandom(i * 3 + 1) * TEX_W,
  y: seededRandom(i * 5 + 2) * TEX_H,
  vx: (seededRandom(i * 7 + 3) - 0.5) * 12,
  vy: (seededRandom(i * 11 + 4) - 0.5) * 9,
  r: 1.2 + seededRandom(i * 13 + 5) * 2,
}));

function background(ctx: CanvasRenderingContext2D, t: number) {
  const w = TEX_W, h = TEX_H;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, NAVY);
  g.addColorStop(1, NAVY_2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sx = w * 0.5 + Math.sin(t * 0.17) * w * 0.3;
  const sy = h * 0.45 + Math.cos(t * 0.13) * h * 0.25;
  const r = ctx.createRadialGradient(sx, sy, 0, sx, sy, 420);
  r.addColorStop(0, 'rgba(58,143,214,0.25)');
  r.addColorStop(1, 'rgba(58,143,214,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, w, h);
  const pts = NODES.map((n) => ({
    x: ((n.x + n.vx * t) % (w + 60) + (w + 60)) % (w + 60) - 30,
    y: ((n.y + n.vy * t) % (h + 60) + (h + 60)) % (h + 60) - 30,
    r: n.r,
  }));
  ctx.lineWidth = 1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 170 * 170) continue;
      ctx.strokeStyle = `rgba(124,196,240,${(1 - Math.sqrt(d2) / 170) * 0.28})`;
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
    }
  }
  for (const p of pts) {
    ctx.fillStyle = 'rgba(124,196,240,0.8)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
}

/** Stepped "F" mark; `k` 0→1 builds it in block by block. */
function mark(ctx: CanvasRenderingContext2D, x: number, baseY: number, unit: number, k: number) {
  const blocks: Array<[number, number, number, number, string, number]> = [
    [0, 0, unit, unit, BLUE_DARK, 0],
    [0, unit, unit, unit, BLUE, 0.15],
    [unit, unit, unit * 1.6, unit, BLUE_LIGHT, 0.3],
    [0, unit * 2, unit * 2.6, unit, BLUE_LIGHT, 0.45],
  ];
  for (const [bx, by, bw, bh, col, delay] of blocks) {
    const kk = easeBack((k * 1.2 - delay) / 0.6);
    if (kk <= 0) continue;
    ctx.fillStyle = col;
    ctx.fillRect(x + bx, baseY - by - bh * kk, bw * kk, bh * kk);
  }
}

/** Draw one frame of the Finstein logo animation at loop time `t` (seconds). Only the brand — nothing else. */
function paint(ctx: CanvasRenderingContext2D, t: number) {
  const w = TEX_W, h = TEX_H;
  background(ctx, t);
  // Fade out over the last 0.8 s so the loop restarts cleanly
  const fade = t > LOOP - 0.8 ? 1 - (t - (LOOP - 0.8)) / 0.8 : 1;
  ctx.globalAlpha = Math.max(0, fade);
  ctx.textBaseline = 'alphabetic';

  // Light sweep across the brand
  const sweep = ((t * 0.3) % 1.6) - 0.3;
  const g = ctx.createLinearGradient(w * (sweep - 0.2), 0, w * (sweep + 0.2), h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(180,220,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Mark builds in, wordmark wipes in, tagline fades up; then a gentle breathe on the hold
  const unit = 62, mx = 150, my = h / 2 + unit * 1.1;
  const breathe = 1 + Math.sin(t * 1.2) * 0.01;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(breathe, breathe);
  ctx.translate(-w / 2, -h / 2);
  mark(ctx, mx, my, unit, t / 1.2);
  const wipe = easeOut((t - 0.8) / 1.0);
  if (wipe > 0) {
    ctx.save();
    const tx = mx + unit * 3.1;
    ctx.beginPath(); ctx.rect(tx, 0, 700 * wipe, h); ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 150px Georgia, "Times New Roman", serif';
    ctx.fillText('Finstein', tx, my);
    ctx.restore();
  }
  const tag = easeOut((t - 2.0) / 0.8);
  if (tag > 0) {
    ctx.globalAlpha = Math.max(0, fade) * tag;
    ctx.fillStyle = BLUE_LIGHT;
    ctx.font = '500 32px system-ui, sans-serif';
    ctx.fillText('Software · Security · Intelligence', mx, my + 88);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** One TV: black bezel, thin back panel, animated screen. Faces +z in local space. */
function Tv({
  texture,
  position,
  rotationY,
}: {
  texture: THREE.CanvasTexture;
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      {/* Bezel */}
      <mesh position-z={-0.02}>
        <boxGeometry args={[SCREEN_W + 0.08, SCREEN_H + 0.08, 0.05]} />
        <meshStandardMaterial color="#111418" roughness={0.45} metalness={0.4} />
      </mesh>
      {/* Wall bracket */}
      <mesh position-z={-0.07}>
        <boxGeometry args={[0.5, 0.4, 0.06]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>
      {/* Screen — unlit so the picture shows exact colours regardless of scene lighting */}
      <mesh position-z={0.006}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function WallTvs({ layout }: { layout: OfficeLayout }) {
  const room = useSimStore((s) => s.params.room);
  const quality = useUiStore((s) => s.quality);
  const ultra = quality === 'ultra';
  const fast = quality === 'fast';
  const gl = useThree((s) => s.gl);

  // Screen texture: 2K by default, native 4K (3840×2160) in "8K" ultra mode.
  // The deck is authored in 1024×576 units and scaled up, so text and shapes
  // stay vector-sharp at any resolution. Mipmaps + max anisotropy keep the
  // picture crisp at grazing angles instead of shimmering.
  const { texture, ctx, scale } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const scale = ultra ? 3840 / TEX_W : fast ? 1 : 2048 / TEX_W;
    canvas.width = TEX_W * scale;
    canvas.height = TEX_H * scale;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { texture, ctx, scale };
  }, [ultra, fast, gl]);
  useEffect(() => () => texture.dispose(), [texture]);

  // Repaint at ~30 fps (24 fps for the 4K surface); both TVs share one texture.
  const lastPaint = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastPaint.current < (ultra ? 1 / 24 : fast ? 1 / 12 : 1 / 30)) return;
    lastPaint.current = clock.elapsedTime;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    paint(ctx, clock.elapsedTime % LOOP);
    texture.needsUpdate = true;
  });

  const y = Math.min(room.height - 0.9, 1.9);
  const cafe = layout.areas.find((a) => a.kind === 'cafeteria');

  return (
    <>
      {/* Open-plan floor: on the left side wall by the cross aisle, facing the desks
          (the conference hall and meeting rooms already have their own wall displays). */}
      <Tv texture={texture} position={[-room.width / 2 + WALL_INSET, y, 0.5]} rotationY={Math.PI / 2} />
      {/* Cafeteria: on the front wall, facing into the café */}
      {cafe && (
        <Tv texture={texture} position={[cafe.cx, y, room.length / 2 - WALL_INSET]} rotationY={Math.PI} />
      )}
    </>
  );
}
