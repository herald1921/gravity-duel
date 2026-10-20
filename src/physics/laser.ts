import { LASER_RADIUS, LASER_RANGE, MUZZLE_OFFSET } from '../config.js';
import { bodyPosition, type CelestialBody } from '../entities/CelestialBody.js';
import type { Launcher } from '../entities/Bullet.js';
import { segmentCircleContact, type CollisionTarget, type ProjectileEvent, type Vec2 } from './gravity.js';
export interface LaserTrace { start: Vec2; end: Vec2; event: ProjectileEvent | null }
export function traceLaser(ship: Launcher, bodies: readonly CelestialBody[], targets: readonly CollisionTarget[], time: number, angle = ship.angle): LaserTrace {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const start = { x: ship.x + dx * MUZZLE_OFFSET, y: ship.y + dy * MUZZLE_OFFSET };
  const far = { x: start.x + dx * LASER_RANGE, y: start.y + dy * LASER_RANGE };
  let contact = 1, event: ProjectileEvent | null = null;
  for (const body of bodies) {
    const t = segmentCircleContact(start, far, { ...bodyPosition(body, time), radius: body.collisionRadius }, LASER_RADIUS);
    if (t !== null && t < contact) { contact = t; event = { type: 'body', bodyId: body.id }; }
  }
  for (const target of targets) {
    if (target.id === ship.id || target.alive === false) continue;
    const t = segmentCircleContact(start, far, target, LASER_RADIUS);
    if (t !== null && t < contact) { contact = t; event = { type: 'ship', shipId: target.id }; }
  }
  return { start, end: { x: start.x + (far.x - start.x) * contact, y: start.y + (far.y - start.y) * contact }, event };
}
