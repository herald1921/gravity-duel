import { POWERUP_RADIUS } from '../config.js';
export type SpecialShot = 'laser' | 'orbital' | 'heavy' | 'homing';
export type PowerUpType = 'shield' | 'trajectory' | SpecialShot;
export type ProjectileKind = 'normal' | 'orbital' | 'heavy' | 'homing';
export interface Loadout { shield: boolean; specialShot: SpecialShot | null; aimAssistFor?: number }
export interface Pickup { id: number; type: PowerUpType; x: number; y: number; age: number; radius: number }
export const POWERUP_COLORS: Record<PowerUpType, number> = { trajectory: 0x77eee3, shield: 0x75d9ff, laser: 0xffcf70, orbital: 0xb6ff74, heavy: 0xe6a5ff, homing: 0xffa66b };
export const POWERUP_NAMES: Record<PowerUpType, string> = { trajectory: 'GUIDANCE', shield: 'SHIELD', laser: 'LASER', orbital: 'ORBITAL', heavy: 'HEAVY', homing: 'HOMING' };
export const POWERUP_HELP: Record<PowerUpType, string> = {
  trajectory: 'GUIDANCE: reveals your shot path for 12 seconds',
  shield: 'SHIELD: blocks one hit; lethal cores still destroy ships',
  heavy: 'HEAVY: a larger, slower shell for your next shot',
  laser: 'LASER: charge, then fire straight through gravity',
  homing: 'HOMING: tracks briefly; sharp turns can shake it off',
  orbital: 'ORBITAL: skim a planet to leave a 48-second threat',
};
export function applyPickup(loadout: Loadout, type: PowerUpType): void {
  if (type === 'trajectory') loadout.aimAssistFor = 12;
  else if (type === 'shield') loadout.shield = true; else loadout.specialShot = type;
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
