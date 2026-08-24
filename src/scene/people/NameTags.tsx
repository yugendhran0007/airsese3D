/**
 * Floating name tags above every seated/standing occupant: employee name,
 * hidden by default (anonymous office) and revealed by Employee mode
 * (uiStore.employeeMode) or by clicking a person (selected tag only).
 * Each tag carries a safety dot (green safe / yellow medium / red danger).
 * badge id and department from the mock directory (config/employees.ts).
 * One cached canvas sprite per employee; slot order mirrors RealisticCrowd /
 * Crowd (seats then standing spots) so tags match the rendered person and
 * the click-to-inspect identity. Per-frame bob is done in useFrame.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { STATUS_COLORS } from '../../config/constants';
import { DEPARTMENT_COLORS, employeeFor, type Employee } from '../../config/employees';
import { engine } from '../../simulation/engine';
import { personStatus } from '../../simulation/effects';
import type { Status } from '../../types/environment';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { ZONE_IDS } from '../../simulation/zones';
import type { OfficeLayout } from '../office/officeLayout';

const TAG_W = 512;
const TAG_H = 144;
const WORLD_W = 1.15; // m
const WORLD_H = WORLD_W * (TAG_H / TAG_W);

const cache = new Map<string, THREE.CanvasTexture>();

function tagTexture(e: Employee, status: Status): THREE.CanvasTexture {
  const key = `${e.id}:${status}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = TAG_W;
  c.height = TAG_H;
  const g = c.getContext('2d')!;
  const color = DEPARTMENT_COLORS[e.department];
  // Pill background
  g.fillStyle = 'rgba(10,16,28,0.82)';
  g.beginPath();
  g.roundRect(6, 6, TAG_W - 12, TAG_H - 30, 22);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.stroke();
  // Pointer nub
  g.fillStyle = 'rgba(10,16,28,0.82)';
  g.beginPath();
  g.moveTo(TAG_W / 2 - 14, TAG_H - 26);
  g.lineTo(TAG_W / 2 + 14, TAG_H - 26);
  g.lineTo(TAG_W / 2, TAG_H - 6);
  g.fill();
  // Department dot + name
  g.fillStyle = color;
  g.beginPath();
  g.arc(40, 48, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '700 40px Inter, system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(e.name, 62, 48);
  g.fillStyle = '#aab8cc';
  g.font = '500 26px "JetBrains Mono", Consolas, monospace';
  g.fillText(`${e.id}  ·  ${e.department}`, 62, 92);
  // Safety dot (right end): green safe · yellow medium · red danger
  g.fillStyle = STATUS_COLORS[status];
  g.shadowColor = STATUS_COLORS[status];
  g.shadowBlur = 14;
  g.beginPath();
  g.arc(TAG_W - 44, 48, 13, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

type TagTick = (t: number, camera: THREE.Camera) => void;

function Tag({ e, x, y, z, phase, seed, register }: { e: Employee; x: number; y: number; z: number; phase: number; seed: number; register: (tick: TagTick) => () => void }) {
  const ref = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const shown = useRef<Status>('green');
  const tex = useMemo(() => tagTexture(e, 'green'), [e]);
  const tick = useCallback<TagTick>((clockTime, camera) => {
    const clock = { elapsedTime: clockTime };
    const s = ref.current;
    if (!s) return;
    const ui = useUiStore.getState();
    const sel = ui.selectedPerson;
    const selected = !!sel && sel.zone === e.zone && sel.index === e.index;
    if (!ui.employeeMode && !selected) {
      s.visible = false;
      return;
    }
    // Swap the cached texture only when the person's safety level changes
    const zoneStatus: Status = engine.snapshot.zones.find((zz) => zz.id === e.zone)?.status ?? 'green';
    const st = personStatus(seed, zoneStatus);
    if (st !== shown.current && matRef.current) {
      shown.current = st;
      matRef.current.map = tagTexture(e, st);
      matRef.current.needsUpdate = true;
    }
    s.position.y = y + Math.sin(clock.elapsedTime * 1.6 + phase) * 0.02 + (selected ? 0.08 : 0);
    const k = selected ? 1.35 : 1;
    s.scale.set(WORLD_W * k, WORLD_H * k, 1);
    // Fade when far so a full office doesn't become a wall of labels (selected tag always shows)
    const d = camera.position.distanceTo(s.position);
    const mat = s.material as THREE.SpriteMaterial;
    mat.opacity = selected ? 1 : THREE.MathUtils.clamp((34 - d) / 12, 0, 1);
    s.visible = mat.opacity > 0.02;
  }, [e, y, seed, phase]);

  useEffect(() => register(tick), [register, tick]);
  // Clicking the tag selects the employee (same as clicking the avatar)
  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    useUiStore.getState().setSelectedPerson({ index: e.index, zone: e.zone });
  };
  return (
    <sprite ref={ref} position={[x, y, z]} scale={[WORLD_W, WORLD_H, 1]} renderOrder={50} onClick={onClick}>
      {/* Overlay label: no depth test so glass partitions (which write depth) never cull it */}
      <spriteMaterial ref={matRef} map={tex} transparent depthWrite={false} depthTest={false} />
    </sprite>
  );
}

export function NameTags({ layout }: { layout: OfficeLayout }) {
  const peoplePerZone = useSimStore((s) => s.params.peoplePerZone);
  // Anonymous office is the default: with nothing to show, the sprites are not
  // mounted at all (no draw calls, no scene-graph traversal, no ticks).
  const employeeMode = useUiStore((s) => s.employeeMode);
  const hasSelection = useUiStore((s) => s.selectedPerson !== null);
  const visible = employeeMode || hasSelection;

  const tags = useMemo(() => {
    const out: { e: Employee; x: number; y: number; z: number; phase: number; seed: number }[] = [];
    for (const zone of ZONE_IDS) {
      const slots = [
        ...layout.seats[zone].map((s) => ({ x: s.x, z: s.z, angle: s.angle, seated: true })),
        ...layout.stands[zone].map((s) => ({ x: s.x, z: s.z, angle: s.angle, seated: false })),
      ];
      const count = Math.min(peoplePerZone[zone], slots.length);
      for (let i = 0; i < count; i++) {
        const s = slots[i];
        const back = s.seated ? 0.28 : 0;
        out.push({
          e: employeeFor(zone, i),
          x: s.x - Math.sin(s.angle) * back,
          y: s.seated ? 1.62 : 2.1,
          z: s.z - Math.cos(s.angle) * back,
          phase: i * 0.7 + zone.charCodeAt(0),
          // Same seed formula as RealisticCrowd / Crowd so the dot matches the ring
          seed: i * 17 + zone.charCodeAt(0) * 101,
        });
      }
    }
    return out;
  }, [layout, peoplePerZone]);

  // Keep the cache bounded if the room is resized many times
  useEffect(() => () => {
    if (cache.size > 1200) {
      cache.forEach((t) => t.dispose());
      cache.clear();
    }
  }, []);

  // One loop for every tag instead of one R3F subscriber per person
  const ticks = useRef<TagTick[]>([]);
  const register = useCallback((tick: TagTick) => {
    ticks.current.push(tick);
    return () => {
      const i = ticks.current.indexOf(tick);
      if (i >= 0) ticks.current.splice(i, 1);
    };
  }, []);
  useFrame(({ clock, camera }) => {
    const list = ticks.current;
    for (let i = 0; i < list.length; i++) list[i](clock.elapsedTime, camera);
  });

  if (!visible) return null;
  return (
    <group>
      {tags.map((t) => (
        <Tag key={t.e.id} {...t} register={register} />
      ))}
    </group>
  );
}
