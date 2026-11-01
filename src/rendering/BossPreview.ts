import type { BossEncounter } from '../game/BossEncounter.js';
import type { Ship } from '../entities/Ship.js';
import type { GameMap } from '../maps/maps.js';
import { createProjectile } from '../entities/Bullet.js';
import { simulateTrajectory, type TrajectoryPoint } from '../physics/gravity.js';
import { traceLaser } from '../physics/laser.js';
export function bossPreview(boss:BossEncounter,ship:Ship,map:GameMap,time:number):TrajectoryPoint[][]{
  if(!ship.alive||boss.phase!=='warning')return [];
  if(boss.laser){const ray=traceLaser(ship,map.bodies,[],time+boss.remaining,boss.angle);return [[ray.start,ray.end]];}
  return boss.shotAngles.map(angle=>simulateTrajectory(createProjectile({...ship,vx:0,vy:0,muzzleOffset:ship.radius+10},angle,'normal',time+boss.remaining),
    map.bodies,[],2.8,8,{time:time+boss.remaining,wormholes:map.wormholes}).points);
}
