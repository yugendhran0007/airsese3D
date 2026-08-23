import type { ZoneId } from './environment';

export interface RoomConfig {
  width: number; // m (X)
  length: number; // m (Z)
  height: number; // m
}

/** Every user-adjustable knob the engine consumes. */
export interface SimParams {
  room: RoomConfig;
  peoplePerZone: Record<ZoneId, number>;
  ventilation: number; // 0..100 %
  freshAir: number; // 0..100 %
  ac: number; // 0..100 %
  acSetpoint: number; // °C
  doorOpen: boolean;
  windowsOpen: boolean;
  speed: number; // 0.5 | 1 | 2 | 5 | 10
  initial: {
    co2: number;
    temperature: number;
    humidity: number; // % RH
  };
}

export type SimSpeed = 0.5 | 1 | 2 | 5 | 10;

export interface ScenarioStep {
  /** Sim-time offset (seconds) at which this step's targets are fully reached. */
  atSim: number;
  /** Partial params lerped toward between the previous step and this one. */
  targets: Partial<{
    totalPeople: number;
    ventilation: number;
    freshAir: number;
    ac: number;
    doorOpen: boolean;
    windowsOpen: boolean;
  }>;
  caption?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
}

export interface PresentationScene {
  id: number;
  title: string;
  caption: string;
  durationSim: number; // sim seconds
  camera: {
    position: [number, number, number];
    /** Optional dolly end position — the camera glides from `position` to `to` over the scene. */
    to?: [number, number, number];
    lookAt: [number, number, number];
  };
  targets?: ScenarioStep['targets'];
}
