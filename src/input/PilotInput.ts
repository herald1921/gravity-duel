import type { ShipControl } from '../entities/Ship.js';
export function pilotInput(x: number, y: number, aim: number | undefined, fire: boolean): ShipControl {
  const length = Math.max(1, Math.hypot(x, y));
  return { turn: 0, thrust: 0, fire, independentAim: true,
    ...(x || y ? { move: { x: x / length, y: y / length } } : {}),
    ...(Number.isFinite(aim) ? { aim } : {}) };
}
