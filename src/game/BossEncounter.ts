import { BULLET_SPEED, LASER_CHARGE_TIME } from '../config.js';
import { findAimSolution } from '../ai/SpaceAI.js';
import type { Ship, ShipControl } from '../entities/Ship.js';
import type { GameMap } from '../maps/maps.js';
import { TerrainPilot } from '../ai/TerrainPilot.js';

export class BossEncounter {
  phase: 'warning' | 'attack' | 'recover' = 'warning'; remaining = 1.4; cycle = 0; angle = 0;
  private hitThisOpening = false;
  private aimIn = 0;
  get vulnerable(): boolean { return this.phase === 'recover' && !this.hitThisOpening; }
  registerHit(): void { this.hitThisOpening = true; }
  get pattern(): string { return this.laser ? 'LANCE' : this.unit === 2 ? 'BROKEN RING' : this.cycle % 2 ? 'FAN' : 'CROSS'; }
  get shotAngles(): number[] {
    if (this.laser) return [this.angle];
    if (this.unit === 2) return Array.from({length:7},(_,i)=>this.angle+(i+1)*Math.PI/4);
    return this.cycle % 2 ? [-0.42,0,0.42].map(a=>this.angle+a) : Array.from({length:this.rays},(_,i)=>this.angle+i*Math.PI*2/this.rays);
  }
  private terrain = new TerrainPilot();
  constructor(readonly unit: 0 | 1 | 2) {}
  get rays(): number { return this.unit === 0 ? 4 : this.unit === 1 ? 6 : 8; }
  get laser(): boolean { return this.unit > 0 && this.cycle % 3 === 2; }
  reset(): void { this.phase = 'warning'; this.aimIn=0; this.hitThisOpening = false; this.remaining = 1.4; this.cycle = 0; this.angle = 0; this.terrain.reset(); }
  step(dt: number, self: Ship, target: Ship, map: GameMap, time: number): { control: ShipControl; volley: boolean } {
    let volley = false;
    this.remaining -= dt;
    this.aimIn-=dt;
    if(this.phase==='warning'&&this.remaining>0.8&&this.aimIn<=0){
      this.aimIn=.2;
      const travel=this.laser?LASER_CHARGE_TIME:Math.hypot(target.x-self.x,target.y-self.y)/BULLET_SPEED;
      const lead=Math.min(2.8,this.remaining+travel*(.8+this.unit*.1));
      const predicted={id:target.id,radius:target.radius,x:Math.max(45,Math.min(1235,target.x+target.vx*lead)),y:Math.max(125,Math.min(650,target.y+target.vy*lead))};
      const solution=findAimSolution({...self,vx:0,vy:0,muzzleOffset:self.radius+10},predicted,map.bodies,
        {time:time+this.remaining,wormholes:map.wormholes},this.laser?'laser':'normal');
      this.angle=solution.angle+(this.unit===2&&!this.laser?Math.PI/4:0);
    }
    if (this.remaining <= 0) {
      if (this.phase === 'warning') { this.phase = 'attack'; this.remaining = 0.45; volley = true; }
      else if (this.phase === 'attack') { this.phase = 'recover'; this.hitThisOpening = false; this.remaining = 3.5 - this.unit * 0.3; }
      else { this.phase = 'warning'; this.remaining = 1.4 - this.unit * 0.1; this.cycle++; this.aimIn=0; }
    }
    // Hold the launch position after locking; recovery is a stable punish window.
    if (this.phase !== 'warning' || this.remaining <= 0.8) {
      self.vx = 0; self.vy = 0;
      return { volley, control: { turn: 0, thrust: 0, fire: false, independentAim: true, aim: this.angle, move: { x: 0, y: 0 } } };
    }
    const desired = Math.atan2(target.y - self.y, target.x - self.x) + Math.PI / 2;
    const move = this.terrain.choose(dt, self, target, map.bodies, { time, wormholes: map.wormholes }, desired, map.shipGravity ?? 'none', 420);
    return { volley, control: { turn: 0, thrust: 0, fire: false, independentAim: true, aim: this.angle,
      move } };
  }
}
