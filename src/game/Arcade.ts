import { CAMPAIGN_MAPS } from '../maps/campaign.js';
export const ARCADE = CAMPAIGN_MAPS.map(map => ({ mapId: map.id, targetScore: 3 }));
export function nextArena(index: number): number | null { return index + 1 < ARCADE.length ? index + 1 : null; }
