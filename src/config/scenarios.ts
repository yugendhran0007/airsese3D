import type { PresentationScene, Scenario } from '../types/simulation';

/** Sim-minutes helper. */
const min = (m: number) => m * 60;

export const SCENARIOS: Scenario[] = [
  {
    id: 'normal',
    name: 'Normal Office',
    description: '25 people, healthy ventilation — a green baseline day.',
    steps: [
      { atSim: 0, targets: { totalPeople: 25, ventilation: 75, freshAir: 70, ac: 60 } },
      { atSim: min(60), targets: {} },
    ],
  },
  {
    id: 'rising-occupancy',
    name: 'Increasing Occupancy',
    description: 'Headcount climbs 20 → 80 while ventilation stays fixed.',
    steps: [
      { atSim: 0, targets: { totalPeople: 20, ventilation: 60, freshAir: 60, ac: 60 } },
      { atSim: min(15), targets: { totalPeople: 40 } },
      { atSim: min(30), targets: { totalPeople: 60 } },
      { atSim: min(45), targets: { totalPeople: 80 } },
      { atSim: min(70), targets: {} },
    ],
  },
  {
    id: 'poor-ventilation',
    name: 'Poor Ventilation',
    description: '50 people with ventilation cut to 25% — watch CO₂ climb.',
    steps: [
      { atSim: 0, targets: { totalPeople: 50, ventilation: 25, freshAir: 30, ac: 50 } },
      { atSim: min(75), targets: {} },
    ],
  },
  {
    id: 'improved-ventilation',
    name: 'Improved Ventilation',
    description: 'Recovery: ventilation ramps 30% → 90% and the room clears.',
    steps: [
      { atSim: 0, targets: { totalPeople: 60, ventilation: 30, freshAir: 40, ac: 55 } },
      { atSim: min(25), targets: { ventilation: 30 } },
      { atSim: min(40), targets: { ventilation: 90, freshAir: 90, ac: 85 } },
      { atSim: min(90), targets: {} },
    ],
  },
  {
    id: 'reduced-occupancy',
    name: 'Reduced Occupancy',
    description: 'End of day: 80 people leave in waves down to 20.',
    steps: [
      { atSim: 0, targets: { totalPeople: 80, ventilation: 60, freshAir: 60, ac: 60 } },
      { atSim: min(15), targets: { totalPeople: 60 } },
      { atSim: min(30), targets: { totalPeople: 40 } },
      { atSim: min(45), targets: { totalPeople: 20 } },
      { atSim: min(70), targets: {} },
    ],
  },
];

/** 9-scene presentation script (spec §38) with camera keyframes. */
export const PRESENTATION_SCENES: PresentationScene[] = [
  {
    id: 1,
    title: 'A normal morning',
    caption: 'The office opens with comfortable occupancy and healthy air.',
    durationSim: min(60),
    camera: { position: [26, 15, 28], to: [19, 11, 21], lookAt: [0, 1, 0] },
    targets: { totalPeople: 20, ventilation: 70, freshAir: 65, ac: 60 },
  },
  {
    id: 2,
    title: 'People arrive',
    caption: 'Teams stream in — every person adds CO₂ and heat to the room.',
    durationSim: min(60),
    camera: { position: [12, 1.9, 8], to: [5, 1.9, 5], lookAt: [-4, 1.2, -2] },
    targets: { totalPeople: 45 },
  },
  {
    id: 3,
    title: 'Occupancy peaks',
    caption: 'A full floor: 80 people sharing the same 1,800 m³ of air.',
    durationSim: min(60),
    camera: { position: [-13, 2.2, 8], to: [-8, 2.4, 2], lookAt: [2, 1, -4] },
    targets: { totalPeople: 80 },
  },
  {
    id: 4,
    title: 'The air responds',
    caption: 'Zone indicators shift as CO₂ accumulates faster than it is removed.',
    durationSim: min(70),
    camera: { position: [0, 22, 3], to: [0, 17, 1], lookAt: [0, 0, 0] },
    targets: { ventilation: 22, freshAir: 25 },
  },
  {
    id: 5,
    title: 'The trend is clear',
    caption: 'The CO₂ chart climbs steadily — occupancy and ventilation out of balance.',
    durationSim: min(60),
    camera: { position: [13, 2.5, -8], to: [8, 2.6, -4], lookAt: [0, 1.6, 2] },
  },
  {
    id: 6,
    title: 'Ventilation steps up',
    caption: 'Fresh-air intake is raised to 90% — the HVAC system responds.',
    durationSim: min(60),
    camera: { position: [7, 2.2, 8], to: [2, 2.6, 4], lookAt: [0, 2.8, -6] },
    targets: { ventilation: 90, freshAir: 90, ac: 85 },
  },
  {
    id: 7,
    title: 'Air in motion',
    caption: 'Stronger airflow sweeps through every zone, flushing stale air out.',
    durationSim: min(60),
    camera: { position: [-12, 2.2, -8], to: [-6, 2.3, -4], lookAt: [4, 1.5, 4] },
  },
  {
    id: 8,
    title: 'Conditions recover',
    caption: 'CO₂ falls, zones return to green, and comfort is restored.',
    durationSim: min(70),
    camera: { position: [22, 12, 20], to: [16, 9, 14], lookAt: [0, 1, 0] },
  },
  {
    id: 9,
    title: 'The takeaway',
    caption: 'Occupancy + ventilation + room size decide indoor air. Balance them, and the office stays green.',
    durationSim: min(60),
    camera: { position: [28, 16, 28], to: [34, 20, 34], lookAt: [0, 1, 0] },
  },
];
