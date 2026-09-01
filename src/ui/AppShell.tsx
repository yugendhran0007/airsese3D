import { lazy, Suspense, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useUiStore } from '../state/uiStore';
import { ComparisonTable } from './dashboard/ComparisonTable';
import { LiveDashboard } from './dashboard/LiveDashboard';
import { HvacCard } from './dashboard/HvacCard';
import { OutdoorCard } from './dashboard/OutdoorCard';
import { ZonePanel } from './dashboard/ZonePanel';
import { ScenarioBar } from './controls/ScenarioBar';
import { ThresholdsPanel } from './controls/ThresholdsPanel';
import { CharacterHUD } from './hud/CharacterHUD';
import { PersonInspector } from './hud/PersonInspector';
import { ZoneQuickCard } from './hud/ZoneQuickCard';
import { HumanInsightPanel } from './human/HumanInsightPanel';
import { PresentationOverlay } from './presentation/PresentationOverlay';
import { TopBar } from './TopBar';
import { MiniMap } from './shell/MiniMap';
import { Onboarding } from './shell/Onboarding';
import { Shortcuts } from './shell/Shortcuts';
import { Closable, RestorePill } from './shell/CloseX';

// Heavy, rarely-open panels load on demand (Recharts is ~400 kB)
const ChartsDrawer = lazy(() => import('./charts/ChartsDrawer').then((m) => ({ default: m.ChartsDrawer })));
const DataVizOverlay = lazy(() => import('./dataviz/DataVizOverlay').then((m) => ({ default: m.DataVizOverlay })));

/**
 * The one piece of interface full mode keeps: a line telling you how to get
 * out. It fades after a few seconds, because an instruction that stays on
 * screen for a whole presentation has stopped being help and started being
 * furniture.
 */
function FullModeHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    setShow(true);
    const id = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div
      className={clsx(
        'absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-4 py-1.5 text-[11px] tracking-wide text-white/70 backdrop-blur-sm transition-opacity duration-1000',
        show ? 'opacity-100' : 'opacity-0',
      )}
    >
      WASD or click the floor to walk · pointer to the top edge for controls · Esc to exit
    </div>
  );
}

/**
 * DOM overlay on top of the 3D canvas. The container ignores pointer events;
 * each panel re-enables them so orbit controls work in the gaps.
 *
 * Full mode drops every panel and leaves the office. It is a separate axis from
 * the presentation scenario above it: presentation is a scripted camera tour
 * with its own overlay, full mode is the user walking the office themselves
 * with nothing in the way.
 */
export function AppShell() {
  const presenting = useUiStore((s) => s.activeScenario === 'presentation');
  const fullMode = useUiStore((s) => s.fullMode);

  return (
    <div className="pointer-events-none absolute inset-0 font-sans">
      {!presenting && (
        <>
          <TopBar />
          {/* Shortcuts stays mounted in full mode — the keyboard is most of how
              you drive the office once the panels are gone. */}
          <Shortcuts />
          {fullMode ? (
            <FullModeHint />
          ) : (
            <>
              {/* Right dashboard column */}
              <div className="scroll-thin pointer-events-auto absolute top-20 right-4 bottom-4 flex w-80 flex-col gap-3 overflow-y-auto pr-0.5">
                <Closable id="live"><LiveDashboard /></Closable>
                <Closable id="outdoor"><OutdoorCard /></Closable>
                <Closable id="hvac"><HvacCard /></Closable>
                <Closable id="comparison"><ComparisonTable /></Closable>
                <Closable id="zones"><ZonePanel /></Closable>
              </div>
              <Closable id="hud" bare><CharacterHUD /></Closable>
              <PersonInspector />
              <ZoneQuickCard />
              <Closable id="scenarios" bare><ScenarioBar /></Closable>
              <Suspense fallback={null}>
                <ChartsDrawer />
              </Suspense>
              <HumanInsightPanel />
              <ThresholdsPanel />
              <Suspense fallback={null}>
                <DataVizOverlay />
              </Suspense>
              <Closable id="minimap" bare><MiniMap /></Closable>
              <RestorePill />
              <Onboarding />
            </>
          )}
        </>
      )}
      <PresentationOverlay />
    </div>
  );
}
