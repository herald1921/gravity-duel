import { findAimSolution, type AimSolution } from './SpaceAI.js';
import type { Launcher } from '../entities/Bullet.js';
import type { CelestialBody } from '../entities/CelestialBody.js';
import type { SpecialShot } from '../entities/PowerUp.js';
import type { CollisionTarget, SpaceContext } from '../physics/gravity.js';
export interface AimRequest {
  self: Launcher & CollisionTarget; target: CollisionTarget; bodies: readonly CelestialBody[];
  context: SpaceContext; weapon: SpecialShot | 'normal';
}
export type AimPlanner = (request: AimRequest, done: (solution: AimSolution | null) => void) => void;
/** CPU-heavy search runs in a Worker; it imports exactly the same simulator as live play. */
export class TrajectoryPlanner {
  private worker: Worker | null = null; private sequence = 0;
  private pending = new Map<number, (solution: AimSolution | null) => void>();
  constructor() {
    try {
      this.worker = new Worker(new URL('./AimWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }: MessageEvent<{ id: number; solution: AimSolution | null }>) => {
        const done = this.pending.get(data.id); this.pending.delete(data.id); done?.(data.solution);
      };
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; this.cancel(); };
    } catch { this.worker = null; }
  }
  request: AimPlanner = (request, done) => {
    if (!this.worker) { done(findAimSolution(request.self, request.target, request.bodies, request.context, request.weapon)); return; }
    const id = ++this.sequence; this.pending.set(id, done); this.worker.postMessage({ id, ...request });
  };
  cancel(): void { const pending = [...this.pending.values()]; this.pending.clear(); pending.forEach(done => done(null)); }
  destroy(): void { this.worker?.terminate(); this.worker = null; this.cancel(); }
}
