import { create } from 'zustand';
import type { OfficeThemeId } from '../config/officeThemes';

export type AppMode = 'live' | 'simulation' | 'sensor';
export type CameraMode = 'orbit' | 'follow' | 'cinematic';
export type RenderMode = 'stylized' | 'realistic';
export type RampMode = 'increase' | 'decrease' | null;
/** Render quality tier. fast = production-lightweight (no shadows/postfx, DPR ≤1, few skinned avatars),
 *  balanced = adaptive default, ultra = "8K" (native DPR, 4K TV, 4096 shadows). */
export type Quality = 'fast' | 'balanced' | 'ultra';
const QUALITY_KEY = 'airsense.quality';
function loadQuality(): Quality {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === 'fast' || q === 'balanced' || q === 'ultra') return q;
  } catch { /* private mode */ }
  return 'balanced';
}

/** Dismissable UI surfaces (🗙). Restored from the RestorePill or "Show all". */
export type CardId = 'navbar' | 'controls' | 'live' | 'outdoor' | 'comparison' | 'zones' | 'alerts' | 'scenarios' | 'hud' | 'minimap';
export const CARD_LABELS: Record<CardId, string> = {
  navbar: 'Navbar',
  controls: 'Controls',
  live: 'Live',
  outdoor: 'Outdoor',
  comparison: 'Compare',
  zones: 'Zones',
  alerts: 'Alerts',
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
  controlsOpen: boolean;
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
  toggle: (panel: 'controlsOpen' | 'dashboardOpen' | 'chartsOpen' | 'humanPanelOpen' | 'thresholdsOpen' | 'dataVizOpen') => void;
  setSelectedZone: (zone: string | null) => void;
  setSelectedPerson: (person: SelectedPerson | null) => void;
  setEmployeeMode: (on: boolean) => void;
  setActiveScenario: (id: string | null) => void;
  setPresentationScene: (scene: number) => void;
  setQuality: (q: Quality) => void;
  setUltraQuality: (on: boolean) => void;
  hideCard: (id: CardId) => void;
  showCard: (id: CardId) => void;
  showAllCards: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  mode: 'live',
  cameraMode: 'orbit',
  renderMode: 'realistic',
  officeTheme: 'navy-oak',
  rampMode: null,
  controlsOpen: true,
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
  hideCard: (id) => set({ hiddenCards: { ...get().hiddenCards, [id]: true } }),
  showCard: (id) => set({ hiddenCards: { ...get().hiddenCards, [id]: false } }),
  showAllCards: () => set({ hiddenCards: {} }),
}));
