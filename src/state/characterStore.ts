import { create } from 'zustand';
import type { ZoneId } from '../types/environment';
import type { Seat } from '../scene/office/officeLayout';

/** What the player avatar is doing. Coarse and user-driven, so it may live in React. */
export type Activity = 'idle' | 'sitting' | 'dancing';

/**
 * Only zone-crossing-level facts live here (HUD re-renders on zone change).
 * The character's live position stays in refs inside the controller.
 */
interface CharacterStore {
  zone: ZoneId;
  enabled: boolean;
  /** Idle (walking around), seated at a desk, or dancing. */
  activity: Activity;
  /** True while free seats are highlighted for click-to-sit. */
  seatPicker: boolean;
  setZone: (zone: ZoneId) => void;
  setEnabled: (enabled: boolean) => void;
  setActivity: (activity: Activity) => void;
  setSeatPicker: (seatPicker: boolean) => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  zone: 'C',
  enabled: true,
  activity: 'idle',
  seatPicker: false,
  setZone: (zone) => set({ zone }),
  setEnabled: (enabled) => set({ enabled }),
  setActivity: (activity) => set({ activity }),
  setSeatPicker: (seatPicker) => set({ seatPicker }),
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
  /** Seat being walked toward; becomes `seat` on arrival. */
  pendingSeat: Seat | null;
  /** Seat currently occupied (null when standing). */
  seat: Seat | null;
  /** Vertical offset in metres, driven by the jump arc. */
  yOffset: number;
  /** Jump vertical velocity (m/s); 0 when grounded. */
  jumpVel: number;
  /** Seconds since the current emote started. */
  emoteT: number;
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
  pendingSeat: null,
  seat: null,
  yOffset: 0,
  jumpVel: 0,
  emoteT: 0,
};

/** Stand up from a seat / stop dancing and hand control back to the walk controller. */
export function standUp(): void {
  characterTransient.seat = null;
  characterTransient.pendingSeat = null;
  characterTransient.emoteT = 0;
  useCharacterStore.getState().setActivity('idle');
}

/** Initial vertical velocity of a jump (m/s); the controller integrates the arc. */
export const JUMP_SPEED = 3.6;

/** Hop, standing up first if seated. Ignored while already airborne. */
export function jump(): void {
  const ct = characterTransient;
  if (ct.yOffset !== 0 || ct.jumpVel !== 0) return;
  if (ct.seat) standUp();
  ct.jumpVel = JUMP_SPEED;
}

/** Start dancing, or stop if already dancing. Leaves any seat first. */
export function toggleDance(): void {
  const wasDancing = useCharacterStore.getState().activity === 'dancing';
  standUp();
  if (!wasDancing) {
    characterTransient.emoteT = 0;
    useCharacterStore.getState().setActivity('dancing');
  }
}

/** Begin walking to `seat`; the controller seats the avatar on arrival. */
export function walkToSeat(seat: Seat): void {
  const ct = characterTransient;
  ct.pendingSeat = seat;
  ct.seat = null;
  ct.target = { x: seat.x - Math.sin(seat.angle) * 0.28, z: seat.z - Math.cos(seat.angle) * 0.28 };
  ct.targetSetAt = performance.now() / 1000;
  useCharacterStore.getState().setActivity('idle');
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__char = characterTransient;
  (window as unknown as Record<string, unknown>).__charStore = useCharacterStore;
}
