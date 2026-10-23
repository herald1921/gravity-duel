import type { Ship, PlayerId, ShipControl } from '../entities/Ship.js';
import type { OpeningFireGate } from '../game/OpeningFireGate.js';
import { bodyAt, inPulsarBeam, type CelestialBody } from '../entities/CelestialBody.js';
import type { Pickup } from '../entities/PowerUp.js';
import { segmentCircleContact, type Vec2 } from '../physics/gravity.js';
import { difficultyFor } from './Difficulty.js';
import { wantsPickup } from './PickupTactics.js';

export type SquadRole = 'PRESSURE' | 'FLANK' | 'INTERCEPT';
export interface SquadOrder {
  role: SquadRole; waypoint: Vec2; advance: boolean; side: number; pickupId?: number;
}
/** Shared, deliberately delayed observations and role assignments for one enemy squad. */
export class SquadCoordinator {
  readonly orders = new Map<PlayerId, SquadOrder>();
  private observeIn = 0; private rolesIn = 0; private members = '';
  private pressureId: PlayerId | null = null; private lastShooter: PlayerId | null = null;
  private coveredUntil = 0; private nextShotAt = 0;
  private contact = { x: 640, y: 375, vx: 0, vy: 0 };
  constructor(private readonly level: number) {}
  reset(): void {
    this.orders.clear(); this.observeIn = 0; this.rolesIn = 0; this.members = '';
    this.pressureId = null; this.lastShooter = null; this.coveredUntil = 0; this.nextShotAt = 0;
  }
  update(dt: number, ships: readonly Ship[], target: Ship, bodies: readonly CelestialBody[], time: number, pickups: readonly Pickup[]): void {
    const living = ships.filter(s => s.alive).sort((a, b) => a.id - b.id), members = living.map(s => s.id).join(',');
    if (living.length < 2 || !target.alive) { this.orders.clear(); this.members = members; return; }
    this.observeIn -= dt; this.rolesIn -= dt;
    const changed = members !== this.members;
    if (this.observeIn > 0 && !changed) return;
    this.members = members; this.observeIn = Math.max(0.45, difficultyFor(this.level).reaction);
    this.contact = { x: target.x, y: target.y, vx: target.vx, vy: target.vy };
    if (this.rolesIn <= 0 || changed || !living.some(s => s.id === this.pressureId)) {
      // The closest armed/shielded pilot holds attention while partners take other angles.
      this.pressureId = [...living].sort((a, b) =>
        (Math.hypot(a.x - target.x, a.y - target.y) - (a.shield ? 100 : 0)) -
        (Math.hypot(b.x - target.x, b.y - target.y) - (b.shield ? 100 : 0)) || a.id - b.id)[0].id;
      this.rolesIn = 7;
    }
    const pressure = living.find(s => s.id === this.pressureId)!;
    const angle = Math.atan2(pressure.y - this.contact.y, pressure.x - this.contact.x);
    const current = bodies.map(b => bodyAt(b, time + 0.6));
    this.orders.clear();
    const claimed: Vec2[] = [];
    const roles: SquadRole[] = ['PRESSURE', 'FLANK', 'INTERCEPT'];
    const ordered = [pressure, ...living.filter(s => s !== pressure)];
    ordered.forEach((ship, i) => {
      const role = roles[i];
      const speed = Math.hypot(this.contact.vx, this.contact.vy);
      const heading = role === 'PRESSURE' ? angle : role === 'INTERCEPT' && speed > 35 ?
        Math.atan2(this.contact.vy, this.contact.vx) : angle + (i === 1 ? 1.25 : -1.25);
      const radius = role === 'PRESSURE' ? 340 : role === 'FLANK' ? 300 : 350;
      const waypoint = this.position(heading, radius, current, claimed, time + 0.6, role === 'PRESSURE');
      claimed.push(waypoint);
      this.orders.set(ship.id, { role, waypoint, side: i === 2 ? -1 : 1,
        advance: role !== 'PRESSURE' && time < this.coveredUntil });
    });
    // Reserve resources centrally: partners never chase the same pickup.
    const reserved = new Set<PlayerId>();
    for (const pickup of pickups) {
      const candidates = living.filter(s => !reserved.has(s.id) && s.id !== this.pressureId &&
        wantsPickup(s, pickup.type) &&
        Math.hypot(s.x - pickup.x, s.y - pickup.y) < 390 && !current.some(b =>
          segmentCircleContact(s, pickup, { ...b, radius: b.collisionRadius + s.radius + 20 }) !== null || inPulsarBeam(pickup, b, time + 0.6)))
        .sort((a, b) => Math.hypot(a.x - pickup.x, a.y - pickup.y) - Math.hypot(b.x - pickup.x, b.y - pickup.y));
      if (candidates[0]) { reserved.add(candidates[0].id); this.orders.get(candidates[0].id)!.pickupId = pickup.id; }
    }
  }
  private position(angle: number, radius: number, bodies: readonly CelestialBody[], claimed: readonly Vec2[], time: number, needsFireLane = false): Vec2 {
    let best = { x: 640, y: 600 }, cost = Infinity;
    for (const delta of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, Math.PI]) for (const scale of [1, 0.8, 1.2]) {
      const raw = { x: this.contact.x + Math.cos(angle + delta) * radius * scale, y: this.contact.y + Math.sin(angle + delta) * radius * scale };
      const p = { x: Math.max(95, Math.min(1185, raw.x)), y: Math.max(165, Math.min(605, raw.y)) };
      let score = Math.abs(delta) * 75 + Math.abs(scale - 1) * 100 + Math.hypot(p.x - raw.x, p.y - raw.y) * 2;
      for (const body of bodies) {
        const d = Math.hypot(p.x - body.x, p.y - body.y), margin = body.collisionRadius + (body.lethal ? 100 : 65);
        if (d < margin) score += 3000 + (margin - d) * 20;
        if (inPulsarBeam({ ...p, radius: 20 }, body, time)) score += 200;
        // Suppression needs a usable firing lane, not just a safe parking spot behind a planet.
        if (needsFireLane && segmentCircleContact(p, this.contact, { ...body, radius: body.collisionRadius + 12 }) !== null) score += 950;
      }
      for (const other of claimed) if (Math.hypot(p.x - other.x, p.y - other.y) < 150) score += 1800;
      if (score < cost) { best = p; cost = score; }
    }
    return best;
  }
  selectShooter(candidates: readonly PlayerId[], time: number): PlayerId | null {
    if (time < this.nextShotAt || !candidates.length) return null;
    const sorted = [...candidates].sort((a, b) => a - b);
    return sorted.find(id => id > (this.lastShooter ?? 0)) ?? sorted[0];
  }
  coordinateFire(dt: number, ships: readonly Ship[], controls: ShipControl[], gates: readonly OpeningFireGate[], ready: readonly boolean[], time: number): void {
    const prepared = ships.filter((ship, i) => gates[i].prepare(dt, controls[i].fire, ship.alive && ready[i])).map(ship => ship.id);
    const shooter = this.selectShooter(prepared, time);
    controls.forEach((control, i) => {
      control.fire = ships[i].id === shooter;
      if (control.fire) gates[i].consume();
    });
  }
  recordShot(id: PlayerId, time: number): void {
    this.reserveShot(id, time);
    if (this.orders.get(id)?.role === 'PRESSURE') {
      this.coveredUntil = time + 2;
      for (const order of this.orders.values()) if (order.role !== 'PRESSURE') order.advance = true;
    }
  }
  reserveShot(id: PlayerId, time: number): void { this.lastShooter = id; this.nextShotAt = time + 0.4; }
}
