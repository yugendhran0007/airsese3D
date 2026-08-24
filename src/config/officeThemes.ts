/**
 * Interior design presets for realistic mode. Each theme is a palette that
 * InteriorDecor, OfficeShell, RealisticFurniture and Lighting read; switching
 * is instant (materials re-colour, geometry is shared). Desks/chairs/ceiling
 * stay the white IT-office baseline — themes change walls, feature panels,
 * accents, carpet, lounge seating and the art.
 */
export type OfficeThemeId = 'navy-oak' | 'forest' | 'midnight' | 'noir' | 'sunset';

export interface OfficeTheme {
  id: OfficeThemeId;
  label: string;
  /** Short description for the picker tooltip. */
  blurb: string;
  /** Building wall paint. */
  wall: string;
  /** Carpet tint (multiplies the grey carpet texture). */
  carpet: string;
  /** Aisle runner + entrance mat. */
  runner: string;
  mat: string;
  /** Brand feature walls behind the TVs. */
  feature: string;
  /** LED cove strip on the feature walls. */
  cove: string;
  /** Wall slats + backing. */
  slat: string;
  slatBack: string;
  /** Cafeteria ceiling raft + café table wood. */
  raft: string;
  /** Lounge chair fabric. */
  lounge: string;
  /** Desk privacy screens + pedestals. */
  deskScreen: string;
  pedestal: string;
  /** Framed art palette (legacy accent swatches, still used for small decor). */
  art: string[];
  /** Poster frame and mount-board colours. */
  frame: string;
  mount: string;
  /** Warm accent light over the cafeteria. */
  accentLight: string;
  /** Planter pot colour. */
  pot: string;
}

export const OFFICE_THEMES: Record<OfficeThemeId, OfficeTheme> = {
  'navy-oak': {
    id: 'navy-oak',
    label: 'Navy & Oak',
    blurb: 'Corporate: navy brand walls, oak slats, blue-grey runners, teal lounge',
    wall: '#eef0f3',
    carpet: '#d4d6da',
    runner: '#5d6d86',
    mat: '#2c3442',
    feature: '#0f2342',
    cove: '#7cc4f0',
    slat: '#b98a5a',
    slatBack: '#2b2f36',
    raft: '#8f6437',
    lounge: '#1f5f6b',
    deskScreen: '#aeb3ba',
    pedestal: '#e4dcc8',
    art: ['#2f6fb3', '#e0a23a', '#1f5f6b', '#c74b4b'],
    frame: '#1a1c20',
    mount: '#f7f5f0',
    accentLight: '#ffd9a8',
    pot: '#f4f5f7',
  },
  forest: {
    id: 'forest',
    label: 'Forest',
    blurb: 'Biophilic: sage walls, deep-green feature panels, walnut slats, moss carpet',
    wall: '#eceee8',
    carpet: '#c9cfc2',
    runner: '#6d8a6a',
    mat: '#2f3a2f',
    feature: '#1c4a3a',
    cove: '#a8e6b0',
    slat: '#6e4a2e',
    slatBack: '#23201c',
    raft: '#5b3d26',
    lounge: '#2f6b4f',
    deskScreen: '#9aa89a',
    pedestal: '#d9cfb8',
    art: ['#2f6b4f', '#c9a449', '#8a5a3b', '#4c7a8f'],
    frame: '#2a2f27',
    mount: '#f4f2ea',
    accentLight: '#ffe6b8',
    pot: '#d9d3c4',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    blurb: 'Dark modern: charcoal walls, black slats, cyan LED accents, graphite carpet',
    wall: '#3a3f47',
    carpet: '#6a6e75',
    runner: '#2b3340',
    mat: '#15181d',
    feature: '#0b0f16',
    cove: '#38e1ff',
    slat: '#1e2227',
    slatBack: '#0c0e11',
    raft: '#2a2e34',
    lounge: '#1b4f72',
    deskScreen: '#4a5058',
    pedestal: '#3b3f46',
    art: ['#38e1ff', '#ff6b3d', '#8b5cf6', '#2ee6a6'],
    frame: '#0c0e11',
    mount: '#15181d',
    accentLight: '#9fd8ff',
    pot: '#2a2e34',
  },
  noir: {
    id: 'noir',
    label: 'Noir Ember',
    blurb: 'Dark gallery: near-black walls, deep teal panels, ember-orange accents, charcoal carpet',
    wall: '#171b21',
    carpet: '#2b2f36',
    runner: '#123039',
    mat: '#0b0e12',
    feature: '#0d2a33',
    cove: '#ff8a3d',
    slat: '#141a1f',
    slatBack: '#080a0d',
    raft: '#1d2228',
    lounge: '#0f4a56',
    deskScreen: '#2f353d',
    pedestal: '#262b32',
    art: ['#2aa9b8', '#ff8a3d', '#f5c26b', '#1f6f7d'],
    frame: '#0a0c0f',
    mount: '#10141a',
    accentLight: '#ffb066',
    pot: '#1d2228',
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    blurb: 'Warm creative: terracotta feature walls, light ash slats, mustard lounge chairs',
    wall: '#f5efe6',
    carpet: '#d9cfc2',
    runner: '#b0795a',
    mat: '#4a2f25',
    feature: '#b8452b',
    cove: '#ffd38a',
    slat: '#d8c3a5',
    slatBack: '#5a4034',
    raft: '#c49a6c',
    lounge: '#d69a2f',
    deskScreen: '#c8b9a8',
    pedestal: '#eadcc6',
    art: ['#b8452b', '#d69a2f', '#2f6b4f', '#3a5a8f'],
    frame: '#4a2f25',
    mount: '#faf4e8',
    accentLight: '#ffc98a',
    pot: '#e8d7c3',
  },
};

export const OFFICE_THEME_IDS = Object.keys(OFFICE_THEMES) as OfficeThemeId[];
