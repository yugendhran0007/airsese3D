import { HISTORY_CAPACITY } from '../config/constants';
import type { HistorySample } from '../types/environment';

/** Fixed-capacity ring buffer of history samples with chart-friendly reads. */
export class HistoryBuffer {
  private buf: HistorySample[] = [];
  private start = 0;
  version = 0;

  push(sample: HistorySample) {
    if (this.buf.length < HISTORY_CAPACITY) {
      this.buf.push(sample);
    } else {
      this.buf[this.start] = sample;
      this.start = (this.start + 1) % HISTORY_CAPACITY;
    }
    this.version++;
  }

  clear() {
    this.buf = [];
    this.start = 0;
    this.version++;
  }

  /** Chronological copy, downsampled to at most maxPoints. */
  read(maxPoints = 300): HistorySample[] {
    const n = this.buf.length;
    if (n === 0) return [];
    const ordered: HistorySample[] = new Array(n);
    for (let i = 0; i < n; i++) ordered[i] = this.buf[(this.start + i) % n];
    if (n <= maxPoints) return ordered;
    const stride = Math.ceil(n / maxPoints);
    const out: HistorySample[] = [];
    for (let i = 0; i < n; i += stride) out.push(ordered[i]);
    if (out[out.length - 1] !== ordered[n - 1]) out.push(ordered[n - 1]);
    return out;
  }
}
