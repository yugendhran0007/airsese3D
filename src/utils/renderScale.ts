/**
 * Render-resolution budgeting (spec §37 — presentation output).
 *
 * The Canvas `dpr` prop is a *multiplier* on the CSS viewport, which is the
 * wrong control once the output panel gets very large. A 64" 8K TV resolves
 * either as a 7680×4320 CSS viewport at `devicePixelRatio` 1 (Windows at 100 %)
 * or as ~2560×1440 at `devicePixelRatio` 3 (Windows at 300 %). A fixed
 * multiplier lands on 33 MPix in the first case and 15 MPix in the second —
 * both far past what an RTX 3050 can draw this scene into, and the difference
 * between them is invisible to the app.
 *
 * Budgeting fixes the *absolute* number of pixels rendered and derives the
 * multiplier from the viewport actually in front of us, so one setting behaves
 * the same on a laptop panel, a 1080p projector and an 8K television.
 *
 * Rendering below the panel's native resolution is not a downgrade here: a 64"
 * 8K panel is ~138 PPI, and at normal presentation viewing distance the eye
 * cannot resolve anywhere near that. The TV's own upscaler covers the gap, and
 * because only the WebGL canvas is scaled, the DOM panels and numbers keep
 * rendering at the display's native resolution and stay perfectly crisp.
 */

/** Render-resolution presets, in megapixels of final canvas backing store. */
export const RENDER_BUDGETS = {
  /** ~1600×900. Fallback for weak GPUs driving a big panel. */
  low: 1.5,
  /** ~1920×1080. */
  hd: 2.1,
  /** ~2560×1440. The default: sharp on a large TV, comfortably smooth on a 3050. */
  qhd: 3.7,
  /** ~3840×2160. For a strong GPU, or a small enough scene. */
  uhd: 8.3,
} as const;

export type RenderBudgetId = keyof typeof RENDER_BUDGETS;

/**
 * Device-pixel-ratio that lands the canvas backing store on `budgetMp`
 * megapixels for the current CSS viewport.
 *
 * The floor is deliberately far below 1: it only binds on very large
 * viewports, which is precisely where we want the multiplier to be small.
 *
 * The budget is a **ceiling, not a target**. When the viewport is smaller than
 * the budget — a 1080p projector, or a laptop panel with TV mode left on — the
 * raw ratio comes out above 1 and would supersample a display that cannot show
 * the extra pixels. Measured on an Intel UHD: a 1920×1080 viewport under the
 * 3.7 MPix budget rendered 2.79 MPix and ran at 24 fps, *slower* than the same
 * scene on a 4K viewport where the budget actually bound (1.24 MPix, 36 fps).
 * So the ceiling is the device's own pixel ratio, never more.
 */
export function dprForBudget(
  budgetMp: number,
  cssW: number = typeof window === 'undefined' ? 1920 : window.innerWidth,
  cssH: number = typeof window === 'undefined' ? 1080 : window.innerHeight,
  maxDpr: number = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
): number {
  const cssPixels = Math.max(1, cssW * cssH);
  const dpr = Math.sqrt((budgetMp * 1_000_000) / cssPixels);
  return Math.min(Math.min(2, maxDpr), Math.max(0.2, dpr));
}

/**
 * CSS-pixel width the interface is designed against. Panels, type sizes and
 * paddings are all tuned so the shell reads correctly on a viewport this wide.
 */
const UI_BASELINE_WIDTH = 1920;

/**
 * Scale factor for the DOM interface on a very large display.
 *
 * The panels are sized in CSS pixels, so on a 7680-wide viewport they keep
 * their laptop size and shrink to a quarter of their intended share of the
 * screen — legible at desk distance, unreadable from across a room. Scaling
 * the shell by the viewport's ratio to the design width restores the physical
 * proportions the layout was built for, which is what matters when the display
 * is a 64" television several metres away.
 *
 * Returns exactly 1 at or below the baseline so ordinary screens are untouched.
 */
export function uiScaleForWidth(
  cssW: number = typeof window === 'undefined' ? UI_BASELINE_WIDTH : window.innerWidth,
): number {
  return Math.min(4, Math.max(1, cssW / UI_BASELINE_WIDTH));
}

/** Human-readable render resolution for a budget, e.g. "2560 × 1440". */
export function renderResolutionLabel(
  budgetMp: number,
  cssW: number = typeof window === 'undefined' ? 1920 : window.innerWidth,
  cssH: number = typeof window === 'undefined' ? 1080 : window.innerHeight,
): string {
  const d = dprForBudget(budgetMp, cssW, cssH);
  return `${Math.round(cssW * d)} × ${Math.round(cssH * d)}`;
}
