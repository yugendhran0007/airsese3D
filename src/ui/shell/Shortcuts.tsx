/**
 * Global keyboard shortcuts + "?" help sheet. Movement keys (WASD, arrows,
 * Q/Shift zoom) belong to the character controller, so panel shortcuts avoid them.
 */
import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';

const BINDINGS: [string, string][] = [
  ['W A S D / ↑ ← ↓ →', 'Walk — camera-relative, and you turn to face where you go'],
  ['Click floor', 'Walk to a point'],
  ['Click a glowing chair', 'Walk over and sit down at the laptop'],
  ['F', 'Sit at the nearest free desk / stand up'],
  ['G', 'Dance'],
  ['Space / J', 'Jump'],
  ['Ctrl + ← / →', 'Turn your whole body on the spot (the view turns with it)'],
  ['Q / Shift', 'Zoom chase camera in / out'],
  ['Mouse drag', 'Orbit around you — front, back, side'],
  ['Esc', 'Back to orbit camera / close panels'],
  ['P', 'Pause / resume simulation'],
  ['N', 'Toggle employee names (Employee mode)'],
  ['V', 'Data Viz — people view'],
  ['C', 'History charts'],
  ['H', 'Human insight panel'],
  ['T', 'Realistic / Stylized render'],
  ['I / O', 'Increase / Decrease ramp'],
  ['1 – 5', 'Simulation speed 0.5× … 10×'],
  ['?', 'This help'],
];

const SPEEDS = [0.5, 1, 2, 5, 10];

export function Shortcuts() {
  const [open, setOpen] = useState(false);
  const fullMode = useUiStore((s) => s.fullMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const ui = useUiStore.getState();
      const sim = useSimStore.getState();
      switch (e.key) {
        case '?': setOpen((o) => !o); break;
        case 'Escape':
          // Esc unwinds one layer at a time, outermost first. Full mode is
          // listed here as well as handled by the browser's own fullscreen Esc,
          // because `requestFullscreen` can be refused — in which case full
          // mode is on, the browser has nothing to exit, and this is the only
          // way out.
          if (open) setOpen(false);
          else if (ui.dataVizOpen) ui.toggle('dataVizOpen');
          else if (ui.fullMode) {
            ui.setFullMode(false);
            if (document.fullscreenElement) void document.exitFullscreen?.();
          }
          break;
        // Pause moved off Space when Space became jump: the character
        // controller has first claim on the keys you press while walking around.
        case 'p': case 'P': sim.setRunning(!sim.running); break;
        case 'n': case 'N': ui.setEmployeeMode(!ui.employeeMode); break;
        case 'v': case 'V': ui.toggle('dataVizOpen'); break;
        case 'c': case 'C': ui.toggle('chartsOpen'); break;
        case 'h': case 'H': ui.toggle('humanPanelOpen'); break;
        case 't': case 'T': ui.setRenderMode(ui.renderMode === 'realistic' ? 'stylized' : 'realistic'); break;
        case 'i': case 'I': ui.setRampMode(ui.rampMode === 'increase' ? null : 'increase'); break;
        case 'o': case 'O': ui.setRampMode(ui.rampMode === 'decrease' ? null : 'decrease'); break;
        case '1': case '2': case '3': case '4': case '5': sim.setSpeed(SPEEDS[Number(e.key) - 1]); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* The key bindings above stay live in full mode — they are most of how you
          drive the office once the panels are gone — but the floating help button
          is a panel like any other, so it goes with them. `?` still opens the sheet. */}
      {!fullMode && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass pointer-events-auto absolute right-4 bottom-4 z-30 flex h-8 w-8 items-center justify-center rounded-full text-ink-dim hover:text-accent"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={14} />
        </button>
      )}
      {open && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-base/60" onClick={() => setOpen(false)}>
          <div className="glass fade-up w-[28rem] rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold tracking-[0.2em] text-ink uppercase">Shortcuts</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-1 text-ink-dim hover:bg-danger/15 hover:text-danger" aria-label="Close"><span className="text-[15px] leading-none" aria-hidden>🗙</span></button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {BINDINGS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="num rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-ink">{k}</dt>
                  <dd className="py-0.5 text-ink-dim">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
