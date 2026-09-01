import { create } from 'zustand';
import type { OfficeThemeId } from '../config/officeThemes';
import { recommendQuality } from '../utils/hardware';
import { RENDER_BUDGETS } from '../utils/renderScale';

export type AppMode = 'live' | 'simulation' | 'sensor';
export type CameraMode = 'orbit' | 'follow' | 'cinematic';
export type RenderMode = 'stylized' | 'realistic';
export type RampMode = 'increase' | 'decrease' | null;
/** Render quality tier. fast = production-lightweight (no shadows/postfx, DPR ≤1, few skinned avatars),
 *  balanced = adaptive default, ultra = "8K" (native DPR, 4K TV, 4096 shadows). */
export type Quality = 'fast' | 'balanced' | 'ultra';
const QUALITY_KEY = 'airsense.quality';
const TV_MODE_KEY = 'airsense.tvMode';
const TV_BUDGET_KEY = 'airsense.tvBudgetMp';
const AUTO_TUNE_KEY = 'airsense.autoTune';
function loadAutoTune(): boolean {
  try { return localStorage.getItem(AUTO_TUNE_KEY) !== '0'; } catch { return true; }
}
function loadTvMode(): boolean {
  try { return localStorage.getItem(TV_MODE_KEY) === '1'; } catch { return false; }
}
function loadTvBudget(): number {
  try {
    const n = Number(localStorage.getItem(TV_BUDGET_KEY));
    if (Number.isFinite(n) && n > 0) return n;
  } catch { /* ignore */ }
  return RENDER_BUDGETS.qhd;
}
function loadQuality(): Quality {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === 'fast' || q === 'balanced' || q === 'ultra') return q;
  } catch { /* private mode */ }
  // First visit: pick from the hardware (low-end → Fast straight away)
  return recommendQuality();
}

/** Dismissable UI surfaces (🗙). Restored from the RestorePill or "Show all". */
export type CardId = 'navbar' | 'live' | 'outdoor' | 'hvac' | 'comparison' | 'zones' | 'scenarios' | 'hud' | 'minimap';
export const CARD_LABELS: Record<CardId, string> = {
  navbar: 'Navbar',
  live: 'Live',
  outdoor: 'Outdoor',
  hvac: 'Room & HVAC',
  comparison: 'Compare',
  zones: 'Zones',
  scenarios: 'Scenarios',
  hud: 'HUD',
  minimap: 'Map',
};

export interface SelectedPerson {
  /** Stable person index within the zone's slot list. */
  index: number;
  zone: string;
}

interface UiStore {
  mode: AppMode;
  cameraMode: CameraMode;
  renderMode: RenderMode;
  /** Realistic-mode interior design preset (config/officeThemes.ts). */
  officeTheme: OfficeThemeId;
  /** Continuous condition ramp: 'increase' worsens, 'decrease' recovers. */
  rampMode: RampMode;
  dashboardOpen: boolean;
  chartsOpen: boolean;
  humanPanelOpen: boolean;
  thresholdsOpen: boolean;
  /** People-based data-viz overlay (ui/dataviz/DataVizOverlay). */
  dataVizOpen: boolean;
  selectedZone: string | null;
  selectedPerson: SelectedPerson | null;
  /** Employee mode: show every occupant's name tag and enlarged safety ring. Off = anonymous office. */
  employeeMode: boolean;
  quality: Quality;
  /** Derived: quality === 'ultra'. */
  ultraQuality: boolean;
  /**
   * Presentation output mode, for driving a large external display (the 64"
   * TV target). Renders the 3D canvas into a fixed pixel budget instead of a
   * device-ratio multiple, holds the picture quality steady for the length of
   * a talk (no adaptive downscale, no postprocessing bail-out, no automatic
   * tier drop) and bakes the environment at full resolution. DOM panels are
   * unaffected and keep rendering at the display's native resolution.
   */
  tvMode: boolean;
  /** Canvas render budget in megapixels while `tvMode` is on. */
  tvBudgetMp: number;
  /**
   * Full mode: browser fullscreen with every DOM panel hidden, leaving the
   * walkable office edge to edge. The navbar stays but auto-hides to the top
   * edge, so the controls are one mouse-move away. Esc leaves.
   *
   * Not persisted: the Fullscreen API can only be entered from a user gesture,
   * so a restored `true` on load would desync from the browser immediately.
   */
  fullMode: boolean;
  /**
   * Auto-tune: measure the real frame rate and walk the detail ladder in
   * `utils/autoTune.ts` until it holds the target, then freeze. Adapts the
   * picture to the machine and display actually in front of us instead of
   * guessing it from a hardware string.
   */
  autoTune: boolean;
  /** Cards the user closed with 🗙. */
  hiddenCards: Partial<Record<CardId, boolean>>;
  /** Active scenario id, or 'presentation', or null. */
  activeScenario: string | null;
  presentationScene: number;

  setMode: (mode: AppMode) => void;
  setCameraMode: (mode: CameraMode) => void;
  setRenderMode: (mode: RenderMode) => void;
  setOfficeTheme: (theme: OfficeThemeId) => void;
  setRampMode: (mode: RampMode) => void;
  toggle: (panel: 'dashboardOpen' | 'chartsOpen' | 'humanPanelOpen' | 'thresholdsOpen' | 'dataVizOpen') => void;
  setSelectedZone: (zone: string | null) => void;
  setSelectedPerson: (person: SelectedPerson | null) => void;
  setEmployeeMode: (on: boolean) => void;
  setActiveScenario: (id: string | null) => void;
  setPresentationScene: (scene: number) => void;
  setQuality: (q: Quality) => void;
  setUltraQuality: (on: boolean) => void;
  setTvMode: (on: boolean) => void;
  setTvBudgetMp: (mp: number) => void;
  setFullMode: (on: boolean) => void;
  setAutoTune: (on: boolean) => void;
  hideCard: (id: CardId) => void;
  showCard: (id: CardId) => void;
  showAllCards: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  mode: 'live',
  cameraMode: 'orbit',
  renderMode: 'realistic',
  officeTheme: 'noir',
  rampMode: null,
  dashboardOpen: true,
  chartsOpen: false,
  humanPanelOpen: false,
  thresholdsOpen: false,
  dataVizOpen: false,
  selectedZone: null,
  selectedPerson: null,
  employeeMode: false,
  quality: loadQuality(),
  ultraQuality: loadQuality() === 'ultra',
  tvMode: loadTvMode(),
  tvBudgetMp: loadTvBudget(),
  fullMode: false,
  autoTune: loadAutoTune(),
  hiddenCards: {},
  activeScenario: null,
  presentationScene: 0,

  setMode: (mode) => set({ mode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setOfficeTheme: (officeTheme) => set({ officeTheme }),
  setRampMode: (rampMode) => set({ rampMode }),
  toggle: (panel) => set({ [panel]: !get()[panel] } as Partial<UiStore>),
  setSelectedZone: (selectedZone) => set({ selectedZone }),
  setSelectedPerson: (selectedPerson) => set({ selectedPerson }),
  setEmployeeMode: (employeeMode) => set({ employeeMode }),
  setActiveScenario: (activeScenario) => set({ activeScenario }),
  setPresentationScene: (presentationScene) => set({ presentationScene }),
  setQuality: (quality) => {
    try { localStorage.setItem(QUALITY_KEY, quality); } catch { /* ignore */ }
    set({ quality, ultraQuality: quality === 'ultra' });
  },
  setUltraQuality: (on) => get().setQuality(on ? 'ultra' : 'balanced'),
  setTvMode: (tvMode) => {
    try { localStorage.setItem(TV_MODE_KEY, tvMode ? '1' : '0'); } catch { /* ignore */ }
    set({ tvMode });
  },
  setTvBudgetMp: (tvBudgetMp) => {
    try { localStorage.setItem(TV_BUDGET_KEY, String(tvBudgetMp)); } catch { /* ignore */ }
    set({ tvBudgetMp });
  },
  setFullMode: (fullMode) => set({ fullMode }),
  setAutoTune: (autoTune) => {
    try { localStorage.setItem(AUTO_TUNE_KEY, autoTune ? '1' : '0'); } catch { /* ignore */ }
    set({ autoTune });
  },
  hideCard: (id) => set({ hiddenCards: { ...get().hiddenCards, [id]: true } }),
  showCard: (id) => set({ hiddenCards: { ...get().hiddenCards, [id]: false } }),
  showAllCards: () => set({ hiddenCards: {} }),
}));
