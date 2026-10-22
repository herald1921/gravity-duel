import type { Ship, PlayerId } from '../entities/Ship.js';
import { bodyAt, type CelestialBody } from '../entities/CelestialBody.js';
import { segmentCircleContact } from '../physics/gravity.js';

/** FFA target selection treats humans and AI identically, with a short stable commitment. */
export class RivalSelector {
  private targetId: PlayerId | null = null;
  private reconsiderIn = 0;
  reset(): void { this.targetId = null; this.reconsiderIn = 0; }
  select(dt: number, self: Ship, ships: readonly Ship[], bodies: readonly CelestialBody[], time: number): Ship | undefined {
    const rivals = ships.filter(s => s.id !== self.id && s.alive);
    const current = rivals.find(s => s.id === this.targetId);
    this.reconsiderIn -= dt;
    if (current && this.reconsiderIn > 0) return current;
    const obstacles = bodies.map(b => bodyAt(b, time));
    const cost = (s: Ship) => Math.hypot(s.x - self.x, s.y - self.y) +
      obstacles.filter(b => segmentCircleContact(self, s, { ...b, radius: b.collisionRadius + 10 }) !== null).length * 200 -
      (s.id === this.targetId ? 90 : 0);
    const best = rivals.sort((a, b) => cost(a) - cost(b) || a.id - b.id)[0];
    this.targetId = best?.id ?? null; this.reconsiderIn = 0.8;
    return best;
  }
}
