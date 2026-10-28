import type { ShipControl } from '../entities/Ship.js';
export function boundedInput(value: unknown): ShipControl {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<ShipControl>;
  const unit = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
  const move = v.move && {x: unit(v.move.x), y: unit(v.move.y)};
  return {turn: unit(v.turn), thrust: unit(v.thrust), fire: v.fire === true, move,
    aim: typeof v.aim === 'number' && Number.isFinite(v.aim) ? Math.atan2(Math.sin(v.aim), Math.cos(v.aim)) : undefined,
    independentAim: v.independentAim === true};
}
