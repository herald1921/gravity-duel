import type { ProjectileState } from '../physics/gravity.js';
export type Highlight = 'ORBITAL HIT' | 'PORTAL SHOT' | 'SLINGSHOT' | 'MISSILE HIT';
export function shotHighlight(shot: ProjectileState): Highlight | undefined {
  if (shot.orbitState) return 'ORBITAL HIT';
  if (shot.portalVisits) return 'PORTAL SHOT';
  if (shot.kind === 'homing') return 'MISSILE HIT';
  if (shot.age > 0.4 && Math.abs(shot.gravityTurn ?? 0) >= Math.PI / 6) return 'SLINGSHOT';
  return undefined;
}
