import * as THREE from 'three';
import { seededRandom } from '../../utils/math';

/** Deterministic per-person appearance derived from a stable seed. */
export interface Appearance {
  female: boolean;
  skin: THREE.Color;
  hair: THREE.Color;
  outfit: THREE.Color;
  hasTie: boolean;
  /** Suit jacket look: dark blazer over a visible white shirt front. */
  blazer: boolean;
  hasGlasses: boolean;
  hasBadge: boolean;
}

export const SKIN_TONES = ['#f0c8a5', '#e8b48f', '#c98e63', '#a06c48', '#8a5f42', '#6b4630'].map(
  (c) => new THREE.Color(c),
);

export const HAIR_COLORS = ['#1d1a17', '#2e2016', '#4a3220', '#6b4a2a', '#8a6a45', '#4d4d52'].map(
  (c) => new THREE.Color(c),
);

/** Office wear: shirts/blouses for everyone, suit-ish tones. */
export const OUTFIT_MALE = ['#dfe6ee', '#bcd2ea', '#9fb3c8', '#3d5a80', '#5a7d9a', '#cfd8dc'].map(
  (c) => new THREE.Color(c),
);
export const OUTFIT_FEMALE = ['#e8d5e2', '#c9dbe8', '#dfe6ee', '#7a5a80', '#b56576', '#5a7d9a'].map(
  (c) => new THREE.Color(c),
);
export const TIE_COLORS = ['#7a1f2b', '#1f3a6e', '#2f5d3a', '#3a3a3a'].map((c) => new THREE.Color(c));
export const BLAZER_COLORS = ['#23262e', '#2b3444', '#3a3f4a', '#41332b', '#1f2a38'].map(
  (c) => new THREE.Color(c),
);
export const SKIRT_DARKEN = 0.55;

export function appearanceFor(seed: number): Appearance {
  const female = seededRandom(seed * 13 + 5) < 0.5;
  const skin = SKIN_TONES[Math.floor(seededRandom(seed * 7 + 2) * SKIN_TONES.length)];
  const hair = HAIR_COLORS[Math.floor(seededRandom(seed * 11 + 9) * HAIR_COLORS.length)];
  const palette = female ? OUTFIT_FEMALE : OUTFIT_MALE;
  const outfit = palette[Math.floor(seededRandom(seed * 3 + 1) * palette.length)];
  const blazer = seededRandom(seed * 23 + 8) < (female ? 0.3 : 0.4);
  const outfitFinal = blazer
    ? BLAZER_COLORS[Math.floor(seededRandom(seed * 29 + 3) * BLAZER_COLORS.length)]
    : outfit;
  const hasTie = !female && seededRandom(seed * 17 + 4) < 0.65;
  const hasGlasses = seededRandom(seed * 37 + 6) < 0.3;
  const hasBadge = seededRandom(seed * 41 + 12) < 0.55;
  return { female, skin, hair, outfit: outfitFinal, hasTie, blazer, hasGlasses, hasBadge };
}

/**
 * Face texture shared by all heads: features drawn dark on a white base so the
 * per-instance color tint becomes the skin tone while eyes/brows/mouth stay
 * crisp. Drawn centered at u=0.25, which is the +Z (facing) side of three's
 * SphereGeometry UV layout.
 */
export function makeFaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 256);

  const cx = 512 * 0.25; // face center (u = 0.25 → +Z)
  const eyeY = 118;

  // Brows
  g.strokeStyle = 'rgba(35,25,20,0.85)';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + side * 30 - 12, eyeY - 20);
    g.quadraticCurveTo(cx + side * 30, eyeY - 26, cx + side * 30 + 12, eyeY - 19);
    g.stroke();
  }

  // Eyes: white → iris → pupil → highlight
  for (const side of [-1, 1]) {
    const ex = cx + side * 30;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(ex, eyeY, 13, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40,30,25,0.55)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#3a2a1e';
    g.beginPath();
    g.ellipse(ex, eyeY + 1, 6.5, 6.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#120d0a';
    g.beginPath();
    g.ellipse(ex, eyeY + 1, 3, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(ex - 2, eyeY - 1.5, 1.6, 1.6, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Nose hint
  g.strokeStyle = 'rgba(120,80,60,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, eyeY + 8);
  g.lineTo(cx - 3, eyeY + 22);
  g.stroke();

  // Gentle smile
  g.strokeStyle = 'rgba(120,55,45,0.8)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 14, eyeY + 34);
  g.quadraticCurveTo(cx, eyeY + 44, cx + 14, eyeY + 34);
  g.stroke();

  // Faint cheek blush
  g.fillStyle = 'rgba(220,120,110,0.13)';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + side * 40, eyeY + 26, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
