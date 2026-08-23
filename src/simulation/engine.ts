import {
  DEFAULT_PARAMS,
  HISTORY_SAMPLE_EVERY,
  MAX_SUBSTEP,
  SIM_SECONDS_PER_REAL_SECOND,
  SNAPSHOT_HZ,
  TICK_HZ,
} from '../config/constants';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../config/thresholds';
import type {
  Alert,
  EnvironmentSnapshot,
  OutdoorConditions,
  ZoneId,
  ZoneReading,
} from '../types/environment';
import type { SimParams } from '../types/simulation';
import { absToRh, clamp, rhToAbs } from '../utils/math';
import { simClock } from '../utils/format';
import { AlertManager } from './alerts';
import { HistoryBuffer } from './history';
import {
  achFresh,
  co2Step,
  humidityStep,
  o2FromCo2,
  temperatureStep,
  type ZonePhysicsState,
} from './physics';
import { recommendationsFor } from './recommendations';
import { zoneStatus } from './statusEngine';
import { buildZones, ZONE_ADJACENCY, ZONE_IDS } from './zones';

export interface EngineListeners {
  onSnapshot?: (snapshot: EnvironmentSnapshot, activeAlerts: Alert[], historyVersion: number) => void;
  onAlert?: (alert: Alert) => void;
}

/**
 * Fixed-step simulation engine. Lives outside React; the R3F scene reads it
 * directly per frame, the DOM receives throttled snapshots.
 */
export class SimulationEngine {
  params: SimParams = structuredClone(DEFAULT_PARAMS);
  thresholds: Thresholds = structuredClone(DEFAULT_THRESHOLDS);
  outdoor: OutdoorConditions | null = null;

  simTime = 0; // sim seconds since start/reset
  running = true;

  /** Hot per-zone physics state, keyed by zone id. Read by R3F every frame. */
  readonly zoneState: Record<ZoneId, ZonePhysicsState> = this.seedZoneStates();
  /** Latest full snapshot (also read directly by R3F helpers). */
  snapshot: EnvironmentSnapshot = this.buildSnapshot();
  activeAlerts: Alert[] = [];
  readonly history = new HistoryBuffer();

  private alertManager = new AlertManager();
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastWall = 0;
  private nextHistoryAt = 0;
  private nextSnapshotWall = 0;
  private listeners: EngineListeners = {};

  start(listeners: EngineListeners) {
    this.listeners = listeners;
    if (this.interval) return;
    this.lastWall = performance.now();
    this.interval = setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  setRunning(running: boolean) {
    if (running && !this.running) this.lastWall = performance.now();
    this.running = running;
  }

  setParams(patch: Partial<SimParams>) {
    this.params = { ...this.params, ...patch };
  }

  setThresholds(t: Thresholds) {
    this.thresholds = t;
  }

  setOutdoor(outdoor: OutdoorConditions | null) {
    this.outdoor = outdoor;
  }

  totalPeople(): number {
    const p = this.params.peoplePerZone;
    return p.A + p.B + p.C + p.D;
  }

  /** Distribute a total headcount across zones proportionally (round-robin remainder). */
  setTotalPeople(total: number) {
    const t = clamp(Math.round(total), 0, 400);
    const current = this.totalPeople();
    const next = { ...this.params.peoplePerZone };
    if (current === 0) {
      const base = Math.floor(t / 4);
      let rem = t - base * 4;
      for (const id of ZONE_IDS) {
        next[id] = base + (rem > 0 ? 1 : 0);
        rem--;
      }
    } else {
      let assigned = 0;
      for (const id of ZONE_IDS) {
        next[id] = Math.floor((this.params.peoplePerZone[id] / current) * t);
        assigned += next[id];
      }
      let rem = t - assigned;
      for (const id of ZONE_IDS) {
        if (rem <= 0) break;
        next[id]++;
        rem--;
      }
    }
    this.params = { ...this.params, peoplePerZone: next };
  }

  reset() {
    const { initial } = this.params;
    for (const id of ZONE_IDS) {
      this.zoneState[id].co2 = initial.co2;
      this.zoneState[id].temperature = initial.temperature;
      this.zoneState[id].absHumidity = rhToAbs(initial.humidity, initial.temperature);
    }
    this.simTime = 0;
    this.nextHistoryAt = 0;
    this.history.clear();
    this.alertManager.reset();
    this.activeAlerts = [];
    this.publish();
  }

  private seedZoneStates(): Record<ZoneId, ZonePhysicsState> {
    const { initial } = DEFAULT_PARAMS;
    const make = (): ZonePhysicsState => ({
      co2: initial.co2,
      temperature: initial.temperature,
      absHumidity: rhToAbs(initial.humidity, initial.temperature),
    });
    return { A: make(), B: make(), C: make(), D: make() };
  }

  private tick() {
    const now = performance.now();
    // Clamp late ticks to 1 s of wall time: background tabs throttle timers to
    // 1 Hz, so this keeps sim pace truthful there while bounding physics jumps.
    const realDt = Math.min((now - this.lastWall) / 1000, 1.0);
    this.lastWall = now;
    if (!this.running) return;

    let simDt = realDt * SIM_SECONDS_PER_REAL_SECOND * this.params.speed;
    while (simDt > 0) {
      const step = Math.min(simDt, MAX_SUBSTEP);
      this.substep(step);
      simDt -= step;
    }

    // History sampling on sim-time grid
    while (this.simTime >= this.nextHistoryAt) {
      this.sampleHistory();
      this.nextHistoryAt += HISTORY_SAMPLE_EVERY;
    }

    if (now >= this.nextSnapshotWall) {
      this.publish();
      this.nextSnapshotWall = now + 1000 / SNAPSHOT_HZ;
    }
  }

  private substep(dtSimSeconds: number) {
    const p = this.params;
    const dtHours = dtSimSeconds / 3600;
    const zones = buildZones(p.room);
    const outdoorTemp = this.outdoor?.temperature ?? 32;
    const outdoorRh = this.outdoor?.humidity ?? 70;
    const outdoorW = rhToAbs(outdoorRh, outdoorTemp);
    const wind = this.outdoor?.windSpeed ?? 10;

    const { total: ach, mech: achMech } = achFresh({
      ventilation: p.ventilation / 100,
      freshAir: p.freshAir / 100,
      windowsOpen: p.windowsOpen,
      doorOpen: p.doorOpen,
      windSpeedKmh: wind,
    });

    for (const id of ZONE_IDS) {
      const s = this.zoneState[id];
      const people = p.peoplePerZone[id];
      const ctx = {
        people,
        desks: Math.ceil(people / 2),
        volume: zones[id].volume,
        achFresh: ach,
        achMech,
        ac: p.ac / 100,
        acSetpoint: p.acSetpoint,
        outdoorTemp,
        outdoorAbsHumidity: outdoorW,
        dtHours,
      };
      s.co2 = co2Step(s.co2, ctx);
      s.temperature = temperatureStep(s.temperature, ctx);
      s.absHumidity = humidityStep(s.absHumidity, ctx);
    }

    // Inter-zone mixing (symmetric relaxation on adjacent pairs)
    const kMix = (0.8 + 2.2 * (p.ventilation / 100) + (p.doorOpen ? 1 : 0)) * dtHours;
    for (const [a, b] of ZONE_ADJACENCY) {
      const za = this.zoneState[a];
      const zb = this.zoneState[b];
      const mix = (va: number, vb: number): [number, number] => {
        const d = (vb - va) * Math.min(kMix, 0.45);
        return [va + d, vb - d];
      };
      [za.co2, zb.co2] = mix(za.co2, zb.co2);
      [za.temperature, zb.temperature] = mix(za.temperature, zb.temperature);
      [za.absHumidity, zb.absHumidity] = mix(za.absHumidity, zb.absHumidity);
    }

    this.simTime += dtSimSeconds;
  }

  private zoneReadings(): ZoneReading[] {
    const p = this.params;
    return ZONE_IDS.map((id) => {
      const s = this.zoneState[id];
      const humidity = absToRh(s.absHumidity, s.temperature);
      return {
        id,
        name: `Zone ${id}`,
        people: p.peoplePerZone[id],
        co2: s.co2,
        o2: o2FromCo2(s.co2),
        temperature: s.temperature,
        humidity,
        absHumidity: s.absHumidity,
        airflow: 0.1 + (p.ventilation / 100) * 0.8 + (p.windowsOpen ? 0.15 : 0),
        status: zoneStatus({ co2: s.co2, temperature: s.temperature, humidity }, this.thresholds),
      };
    });
  }

  private buildSnapshot(): EnvironmentSnapshot {
    const zones = this.zoneReadings();
    const avg = (f: (z: ZoneReading) => number) => zones.reduce((s, z) => s + f(z), 0) / zones.length;
    const statuses = zones.map((z) => z.status);
    const overallStatus = statuses.includes('red') ? 'red' : statuses.includes('yellow') ? 'yellow' : 'green';
    return {
      simTime: this.simTime,
      simClock: simClock(this.simTime),
      zones,
      overall: {
        people: this.totalPeople(),
        co2: avg((z) => z.co2),
        o2: avg((z) => z.o2),
        temperature: avg((z) => z.temperature),
        humidity: avg((z) => z.humidity),
        ventilation: this.params.ventilation,
        airflow: avg((z) => z.airflow),
        status: overallStatus,
      },
    };
  }

  private sampleHistory() {
    const snap = this.buildSnapshot();
    this.history.push({
      t: this.simTime,
      co2: snap.overall.co2,
      o2: snap.overall.o2,
      temperature: snap.overall.temperature,
      humidity: snap.overall.humidity,
      people: snap.overall.people,
      ventilation: this.params.ventilation,
      outdoorTemp: this.outdoor?.temperature ?? null,
      outdoorAqi: this.outdoor?.aqi ?? null,
    });
  }

  private publish() {
    this.snapshot = this.buildSnapshot();
    const { active, fired } = this.alertManager.update(
      this.snapshot.zones,
      this.simTime,
      this.thresholds,
      (zone) => {
        const recs = recommendationsFor({
          co2: zone.co2,
          temperature: zone.temperature,
          humidity: zone.humidity,
          people: zone.people,
          ventilation: this.params.ventilation,
          windowsOpen: this.params.windowsOpen,
          outdoor: this.outdoor,
        });
        return recs[0] ?? 'Review ventilation conditions.';
      },
    );
    this.activeAlerts = active;
    for (const alert of fired) this.listeners.onAlert?.(alert);
    this.listeners.onSnapshot?.(this.snapshot, active, this.history.version);
  }
}

/** App-wide singleton. */
export const engine = new SimulationEngine();
