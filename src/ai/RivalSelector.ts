import type { Ship, PlayerId } from '../entities/Ship.js';
import { bodyAt, type CelestialBody } from '../entities/CelestialBody.js';
import { segmentCircleContact } from '../physics/gravity.js';
import type { RivalPressure } from './RivalPressure.js';

/** FFA target selection treats humans and AI identically, with a short stable commitment. */
export class RivalSelector {
  private targetId: PlayerId | null = null;
  private reconsiderIn = 0;
  private focusTime = 0;
  reset(): void { this.targetId = null; this.reconsiderIn = 0; this.focusTime = 0; }
  select(dt: number, self: Ship, ships: readonly Ship[], bodies: readonly CelestialBody[], time: number, pressure?: RivalPressure): Ship | undefined {
    if (!self.alive) { pressure?.assign(self.id); return undefined; }
    const rivals = ships.filter(s => s.id !== self.id && s.alive && s.invulnerableFor <= 0);
    const current = rivals.find(s => s.id === this.targetId);
    this.focusTime += dt;
    this.reconsiderIn -= dt;
    if (current && this.reconsiderIn > 0) return current;
    const obstacles = bodies.map(b => bodyAt(b, time));
    const cost = (s: Ship) => Math.hypot(s.x - self.x, s.y - self.y) +
      obstacles.filter(b => segmentCircleContact(self, s, { ...b, radius: b.collisionRadius + 10 }) !== null).length * 200 -
      (s.id === this.targetId ? 90 : 0) + (pressure ?
        pressure.attackers(s.id, self.id) * 260 - Math.min(1200, pressure.neglect(s.id) * 170) +
        (s.id === this.targetId && rivals.length > 1 ? Math.min(800, Math.max(0, this.focusTime - 6) * 120) : 0) : 0);
    // Avoid a third AI piling onto a pilot when another living opponent is available.
    const uncrowded = pressure ? rivals.filter(s => pressure.attackers(s.id, self.id) < 2) : rivals;
    const best = (uncrowded.length ? uncrowded : rivals).sort((a, b) => cost(a) - cost(b) || a.id - b.id)[0];
    if (best?.id !== this.targetId) this.focusTime = 0;
    this.targetId = best?.id ?? null; this.reconsiderIn = pressure ? 2 : 0.8;
    pressure?.assign(self.id, best?.id);
    return best;
  }
}
