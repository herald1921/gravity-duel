import { ARCADE } from './Arcade.js';
export function campaignUnlocked(index:number,cleared:readonly number[]):boolean {
  return Number.isInteger(index)&&index>=0&&index<ARCADE.length&&(index===0||cleared.includes(index)||cleared.includes(index-1));
}
/** Enforce progression at scene entry as well as in the level-selection UI. */
export function campaignEntry(requested:number,cleared:readonly number[]):number {
  if(campaignUnlocked(requested,cleared))return requested;
  return Math.max(0,ARCADE.findIndex((_,i)=>!cleared.includes(i)&&campaignUnlocked(i,cleared)));
}
