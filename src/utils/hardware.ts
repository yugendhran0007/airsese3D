/**
 * Cheap, synchronous hardware sniff used once at startup to pick a default
 * quality tier. Low-end laptops (few cores, little RAM, integrated GPU) start
 * in Fast immediately instead of stalling for the seconds it takes the
 * PerformanceMonitor to notice. The user can always override in the navbar.
 */
import type { Quality } from '../state/uiStore';

const INTEGRATED = /intel|uhd|iris|vega|radeon\(tm\) graphics|radeon graphics|mali|adreno|apple gpu|swiftshader|llvmpipe|software/i;
const DISCRETE = /rtx|gtx|geforce|radeon rx|arc a|quadro/i;

export function detectGpuRenderer(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r ?? '';
  } catch {
    return '';
  }
}

export function recommendQuality(): Quality {
  if (typeof navigator === 'undefined') return 'balanced';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const gpu = detectGpuRenderer();
  if (DISCRETE.test(gpu)) return 'balanced';
  if (INTEGRATED.test(gpu) || cores <= 4 || mem <= 4) return 'fast';
  return 'balanced';
}
