import type { Ship } from '../entities/Ship.js';
import type { GameMap } from '../maps/maps.js';
import { createProjectile } from '../entities/Bullet.js';
import { traceLaser } from '../physics/laser.js';
import { simulateTrajectory } from '../physics/gravity.js';
import { TRAJECTORY_PREVIEW_TIME, ORBIT_PREVIEW_ARC } from '../config.js';

/** Equipment controls visibility, never whether a pilot is human or AI. */
export function aimPreview(ship: Ship, map: GameMap, ships: readonly Ship[], time: number) {
  if (!ship.alive) return null;
  const targets=ships.filter(s=>s.invulnerableFor<=0&&(s.id===ship.id||!map.teams||map.teams[s.id-1]!==map.teams[ship.id-1]));
  if (ship.specialShot === 'laser' || ship.laserCharge) {
    const beam = traceLaser(ship, map.bodies, targets, time, ship.laserCharge?.angle);
    return { laser: true, points: [beam.start, beam.end] };
  }
  if (ship.aimAssistFor <= 0) return null;
  return { laser: false, points: simulateTrajectory(createProjectile(ship, ship.angle, ship.specialShot ?? 'normal', time),
    map.bodies, targets, TRAJECTORY_PREVIEW_TIME, 9,
    { time, wormholes: map.wormholes, maxOrbitArc: ORBIT_PREVIEW_ARC }).points };
}
