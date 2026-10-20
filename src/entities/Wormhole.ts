import { WORMHOLE_RADIUS, WORMHOLE_REENTRY_COOLDOWN } from '../config.js';
import type { ProjectileState } from '../physics/gravity.js';
import type { Ship } from './Ship.js';
export interface Wormhole { id: string; exitId: string; x: number; y: number; orientation: number; radius: number }
export function portalPair(a: [number, number, number], b: [number, number, number]): Wormhole[] {
  return [{ id: 'gate-a', exitId: 'gate-b', x: a[0], y: a[1], orientation: a[2], radius: WORMHOLE_RADIUS },
    { id: 'gate-b', exitId: 'gate-a', x: b[0], y: b[1], orientation: b[2], radius: WORMHOLE_RADIUS }];
}
export function teleportShip(ship: Ship, entry: Wormhole, exit: Wormhole): void {
  const angle = exit.orientation - entry.orientation;
  const proxy: ProjectileState = { x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy,
    radius: ship.radius, ownerId: ship.id, age: 0 };
  teleportProjectile(proxy, entry, exit);
  ship.x = proxy.x; ship.y = proxy.y; ship.vx = proxy.vx; ship.vy = proxy.vy;
  ship.angle = Math.atan2(Math.sin(ship.angle + angle), Math.cos(ship.angle + angle));
  ship.hullAngle = Math.atan2(Math.sin(ship.hullAngle + angle), Math.cos(ship.hullAngle + angle));
  if (ship.laserCharge) ship.laserCharge.angle += angle;
  ship.portalCooldown = WORMHOLE_REENTRY_COOLDOWN;
}
export function teleportProjectile(state: ProjectileState, entry: Wormhole, exit: Wormhole): void {
  const angle = exit.orientation - entry.orientation, c = Math.cos(angle), s = Math.sin(angle);
  const vx = state.vx * c - state.vy * s, vy = state.vx * s + state.vy * c;
  const speed = Math.hypot(vx, vy);
  const distance = exit.radius + state.radius + 2;
  const from = { x: state.x, y: state.y };
  state.vx = vx; state.vy = vy;
  state.x = exit.x + (speed > 1e-9 ? vx / speed : Math.cos(exit.orientation)) * distance;
  state.y = exit.y + (speed > 1e-9 ? vy / speed : Math.sin(exit.orientation)) * distance;
  state.portalCooldown = WORMHOLE_REENTRY_COOLDOWN;
  state.teleport = { from, to: { x: state.x, y: state.y } };
}
