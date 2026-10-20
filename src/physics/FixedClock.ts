import { MAX_FRAME_DT, PHYSICS_DT } from '../config.js';

/** Bound catch-up work after a stalled/hidden tab; never enlarge a physics step. */
export class FixedClock {
  private accumulator = 0;

  advance(deltaSeconds: number, step: () => void): void {
    if (!Number.isFinite(deltaSeconds)) return;
    this.accumulator += Math.min(Math.max(0, deltaSeconds), MAX_FRAME_DT);
    while (this.accumulator + 1e-12 >= PHYSICS_DT) {
      step();
      this.accumulator = Math.max(0, this.accumulator - PHYSICS_DT);
    }
  }

  reset(): void { this.accumulator = 0; }
}
