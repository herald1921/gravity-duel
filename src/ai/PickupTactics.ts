import { BULLET_SPEED, HEAVY_SPEED_MULTIPLIER, LASER_CHARGE_TIME } from '../config.js';
import type { Ship } from '../entities/Ship.js';
import type { Loadout, PowerUpType } from '../entities/PowerUp.js';

export function wantsPickup(ship: Loadout, type: PowerUpType): boolean {
  if (type === 'shield') return !ship.shield;
  if (type === 'trajectory') return (ship.aimAssistFor ?? 0) < 3;
  return !ship.specialShot;
}

export function weaponLeadTime(self: Ship, target: Ship, skill: number): number {
  const accuracy = self.aimAssistFor > 0 ? Math.max(0.65, skill) : skill;
  const distance = Math.hypot(target.x - self.x, target.y - self.y);
  switch (self.specialShot) {
    case 'laser': return LASER_CHARGE_TIME * (0.5 + accuracy * 0.5);
    case 'heavy': return Math.min(1.6, distance / (BULLET_SPEED * HEAVY_SPEED_MULTIPLIER)) * accuracy;
    case 'homing': return Math.min(0.35, distance / BULLET_SPEED) * accuracy;
    case 'orbital': return 0.3 * accuracy;
    default: return Math.min(1.3, distance / BULLET_SPEED) * accuracy;
  }
}

export function preferredRange(ship: Ship): number {
  const range = ship.specialShot === 'heavy' ? 360 : ship.specialShot === 'homing' ? 440 :
    ship.specialShot === 'laser' ? 590 : 520;
  return range - (ship.shield ? 70 : 0);
}
