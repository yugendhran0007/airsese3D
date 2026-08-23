/**
 * Live mini-map: the 2×2 zone grid coloured by status, the rooms as outlines,
 * your avatar as a heading arrow — click anywhere to walk there. The avatar
 * dot is updated from a rAF loop reading `characterTransient` (no React
 * state per frame, per the engine/React split).
 */
import { useEffect, useRef } from 'react';
import { STATUS_COLORS } from '../../config/constants';
import { characterTransient } from '../../state/characterStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { useOfficeLayout } from '../../scene/office/Furniture';
import { CloseX } from './CloseX';

const SIZE = 150;

export function MiniMap() {
  const room = useSimStore((s) => s.params.room);
  const zones = useSimStore((s) => s.snapshot.zones);
  const chartsOpen = useUiStore((s) => s.chartsOpen);
  const layout = useOfficeLayout();
  const youRef = useRef<SVGGElement>(null);
  const sx = SIZE / room.width;
  const sz = SIZE / room.length;
  const toMap = (x: number, z: number) => [(x + room.width / 2) * sx, (z + room.length / 2) * sz] as const;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const g = youRef.current;
      if (g) {
        const [mx, my] = toMap(characterTransient.position.x, characterTransient.position.z);
        g.setAttribute('transform', `translate(${mx} ${my}) rotate(${180 - (characterTransient.heading * 180) / Math.PI})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.width, room.length]);

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * room.width - room.width / 2;
    const z = ((e.clientY - r.top) / r.height) * room.length - room.length / 2;
    characterTransient.target = { x, z };
    characterTransient.targetSetAt = performance.now() / 1000;
    const ui = useUiStore.getState();
    if (ui.cameraMode === 'orbit') ui.setCameraMode('follow');
  };

  return (
    <div
      className="glass pointer-events-auto absolute left-[19rem] z-20 rounded-xl p-2 transition-all"
      style={{ bottom: chartsOpen ? '16.5rem' : '3.5rem' }}
      title="Mini-map — click to walk there"
    >
      <CloseX onClick={() => useUiStore.getState().hideCard('minimap')} label="Close Map" className="absolute top-0.5 right-0.5 h-5 w-5 text-[12px]" />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} onClick={onClick} className="cursor-crosshair">
        {zones.map((z) => {
          const col = z.id === 'A' || z.id === 'C' ? 0 : 1;
          const row = z.id === 'A' || z.id === 'B' ? 0 : 1;
          return (
            <g key={z.id}>
              <rect x={col * SIZE / 2 + 1} y={row * SIZE / 2 + 1} width={SIZE / 2 - 2} height={SIZE / 2 - 2} rx={4} fill={STATUS_COLORS[z.status]} opacity={0.22} stroke={STATUS_COLORS[z.status]} strokeOpacity={0.6} />
              <text x={col * SIZE / 2 + 6} y={row * SIZE / 2 + 14} fontSize={9} fontWeight={800} fill="#e6eefc">{z.id}</text>
              <text x={col * SIZE / 2 + 6} y={row * SIZE / 2 + 25} fontSize={8} fill="#8ea3c4" fontFamily="JetBrains Mono, monospace">{Math.round(z.co2)} ppm</text>
            </g>
          );
        })}
        {layout.areas.map((a, i) => {
          const [x0, y0] = toMap(a.cx - a.w / 2, a.cz - a.d / 2);
          return <rect key={i} x={x0} y={y0} width={a.w * sx} height={a.d * sz} fill="none" stroke="#e6eefc" strokeOpacity={0.35} strokeDasharray="2 2" />;
        })}
        <g ref={youRef}>
          <circle r={7} fill="#38e1ff" opacity={0.25} />
          <path d="M0 -5 L4 4 L0 2 L-4 4 Z" fill="#38e1ff" />
        </g>
      </svg>
    </div>
  );
}
