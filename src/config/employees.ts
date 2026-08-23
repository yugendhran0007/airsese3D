/**
 * Mock employee directory (spec §54 keeps occupants anonymous — these are
 * fictional placeholder records, generated deterministically per seat so a
 * given person keeps the same identity across frames, sessions and zones).
 * Never wire real HR data through here without an explicit privacy review.
 */
import { seededRandom } from '../utils/math';

export type Department = 'Cyber Security' | 'Software' | 'IoT' | 'Digital Marketing' | 'Finance';

export interface Employee {
  /** Stable badge id, e.g. FIN-A-03 (company prefix, zone, seat). */
  id: string;
  name: string;
  designation: string;
  department: Department;
  /** Zone letter + seat index this record belongs to. */
  zone: string;
  index: number;
  mock: true;
}

export const DEPARTMENTS: Department[] = ['Cyber Security', 'Software', 'IoT', 'Digital Marketing', 'Finance'];

const DESIGNATIONS: Record<Department, string[]> = {
  'Cyber Security': ['SOC Analyst', 'Security Engineer', 'Penetration Tester', 'Threat Intel Analyst', 'Security Lead'],
  Software: ['Software Engineer', 'Senior Software Engineer', 'Frontend Developer', 'Backend Developer', 'Tech Lead', 'QA Engineer'],
  IoT: ['IoT Engineer', 'Embedded Developer', 'Firmware Engineer', 'Sensor Systems Engineer', 'IoT Architect'],
  'Digital Marketing': ['Digital Marketing Executive', 'SEO Specialist', 'Content Strategist', 'Growth Analyst', 'Marketing Lead'],
  Finance: ['Finance Analyst', 'Accounts Executive', 'Payroll Specialist', 'Financial Controller', 'Auditor'],
};

// Fictional names (common Tamil / South-Indian given names + family names), gender-mixed.
const FIRST = [
  'Arjun', 'Priya', 'Karthik', 'Divya', 'Vignesh', 'Meera', 'Suresh', 'Anitha', 'Rahul', 'Lakshmi',
  'Harish', 'Kavya', 'Naveen', 'Sneha', 'Praveen', 'Deepika', 'Manoj', 'Nithya', 'Sanjay', 'Pooja',
  'Aravind', 'Shalini', 'Gokul', 'Revathi', 'Dinesh', 'Janani', 'Balaji', 'Keerthana', 'Ramesh', 'Swathi',
  'Vijay', 'Aishwarya', 'Saravanan', 'Bhavana', 'Mohan', 'Ishwarya', 'Senthil', 'Gayathri', 'Ashok', 'Varsha',
];
const LAST = [
  'Kumar', 'Raj', 'Krishnan', 'Subramanian', 'Iyer', 'Murugan', 'Nair', 'Pillai', 'Venkatesh', 'Ramasamy',
  'Srinivasan', 'Natarajan', 'Balasubramanian', 'Chandran', 'Ganesan', 'Sekar', 'Rajendran', 'Menon', 'Reddy', 'Shankar',
];

const pick = <T,>(arr: T[], seed: number): T => arr[Math.floor(seededRandom(seed) * arr.length) % arr.length];

/** Deterministic mock record for the occupant at (zone, index). */
export function employeeFor(zone: string, index: number): Employee {
  const base = zone.charCodeAt(0) * 1009 + index * 7919;
  // Zones lean toward a department so pods read as teams, with some mixing.
  const zoneBias: Record<string, Department> = { A: 'Software', B: 'Cyber Security', C: 'IoT', D: 'Digital Marketing' };
  const department: Department =
    seededRandom(base + 1) < 0.55 ? (zoneBias[zone] ?? 'Finance') : pick(DEPARTMENTS, base + 2);
  const designation = pick(DESIGNATIONS[department], base + 3);
  const name = `${pick(FIRST, base + 4)} ${pick(LAST, base + 5)}`;
  return {
    id: `FIN-${zone}-${String(index + 1).padStart(2, '0')}`,
    name,
    designation,
    department,
    zone,
    index,
    mock: true,
  };
}

/** Full directory for the current per-zone headcount (for lists / tables). */
export function directory(peoplePerZone: Record<string, number>): Employee[] {
  const out: Employee[] = [];
  for (const zone of Object.keys(peoplePerZone)) {
    for (let i = 0; i < peoplePerZone[zone]; i++) out.push(employeeFor(zone, i));
  }
  return out;
}

export const DEPARTMENT_COLORS: Record<Department, string> = {
  'Cyber Security': '#f85149',
  Software: '#58a6ff',
  IoT: '#3fb950',
  'Digital Marketing': '#e3b341',
  Finance: '#c792ea',
};
