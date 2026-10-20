import { POWERUP_RADIUS } from '../config.js';
export type SpecialShot = 'laser' | 'orbital' | 'heavy' | 'homing';
export type PowerUpType = 'shield' | SpecialShot;
export type ProjectileKind = 'normal' | 'orbital' | 'heavy' | 'homing';
export interface Loadout { shield: boolean; specialShot: SpecialShot | null }
export interface Pickup { id: number; type: PowerUpType; x: number; y: number; age: number; radius: number }
export const POWERUP_COLORS: Record<PowerUpType, number> = { shield: 0x75d9ff, laser: 0xffcf70, orbital: 0xb6ff74, heavy: 0xe6a5ff, homing: 0xffa66b };
export const POWERUP_NAMES: Record<PowerUpType, string> = { shield: 'SHIELD', laser: 'LASER', orbital: 'ORBITAL', heavy: 'HEAVY', homing: 'HOMING' };
export function applyPickup(loadout: Loadout, type: PowerUpType): void {
  if (type === 'shield') loadout.shield = true; else loadout.specialShot = type;
}
export function consumeShot(loadout: Loadout): SpecialShot | 'normal' {
  const shot = loadout.specialShot ?? 'normal'; loadout.specialShot = null; return shot;
}
export function blockAttack(loadout: Loadout): boolean {
  if (!loadout.shield) return false; loadout.shield = false; return true;
}
export function createPickup(id: number, type: PowerUpType, point: { x: number; y: number }): Pickup {
  return { id, type, ...point, age: 0, radius: POWERUP_RADIUS };
}
