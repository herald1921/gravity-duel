import { ARENA_BOUNDS, PHYSICS_DT } from '../config.js';
import { Ship, type ShipControl } from '../entities/Ship.js';
import { withEphemeris, bodyPosition, inPulsarBeam, type CelestialBody } from '../entities/CelestialBody.js';
import type { SpaceContext, Vec2 } from '../physics/gravity.js';
import { teleportShip } from '../entities/Wormhole.js';

/** A short receding-horizon flight planner. Gravity, collisions, jamming and
 * wormhole exits are evaluated with the same Ship integrator as live play. */
export class TerrainPilot {
  private until = 0; private direction: Vec2 = { x: 0, y: 0 };
  reset(): void { this.until = 0; }
  choose(dt: number, self: Ship, target: Vec2, bodies: readonly CelestialBody[], context: SpaceContext,
    desired: number, gravity: 'none' | 'all' | 'blackHoles', range: number): Vec2 {
    return withEphemeris(()=>this.chooseCached(dt,self,target,bodies,context,desired,gravity,range));
  }
  private chooseCached(dt: number, self: Ship, target: Vec2, bodies: readonly CelestialBody[], context: SpaceContext,
    desired: number, gravity: 'none' | 'all' | 'blackHoles', range: number): Vec2 {
    this.until -= dt;
    if (this.until > 0) return this.direction;
    this.until = 0.3;
    let best = Infinity;
    for (const delta of [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.3, -2.3, Math.PI]) {
      const angle = desired + delta, move = { x: Math.cos(angle), y: Math.sin(angle) };
      const probe = new Ship(self.id, self); Object.assign(probe, self);
      let cost = Math.abs(delta) * 16;
      for (let step = 0; step < 144; step++) {
        const time = (context.time ?? 0) + step * PHYSICS_DT;
        const control: ShipControl = { turn: 0, thrust: 0, fire: false, independentAim: true, aim: self.angle, move };
        if (probe.update(PHYSICS_DT, control, bodies, time, gravity)) { cost += 100000; break; }
        if (probe.portalCooldown <= 0) {
          const gate = context.wormholes?.find(w => Math.hypot(probe.x - w.x, probe.y - w.y) < w.radius + probe.radius);
          const exit = gate && context.wormholes?.find(w => w.id === gate.exitId);
          if (gate && exit) teleportShip(probe, gate, exit);
        }
        if (step % 12 === 0) for (const body of bodies) {
          const p = bodyPosition(body, time), clearance = Math.hypot(probe.x - p.x, probe.y - p.y) - body.collisionRadius - probe.radius;
          cost += Math.max(0, (body.lethal ? 75 : 35) - clearance) * (body.lethal ? 3 : 0.8);
          if (inPulsarBeam(probe, body, time)) cost += 24;
        }
      }
      cost += Math.abs(Math.hypot(probe.x - target.x, probe.y - target.y) - range) * 0.3;
      const wall = Math.min(probe.x - ARENA_BOUNDS.left, ARENA_BOUNDS.right - probe.x, probe.y - ARENA_BOUNDS.top, ARENA_BOUNDS.bottom - probe.y);
      cost += Math.max(0, 45 - wall) * 4;
      if (cost < best) { best = cost; this.direction = move; }
    }
    return this.direction;
  }
}
