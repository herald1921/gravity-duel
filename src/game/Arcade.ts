import { MAPS } from '../maps/maps.js';
export const ARCADE = MAPS.map((map, i) => ({ mapId: map.id, targetScore: i < 3 ? 3 : 4 }));
export function nextArena(index: number): number | null { return index + 1 < ARCADE.length ? index + 1 : null; }
