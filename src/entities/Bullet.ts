import { BULLET_RADIUS, BULLET_SPEED, BULLET_VELOCITY_INHERITANCE, HEAVY_RADIUS, HEAVY_SPEED_MULTIPLIER, HOMING_SPEED_MULTIPLIER, MUZZLE_OFFSET } from '../config.js';
import type { ProjectileState, Vec2 } from '../physics/gravity.js';
import type { PlayerId } from './Ship.js';
import type { ProjectileKind } from './PowerUp.js';
export interface Bullet extends ProjectileState { trail: Vec2[] }
export interface Launcher extends Vec2 { id: PlayerId; angle: number; vx: number; vy: number }
export function createProjectile(ship: Launcher, angle = ship.angle, kind: ProjectileKind = 'normal', time = 0): ProjectileState {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const speed = BULLET_SPEED * (kind === 'heavy' ? HEAVY_SPEED_MULTIPLIER : kind === 'homing' ? HOMING_SPEED_MULTIPLIER : 1);
  return { x: ship.x + dx * MUZZLE_OFFSET, y: ship.y + dy * MUZZLE_OFFSET,
    vx: dx * speed + ship.vx * BULLET_VELOCITY_INHERITANCE, vy: dy * speed + ship.vy * BULLET_VELOCITY_INHERITANCE,
    age: 0, radius: kind === 'heavy' ? HEAVY_RADIUS : BULLET_RADIUS, ownerId: ship.id, kind, time };
}
