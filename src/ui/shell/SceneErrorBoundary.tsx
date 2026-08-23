/**
 * Catches WebGL / asset failures from the 3D canvas and shows a clear message
 * (no GPU acceleration, context lost, unsupported browser) instead of a blank
 * page. The DOM dashboard keeps working underneath.
 */
import { Component, type ReactNode } from 'react';
import { detectGpuRenderer } from '../../utils/hardware';

interface State { error: Error | null }

export class SceneErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[AirSense] 3D scene failed', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const gpu = detectGpuRenderer() || 'no WebGL context';
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-base">
        <div className="glass max-w-md rounded-2xl p-6 text-center">
          <div className="text-lg font-extrabold text-ink">3D view could not start</div>
          <p className="mt-2 text-sm text-ink-dim">
            {this.state.error.message}
          </p>
          <p className="mt-3 text-xs text-ink-faint">
            Detected GPU: <span className="num text-ink-dim">{gpu}</span>. Make sure hardware acceleration is enabled
            (chrome://gpu) and the browser is using the dedicated GPU, then reload.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-accent/15 px-4 py-1.5 text-[11px] font-bold tracking-wider text-accent uppercase hover:bg-accent/25"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
