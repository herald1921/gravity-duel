import type { Ship, PlayerId } from '../entities/Ship.js';
import type { Bullet } from '../entities/Bullet.js';

/** Shared observations, not alliances: spread attention without privileging human IDs. */
export class RivalPressure {
  private assignments = new Map<PlayerId, PlayerId>();
  private unattended = new Map<PlayerId, number>();
  reset(): void { this.assignments.clear(); this.unattended.clear(); }
  update(dt: number, ships: readonly Ship[], bullets: readonly Bullet[]): void {
    const alive = new Set(ships.filter(s => s.alive).map(s => s.id));
    for (const [attacker, target] of this.assignments)
      if (!alive.has(attacker) || !alive.has(target)) this.assignments.delete(attacker);
    for (const ship of ships) {
      const threatened = [...this.assignments.values()].includes(ship.id) || bullets.some(b =>
        b.ownerId !== ship.id && Math.hypot(b.x - ship.x, b.y - ship.y) < 180);
      this.unattended.set(ship.id, !ship.alive || threatened ? 0 : Math.min(10, (this.unattended.get(ship.id) ?? 0) + dt));
    }
  }
  neglect(id: PlayerId): number { return this.unattended.get(id) ?? 0; }
  attackers(id: PlayerId, except: PlayerId): number {
    return [...this.assignments].filter(([attacker, target]) => attacker !== except && target === id).length;
  }
  assign(attacker: PlayerId, target?: PlayerId): void {
    if (target === undefined) this.assignments.delete(attacker); else this.assignments.set(attacker, target);
  }
}
