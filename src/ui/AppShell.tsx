import { lazy, Suspense } from 'react';
import { useUiStore } from '../state/uiStore';
import { AlertsPanel } from './alerts/AlertsPanel';
import { ComparisonTable } from './dashboard/ComparisonTable';
import { LiveDashboard } from './dashboard/LiveDashboard';
import { OutdoorCard } from './dashboard/OutdoorCard';
import { ZonePanel } from './dashboard/ZonePanel';
import { ControlDrawer } from './controls/ControlDrawer';
import { ScenarioBar } from './controls/ScenarioBar';
import { ThresholdsPanel } from './controls/ThresholdsPanel';
import { CharacterHUD } from './hud/CharacterHUD';
import { PersonInspector } from './hud/PersonInspector';
import { HumanInsightPanel } from './human/HumanInsightPanel';
import { PresentationOverlay } from './presentation/PresentationOverlay';
import { TopBar } from './TopBar';
import { LoadingScreen } from './shell/LoadingScreen';
import { MiniMap } from './shell/MiniMap';
import { Onboarding } from './shell/Onboarding';
import { Shortcuts } from './shell/Shortcuts';
import { ActionBar } from './shell/ActionBar';
import { Closable, RestorePill } from './shell/CloseX';

// Heavy, rarely-open panels load on demand (Recharts is ~400 kB)
const ChartsDrawer = lazy(() => import('./charts/ChartsDrawer').then((m) => ({ default: m.ChartsDrawer })));
const DataVizOverlay = lazy(() => import('./dataviz/DataVizOverlay').then((m) => ({ default: m.DataVizOverlay })));

/**
 * DOM overlay on top of the 3D canvas. The container ignores pointer events;
 * each panel re-enables them so orbit controls work in the gaps.
 */
export function AppShell() {
  const presenting = useUiStore((s) => s.activeScenario === 'presentation');

  return (
    <div className="pointer-events-none absolute inset-0 font-sans">
      {!presenting && (
        <>
          <TopBar />
          <Closable id="controls" bare><ControlDrawer /></Closable>
          {/* Right dashboard column */}
          <div className="scroll-thin pointer-events-auto absolute top-20 right-4 bottom-4 flex w-80 flex-col gap-3 overflow-y-auto pr-0.5">
            <Closable id="live"><LiveDashboard /></Closable>
            <Closable id="outdoor"><OutdoorCard /></Closable>
            <Closable id="comparison"><ComparisonTable /></Closable>
            <Closable id="zones"><ZonePanel /></Closable>
          </div>
          <Closable id="alerts" bare><AlertsPanel /></Closable>
          <Closable id="hud" bare><CharacterHUD /></Closable>
          <PersonInspector />
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
          <ActionBar />
          <RestorePill />
          <Shortcuts />
          <Onboarding />
        </>
      )}
      <PresentationOverlay />
      <LoadingScreen />
    </div>
  );
}
