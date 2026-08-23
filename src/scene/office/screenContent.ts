/**
 * Canvas-painted screen content for every monitor and laptop: a code editor,
 * an AI training dashboard and a cybersecurity SOC view. Three shared
 * CanvasTextures, repainted at a low rate from useFrame (no React state).
 * Content is illustrative (fake code/logs) and deterministic via seededRandom.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { seededRandom } from '../../utils/math';
import { useUiStore } from '../../state/uiStore';
import { useThree } from '@react-three/fiber';

export const SCREEN_KINDS = ['code', 'ai', 'security'] as const;
export type ScreenKind = (typeof SCREEN_KINDS)[number];

const W = 768;
const H = 432;
const MONO = '500 17px "JetBrains Mono", "Fira Code", Consolas, monospace';
const SANS = '600 18px Inter, system-ui, sans-serif';

const CODE_SRC = [
  'import { engine } from "../simulation/engine";',
  '',
  'export function ventilationAdvice(zone: ZoneSnapshot) {',
  '  const ach = engine.params.ventilation * 0.08;',
  '  const gen = zone.people * CO2_PER_PERSON;',
  '  const steady = OUTDOOR_CO2 + gen / (ach * zone.volume);',
  '  if (steady > THRESHOLDS.co2.warn) {',
  '    return recommend("increase-fresh-air", zone.id);',
  '  }',
  '  return null;',
  '}',
  '',
  'async function syncSensors(provider: OutdoorProvider) {',
  '  const reading = await provider.fetch();',
  '  if (reading.ageMin > 20) reading.stale = true;',
  '  engine.setOutdoor(reading);',
  '}',
  '',
  'describe("alerts", () => {',
  '  it("holds 60 s hysteresis", () => {',
  '    expect(alertFor(zone, 950)).toBe("yellow");',
  '  });',
  '});',
];

function tokenColor(tok: string): string {
  if (/^(import|export|from|function|async|await|const|return|if|describe|it)$/.test(tok)) return '#c792ea';
  if (/^".*"$/.test(tok) || /^".*";?$/.test(tok)) return '#c3e88d';
  if (/^[0-9.]+;?$/.test(tok)) return '#f78c6c';
  if (/[A-Z_]{4,}/.test(tok)) return '#ffcb6b';
  if (/\(/.test(tok)) return '#82aaff';
  return '#d6deeb';
}

function paintCode(g: CanvasRenderingContext2D, t: number) {
  g.fillStyle = '#0f1419';
  g.fillRect(0, 0, W, H);
  // Activity bar + tabs
  g.fillStyle = '#0a0e12';
  g.fillRect(0, 0, 44, H);
  g.fillRect(44, 0, W - 44, 30);
  g.fillStyle = '#1b2229';
  g.fillRect(44, 0, 190, 30);
  g.fillStyle = '#9aa5b1';
  g.font = SANS;
  g.fillText('recommendations.ts', 56, 21);
  g.fillStyle = '#6a7480';
  g.fillText('engine.ts', 250, 21);
  g.fillText('alerts.ts', 345, 21);
  // Icons in the activity bar
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i === 0 ? '#58a6ff' : '#2e3741';
    g.fillRect(12, 48 + i * 44, 20, 20);
  }
  // Code
  g.font = MONO;
  const lineH = 21;
  const scroll = Math.floor(t * 0.6) % 6;
  for (let i = 0; i < 19; i++) {
    const li = i + scroll;
    const src = CODE_SRC[li % CODE_SRC.length];
    const y = 58 + i * lineH;
    g.fillStyle = '#3b4652';
    g.textAlign = 'right';
    g.fillText(String(li + 12), 82, y);
    g.textAlign = 'left';
    let x = 98;
    for (const tok of src.split(' ')) {
      g.fillStyle = tokenColor(tok);
      g.fillText(tok, x, y);
      x += g.measureText(tok + ' ').width;
    }
  }
  // Typing cursor on the last visible line
  if (Math.floor(t * 2) % 2 === 0) {
    g.fillStyle = '#58a6ff';
    g.fillRect(98 + g.measureText(CODE_SRC[(18 + scroll) % CODE_SRC.length]).width + 4, 58 + 18 * lineH - 15, 2, 18);
  }
  // Status bar
  g.fillStyle = '#1f6feb';
  g.fillRect(0, H - 24, W, 24);
  g.fillStyle = '#ffffff';
  g.font = '500 14px Inter, system-ui, sans-serif';
  g.fillText('⎇ main   ✓ 0 problems   TypeScript   Ln 23, Col 1   UTF-8', 54, H - 7);
}

function paintAi(g: CanvasRenderingContext2D, t: number) {
  g.fillStyle = '#0b1020';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#111a33';
  g.fillRect(0, 0, W, 40);
  g.font = SANS;
  g.fillStyle = '#e6ecff';
  g.fillText('Model Training — airsense-llm-7b', 16, 27);
  g.fillStyle = '#7cc4f0';
  g.font = '500 15px Inter, system-ui, sans-serif';
  g.fillText('epoch 12 / 20   ·   GPU 8×A100   ·   lr 2.0e-5', 400, 27);

  // Loss curve
  const cx = 24, cy = 60, cw = 440, ch = 220;
  g.fillStyle = '#0e1530';
  g.fillRect(cx, cy, cw, ch);
  g.strokeStyle = '#1d2a4d';
  g.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    g.beginPath(); g.moveTo(cx, cy + (ch * i) / 5); g.lineTo(cx + cw, cy + (ch * i) / 5); g.stroke();
  }
  const n = 60;
  const prog = (t * 0.12) % 1;
  for (const [series, col, off] of [['train', '#58a6ff', 0], ['val', '#f0883e', 0.18]] as const) {
    void series;
    g.strokeStyle = col;
    g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i < n * prog; i++) {
      const x = cx + (cw * i) / n;
      const base = 2.4 * Math.exp(-i / 22) + 0.35 + off;
      const y = cy + ch - (base / 3.2) * ch + (seededRandom(i * 7 + off * 100) - 0.5) * 14;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = '#9fb3d9';
  g.font = '500 14px Inter, system-ui, sans-serif';
  g.fillText('loss  ▬ train  ▬ val', cx + 8, cy + ch + 18);

  // Metric tiles
  const tiles: [string, string, string][] = [
    ['accuracy', (0.912 + Math.sin(t * 0.3) * 0.006).toFixed(3), '#3fb950'],
    ['val loss', (0.41 - prog * 0.05).toFixed(3), '#f0883e'],
    ['tokens/s', String(Math.round(18240 + Math.sin(t) * 400)), '#58a6ff'],
    ['ETA', `${Math.max(1, Math.round(42 - prog * 40))} min`, '#c792ea'],
  ];
  tiles.forEach(([label, val, col], i) => {
    const x = 490, y = 60 + i * 58;
    g.fillStyle = '#111a33';
    g.fillRect(x, y, 254, 48);
    g.fillStyle = '#8b9bc0';
    g.font = '500 13px Inter, system-ui, sans-serif';
    g.fillText(label.toUpperCase(), x + 12, y + 18);
    g.fillStyle = col;
    g.font = '700 22px "JetBrains Mono", Consolas, monospace';
    g.fillText(val, x + 12, y + 41);
  });

  // Attention-map / neural net sketch
  const nx = 24, ny = 300;
  g.fillStyle = '#0e1530';
  g.fillRect(nx, ny, 720, 120);
  const layers = [4, 6, 6, 3];
  const pts: [number, number][][] = layers.map((cnt, li) =>
    Array.from({ length: cnt }, (_, j) => [nx + 80 + li * 200, ny + 15 + ((j + 0.5) * 90) / cnt] as [number, number]),
  );
  g.lineWidth = 1;
  for (let li = 0; li < layers.length - 1; li++) {
    for (const a of pts[li]) for (const b of pts[li + 1]) {
      const pulse = 0.15 + 0.35 * Math.max(0, Math.sin(t * 2 + a[1] * 0.05 + b[1] * 0.03));
      g.strokeStyle = `rgba(88,166,255,${pulse})`;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  }
  for (const layer of pts) for (const [x, y] of layer) {
    g.fillStyle = '#7cc4f0';
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#8b9bc0';
  g.font = '500 13px Inter, system-ui, sans-serif';
  g.fillText('INFERENCE GRAPH · live', nx + 10, ny + 112);
}

const SOC_EVENTS = [
  ['INFO', 'fw-core-01', 'Allowed TLS 1.3 handshake 10.4.2.17 → 52.84.11.2:443'],
  ['WARN', 'ids-sensor-3', 'Port scan detected from 185.220.101.4 (34 ports / 6 s)'],
  ['INFO', 'edr-ws-0412', 'Signature DB updated · 1,284,913 rules'],
  ['CRIT', 'siem', 'Brute-force login: 47 failures svc-backup@vpn-gw'],
  ['INFO', 'vpn-gw', 'Session established user a-03 (MFA ok)'],
  ['WARN', 'mail-gw', 'Phishing quarantined: "Invoice_0822.pdf.exe"'],
  ['INFO', 'fw-core-01', 'Blocked outbound 10.4.7.9 → 45.33.32.156:4444'],
  ['INFO', 'patch-mgr', 'CVE-2026-1183 remediated on 212 endpoints'],
  ['WARN', 'dlp', 'Large upload 1.2 GB → personal-drive blocked'],
  ['INFO', 'edr-ws-0077', 'Heuristic scan clean (2,311 files)'],
];

function paintSecurity(g: CanvasRenderingContext2D, t: number) {
  g.fillStyle = '#070c10';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#0d161c';
  g.fillRect(0, 0, W, 40);
  g.font = SANS;
  g.fillStyle = '#d7f5e6';
  g.fillText('SOC Dashboard — Threat Monitor', 16, 27);
  const blink = Math.floor(t * 1.5) % 2 === 0;
  g.fillStyle = blink ? '#3fb950' : '#1e5c30';
  g.beginPath(); g.arc(W - 120, 20, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9fe0b9';
  g.font = '500 14px Inter, system-ui, sans-serif';
  g.fillText('LIVE · SSE', W - 106, 25);

  // Threat gauges
  const stats: [string, string, string][] = [
    ['THREAT LEVEL', 'GUARDED', '#e3b341'],
    ['BLOCKED / 24h', String(4812 + Math.floor(t * 3) % 200), '#3fb950'],
    ['OPEN INCIDENTS', '2', '#f85149'],
    ['ENDPOINTS', '1,284 / 1,291', '#58a6ff'],
  ];
  stats.forEach(([label, val, col], i) => {
    const x = 16 + i * 186, y = 52;
    g.fillStyle = '#0d161c';
    g.fillRect(x, y, 174, 58);
    g.fillStyle = '#6f8a7c';
    g.font = '500 12px Inter, system-ui, sans-serif';
    g.fillText(label, x + 10, y + 18);
    g.fillStyle = col;
    g.font = '700 22px "JetBrains Mono", Consolas, monospace';
    g.fillText(val, x + 10, y + 46);
  });

  // World-map style attack arcs (abstract)
  const mx = 16, my = 122, mw = 330, mh = 140;
  g.fillStyle = '#0b1318';
  g.fillRect(mx, my, mw, mh);
  g.fillStyle = '#16242c';
  for (let i = 0; i < 120; i++) {
    const x = mx + seededRandom(i * 3) * mw;
    const y = my + 20 + seededRandom(i * 5 + 1) * (mh - 40);
    g.fillRect(x, y, 3, 3);
  }
  for (let i = 0; i < 5; i++) {
    const ax = mx + 40 + seededRandom(i + 40) * (mw - 80);
    const ay = my + 30 + seededRandom(i + 50) * (mh - 60);
    const bx = mx + mw * 0.62, by = my + mh * 0.55;
    const k = ((t * 0.5 + i * 0.2) % 1);
    g.strokeStyle = i === 1 ? 'rgba(248,81,73,0.8)' : 'rgba(88,166,255,0.5)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 40, bx, by);
    g.stroke();
    const px = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * ((ax + bx) / 2) + k * k * bx;
    const py = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * (Math.min(ay, by) - 40) + k * k * by;
    g.fillStyle = i === 1 ? '#f85149' : '#7cc4f0';
    g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#3fb950';
  g.beginPath(); g.arc(mx + mw * 0.62, my + mh * 0.55, 5, 0, Math.PI * 2); g.fill();

  // Traffic sparkline
  const sx = 360, sy = 122, sw = 392, sh = 140;
  g.fillStyle = '#0b1318';
  g.fillRect(sx, sy, sw, sh);
  g.strokeStyle = '#3fb950';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 60; i++) {
    const v = 0.4 + 0.35 * seededRandom(i * 11 + Math.floor(t)) + 0.15 * Math.sin(i * 0.4 + t * 3);
    const x = sx + (sw * i) / 59, y = sy + sh - v * (sh - 20) - 8;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#6f8a7c';
  g.font = '500 12px Inter, system-ui, sans-serif';
  g.fillText('INGRESS Gbps · last 60 s', sx + 10, sy + 18);

  // Scrolling event log
  g.font = '500 14px "JetBrains Mono", Consolas, monospace';
  const rows = 8;
  const start = Math.floor(t * 0.8);
  for (let i = 0; i < rows; i++) {
    const ev = SOC_EVENTS[(start + i) % SOC_EVENTS.length];
    const y = 284 + i * 19;
    const col = ev[0] === 'CRIT' ? '#f85149' : ev[0] === 'WARN' ? '#e3b341' : '#3fb950';
    g.fillStyle = col;
    g.fillText(ev[0].padEnd(5), 16, y);
    g.fillStyle = '#7fa0b3';
    g.fillText(ev[1].padEnd(13), 70, y);
    g.fillStyle = '#cfe3ea';
    g.fillText(ev[2], 200, y);
  }
}

const PAINTERS: Record<ScreenKind, (g: CanvasRenderingContext2D, t: number) => void> = {
  code: paintCode,
  ai: paintAi,
  security: paintSecurity,
};

/** Three shared screen textures (code / ai / security), repainted ~6 fps. */
type Bundle = Record<ScreenKind, { tex: THREE.CanvasTexture; g: CanvasRenderingContext2D }>;
/** Module-level cache so desks, TVs and room displays share the same three textures. */
const shared: { key: string; bundle: Bundle | null; lastPaint: number } = { key: '', bundle: null, lastPaint: -1 };

export function useScreenTextures(): Record<ScreenKind, THREE.CanvasTexture> {
  const ultra = useUiStore((s) => s.ultraQuality);
  const gl = useThree((s) => s.gl);
  const bundle = useMemo(() => {
    const key = `${ultra}`;
    if (shared.bundle && shared.key === key) return shared.bundle;
    const out = {} as Bundle;
    // Ultra: monitors render at 2× (1536×864) with max anisotropy
    const scale = ultra ? 2 : 1;
    for (const k of SCREEN_KINDS) {
      const c = document.createElement('canvas');
      c.width = W * scale;
      c.height = H * scale;
      const g = c.getContext('2d')!;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      PAINTERS[k](g, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = ultra ? gl.capabilities.getMaxAnisotropy() : 8;
      out[k] = { tex, g };
    }
    if (shared.bundle) SCREEN_KINDS.forEach((k) => shared.bundle![k].tex.dispose());
    shared.bundle = out;
    shared.key = key;
    return out;
  }, [ultra, gl]);
  useEffect(() => () => { /* shared textures live for the session */ }, [bundle]);

  const fast = useUiStore((s) => s.quality === 'fast');
  useFrame(({ clock }) => {
    // Whoever ticks first this frame repaints for everyone (fast mode: 3 fps)
    if (clock.elapsedTime - shared.lastPaint < (fast ? 1 / 3 : 1 / 6)) return;
    shared.lastPaint = clock.elapsedTime;
    for (const k of SCREEN_KINDS) {
      PAINTERS[k](bundle[k].g, clock.elapsedTime);
      bundle[k].tex.needsUpdate = true;
    }
  });

  return useMemo(
    () => ({ code: bundle.code.tex, ai: bundle.ai.tex, security: bundle.security.tex }),
    [bundle],
  );
}
