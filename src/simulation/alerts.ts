import type { Alert, Status, ZoneId, ZoneReading } from '../types/environment';
import type { Thresholds } from '../config/thresholds';
import { worstParameter } from './statusEngine';
import { fmt } from '../utils/format';

const HOLD_SIM_SECONDS = 60; // must hold out-of-band this long to fire, and in-band to clear

interface ZoneAlertTrack {
  candidateSince: number | null;
  candidateSeverity: Exclude<Status, 'green'> | null;
  active: Alert | null;
  clearSince: number | null;
}

const PARAM_LABEL = { co2: 'CO₂', temperature: 'Temperature', humidity: 'Humidity' } as const;

/** Hysteresis-based alert manager: no flapping (spec §33). */
export class AlertManager {
  private tracks = new Map<ZoneId, ZoneAlertTrack>();
  private counter = 0;

  update(
    zones: ZoneReading[],
    simTime: number,
    thresholds: Thresholds,
    recommend: (zone: ZoneReading) => string,
  ): { active: Alert[]; fired: Alert[] } {
    const fired: Alert[] = [];

    for (const zone of zones) {
      let track = this.tracks.get(zone.id);
      if (!track) {
        track = { candidateSince: null, candidateSeverity: null, active: null, clearSince: null };
        this.tracks.set(zone.id, track);
      }

      if (zone.status === 'green') {
        track.candidateSince = null;
        track.candidateSeverity = null;
        if (track.active) {
          track.clearSince ??= simTime;
          if (simTime - track.clearSince >= HOLD_SIM_SECONDS) {
            track.active = null;
            track.clearSince = null;
          }
        }
        continue;
      }

      track.clearSince = null;
      const severity = zone.status as Exclude<Status, 'green'>;

      if (track.active) {
        // Escalate yellow → red immediately.
        if (severity === 'red' && track.active.severity === 'yellow') {
          track.active = this.build(zone, severity, simTime, thresholds, recommend);
          fired.push(track.active);
        }
        continue;
      }

      if (track.candidateSeverity !== severity) {
        track.candidateSeverity = severity;
        track.candidateSince = simTime;
      }
      if (track.candidateSince != null && simTime - track.candidateSince >= HOLD_SIM_SECONDS) {
        track.active = this.build(zone, severity, simTime, thresholds, recommend);
        fired.push(track.active);
        track.candidateSince = null;
        track.candidateSeverity = null;
      }
    }

    const active = [...this.tracks.values()]
      .map((t) => t.active)
      .filter((a): a is Alert => a != null)
      .sort((a, b) => b.createdAtSim - a.createdAtSim);
    return { active, fired };
  }

  reset() {
    this.tracks.clear();
  }

  private build(
    zone: ZoneReading,
    severity: Exclude<Status, 'green'>,
    simTime: number,
    thresholds: Thresholds,
    recommend: (zone: ZoneReading) => string,
  ): Alert {
    const { param } = worstParameter(zone, thresholds);
    const value =
      param === 'co2'
        ? `${fmt(zone.co2)} ppm`
        : param === 'temperature'
          ? `${fmt(zone.temperature, 1)} °C`
          : `${fmt(zone.humidity)} %`;
    return {
      id: `alert-${++this.counter}`,
      zoneId: zone.id,
      severity,
      title: `${PARAM_LABEL[param]} ${severity === 'red' ? 'alert' : 'attention'} — Zone ${zone.id}`,
      detail: `${PARAM_LABEL[param]}: ${value} · Occupancy: ${zone.people} people`,
      recommendation: recommend(zone),
      createdAtSim: simTime,
    };
  }
}
