import { create } from 'zustand';
import type { ZoneId } from '../types/environment';

/**
 * Only zone-crossing-level facts live here (HUD re-renders on zone change).
 * The character's live position stays in refs inside the controller.
 */
interface CharacterStore {
  zone: ZoneId;
  enabled: boolean;
  setZone: (zone: ZoneId) => void;
  setEnabled: (enabled: boolean) => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  zone: 'C',
  enabled: true,
  setZone: (zone) => set({ zone }),
  setEnabled: (enabled) => set({ enabled }),
}));

/** Mutable transient shared between controller and camera (no React). */
export const characterTransient: {
  position: { x: number; z: number };
  heading: number;
  speed: number;
  target: { x: number; z: number } | null;
  targetSetAt: number;
  /** Follow-cam orbit: distance (Q zooms in / Shift zooms out / wheel), yaw offset from heading and pitch (mouse drag). */
  camDist: number;
  camYaw: number;
  camPitch: number;
} = {
  position: { x: -2, z: 4 },
  heading: 0,
  speed: 0,
  /** Click-to-walk target, null when idle. */
  target: null,
  targetSetAt: 0,
  camDist: 4.5,
  camYaw: 0,
  camPitch: 0.42,
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__char = characterTransient;
}
