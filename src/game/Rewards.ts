import type { GameMode, Match } from './Match.js';
export const BADGES = [
  { id: 'clean-sweep', name: 'CLEAN SWEEP', description: 'Win an AI match without losing a ship.' },
  { id: 'slingshot', name: 'SLINGSHOT', description: 'Score with a shot bent by gravity.' },
  { id: 'portal', name: 'WORMHOLE ACE', description: 'Score through a wormhole.' },
  { id: 'orbit', name: 'ORBIT MASTER', description: 'Score with a captured orbital missile.' },
] as const;
export type BadgeId = typeof BADGES[number]['id'];
export const PAINTS = [
  { id: 'teal', name: 'ION', color: 0x77eee3, badges: 0 },
  { id: 'amber', name: 'SOLAR', color: 0xffcf70, badges: 1 },
  { id: 'violet', name: 'NEBULA', color: 0xc0a1ff, badges: 2 },
  { id: 'ice', name: 'STARDUST', color: 0xe7f1fa, badges: 4 },
] as const;
export type PaintId = typeof PAINTS[number]['id'];
export const isBadge = (id: unknown): id is BadgeId => BADGES.some(b => b.id === id);
export function earnedBadges(match: Match, mode: GameMode): BadgeId[] {
  if (mode !== '1p' || match.phase !== 'matchOver') return [];
  const earned: BadgeId[] = [];
  if (match.winner === 1 && match.deathCounts[1] === 0) earned.push('clean-sweep');
  for (const [highlight, badge] of [['SLINGSHOT', 'slingshot'], ['PORTAL SHOT', 'portal'], ['ORBITAL HIT', 'orbit']] as const)
    if (match.scoringHighlights[1].has(highlight)) earned.push(badge);
  return earned;
}
export function defeatTip(match: Match): string {
  if (match.lastDeath?.cause === 'self') return 'Your shots can return. Move after firing.';
  if (match.lastDeath?.cause === 'hazard') return 'Avoid the glowing core. Thrust away early.';
  if (match.lastDeath?.highlight === 'MISSILE HIT') return 'Break missile locks behind a planet.';
  return 'Fire, then move. Watch the enemy shot trail.';
}
