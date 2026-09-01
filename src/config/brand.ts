/**
 * Finstein brand assets, in one place.
 *
 * The mark is painted into a canvas texture on the office wall TVs
 * (`WallTvs.tsx`). It previously also drove an animated boot screen; that
 * screen was removed because the app now opens straight into the office rather
 * than holding the user behind a progress bar. The palette and block geometry
 * stay here so any future surface that draws the logo — a different rendering
 * path is exactly where two copies drift apart — reads one definition.
 *
 * The mark is a stepped "F" built from four rectangles on a 2.6 x 3 unit grid,
 * each one dropping in slightly after the last. `y` is measured **upward from
 * the baseline**, matching the canvas painter's coordinate convention; the SVG
 * consumer flips it.
 */
export const FINSTEIN = {
  navy: '#0b1a33',
  navy2: '#10264d',
  blueDark: '#1f5fa8',
  blue: '#3a8fd6',
  blueLight: '#7cc4f0',
} as const;

/** One block of the stepped-F mark: [x, y, width, height, colour, build delay]. */
export type MarkBlock = readonly [number, number, number, number, string, number];

/** The mark, in grid units. Width 2.6, height 3. */
export const FINSTEIN_MARK: readonly MarkBlock[] = [
  [0, 0, 1, 1, FINSTEIN.blueDark, 0],
  [0, 1, 1, 1, FINSTEIN.blue, 0.15],
  [1, 1, 1.6, 1, FINSTEIN.blueLight, 0.3],
  [0, 2, 2.6, 1, FINSTEIN.blueLight, 0.45],
];

export const MARK_UNITS_W = 2.6;
export const MARK_UNITS_H = 3;

/** Company line under the wordmark, same wording as the wall-TV animation. */
export const FINSTEIN_TAGLINE = 'Software · Security · Intelligence';
