import type { Ship, ShipControl } from '../entities/Ship.js';
import type { GameMap } from '../maps/maps.js';
import { TerrainPilot } from '../ai/TerrainPilot.js';

export class BossEncounter {
  phase: 'warning' | 'attack' | 'recover' = 'warning'; remaining = 1.4; cycle = 0; angle = 0;
  private terrain = new TerrainPilot();
  constructor(readonly unit: 0 | 1 | 2) {}
  get rays(): number { return this.unit === 0 ? 4 : this.unit === 1 ? 6 : 8; }
  get laser(): boolean { return this.unit > 0 && this.cycle % 3 === 2; }
  reset(): void { this.phase = 'warning'; this.remaining = 1.4; this.cycle = 0; this.terrain.reset(); }
  step(dt: number, self: Ship, target: Ship, map: GameMap, time: number): { control: ShipControl; volley: boolean } {
    let volley = false;
    this.remaining -= dt;
    if (this.phase === 'warning' && this.remaining > 0.5) this.angle = Math.atan2(target.y - self.y, target.x - self.x);
    if (this.remaining <= 0) {
      if (this.phase === 'warning') { this.phase = 'attack'; this.remaining = 0.45; volley = true; }
      else if (this.phase === 'attack') { this.phase = 'recover'; this.remaining = 3.5 - this.unit * 0.3; }
      else { this.phase = 'warning'; this.remaining = 1.4 - this.unit * 0.1; this.cycle++; }
    }
    const desired = Math.atan2(target.y - self.y, target.x - self.x) + Math.PI / 2;
    const move = this.terrain.choose(dt, self, target, map.bodies, { time, wormholes: map.wormholes }, desired, map.shipGravity ?? 'none', 420);
    return { volley, control: { turn: 0, thrust: 0, fire: false, independentAim: true, aim: this.angle,
      move } };
  }
}
