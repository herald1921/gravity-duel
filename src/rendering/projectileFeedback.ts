import { ARENA_BOUNDS, ORBITAL_BULLET_LIFETIME, ORBIT_EXPIRY_WARNING } from '../config.js';
import type { Vec2 } from '../physics/gravity.js';
export function orbitalAlpha(age: number): number {
  return ORBITAL_BULLET_LIFETIME - age > ORBIT_EXPIRY_WARNING ? 1 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(age * Math.PI * 8));
}
/** Keep markers and end notices inside the visible arena, clear of the HUD. */
export function projectileIndicator(point: Vec2): (Vec2 & { angle: number }) | null {
  const left = ARENA_BOUNDS.left + 24, right = ARENA_BOUNDS.right - 24;
  const top = ARENA_BOUNDS.top + 24, bottom = ARENA_BOUNDS.bottom - 24;
  if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return null;
  const x = Math.max(left, Math.min(right, point.x)), y = Math.max(top, Math.min(bottom, point.y));
  return { x, y, angle: Math.atan2(point.y - y, point.x - x) };
}
