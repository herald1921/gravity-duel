import { createBody, type CelestialBodyType as BodyType, type CelestialBody } from '../entities/CelestialBody.js';
import { portalPair } from '../entities/Wormhole.js';
import { POWERUP_HELP, type PowerUpType } from '../entities/PowerUp.js';
import type { GameMap } from './maps.js';

export const UNITS = ['PLANETS & MOONS', 'STELLAR SYSTEMS', 'EVENT HORIZONS'];
const powers: PowerUpType[] = ['trajectory', 'shield', 'heavy', 'laser', 'homing', 'orbital'];
const names = [
  ['First Orbit', 'Lunar Shield', 'Heavy Metal', 'Light Speed', 'Tail Chase', 'Orbital Lab', 'Moon Dance', 'Wingmen', 'Lunar Fleet'],
  ['First Light', 'Binary Suns', 'Neutron Star', 'Solar Family', 'Three Suns', 'Portal Relay', 'Star Dance', 'Solar Patrol', 'Stellar Fleet'],
  ['Into the Well', 'Gravity Gates', 'Twin Horizons', 'Dark Companion', 'Gravity Web', 'Event Relay', 'Moving Wells', 'Void Patrol', 'Final Horizon'],
];
function bodiesFor(unit: number, stage: number): CelestialBody[] {
  const body = (id: string, type: BodyType, x: number, y: number, radius: number, moving = false) =>
    createBody(id, type, x, y, { radius, ...(moving ? { motion: { radius: 48, period: 22, phase: -1 } } : {}) });
  if (unit === 0) return [body('planet', 'planet', 625, 375, 65),
    ...(stage > 0 ? [createBody('moon', 'moon', stage >= 6 ? 625 : 800, stage >= 6 ? 375 : 440,
      { radius: 30, ...(stage >= 6 ? { motion: { radius: 175, period: 26, phase: -1 } } : {}) })] : [])];
  if (unit === 1) {
    if (stage === 0) return [body('sun', 'star', 640, 375, 78)];
    if (stage === 2) return [body('neutron', 'pulsar', 640, 375, 25)];
    if (stage === 3) return [body('sun', 'star', 485, 360, 68), body('earth', 'planet', 750, 410, 44), body('moon', 'moon', 860, 440, 22)];
    const stars = [body('sun-a', 'star', 510, 330, 58, stage >= 6), body('sun-b', 'star', 780, 440, 52, stage >= 6)];
    if (stage === 4 || stage === 8) stars.push(body('sun-c', 'star', 740, 235, 36));
    if (stage === 7) stars.push(body('neutron', 'pulsar', 620, 540, 22));
    return stars;
  }
  const wells = [body('hole-a', 'blackHole', 600, 365, 27, stage >= 6)];
  if (stage >= 2) wells.push(body('hole-b', 'blackHole', 825, 455, 25, stage >= 6));
  if (stage >= 3) wells.push(body('companion', stage === 3 ? 'star' : 'planet', 775, 235, 40));
  if (stage >= 5) wells.push(body('moon', 'moon', 430, 490, 28));
  return wells;
}
export const CAMPAIGN_MAPS: readonly GameMap[] = Array.from({ length: 27 }, (_, index) => {
  const unit = Math.floor(index / 9), stage = index % 9;
  const lesson = unit === 0 && stage < powers.length ? powers[stage] : undefined;
  const portals = unit === 1 && stage >= 5 || unit === 2 && stage >= 1;
  const extraEnemySpawns = stage >= 7 ? [{ x: 1100, y: 400, angle: Math.PI },
    ...(stage >= 8 ? [{ x: 1070, y: 600, angle: -2.8 }] : [])] : [];
  const hint = lesson ? POWERUP_HELP[lesson] : unit === 2 && stage === 0 ? 'SHIP GRAVITY IS ON — KEEP THRUSTING TO ESCAPE THE WELL' :
    portals && (stage === 5 || unit === 2 && stage === 1) ? 'PORTALS CARRY SHIPS AND SHOTS — LASERS STAY STRAIGHT' :
    unit === 1 && stage === 2 ? 'NEUTRON BEAMS JAM YOUR THRUST AND TURN' :
    stage >= 7 ? 'CLEAR THE WHOLE ENEMY SQUAD TO SCORE — STAY MOBILE' :
    stage >= 6 ? 'MOVING GRAVITY WELLS — WATCH THE NEXT POSITION' :
    unit === 1 ? 'STARS ARE LETHAL — YOUR SHIP STILL IGNORES GRAVITY' : 'MULTIPLE GRAVITY WELLS BEND EVERY SHOT';
  return {
    id: `unit-${unit + 1}-${stage + 1}`, name: names[unit][stage], description: hint, hint,
    campaignIndex: index, lesson, shipGravity: unit === 2 ? 'all' : 'none',
    player1Spawn: { x: 170, y: 555, angle: -0.35 }, player2Spawn: { x: 1070, y: 185, angle: 2.8 },
    extraEnemySpawns, bodies: bodiesFor(unit, stage),
    ...(portals ? { wormholes: portalPair([350, 265, 0.2], [945, 540, -2.8]) } : {}),
    powerUpSpawnPoints: [{ x: 350, y: 600 }, { x: 925, y: 270 }, { x: 620, y: 610 }, { x: 520, y: 185 }],
    powerUps: lesson ? [lesson, ...powers.slice(0, stage + 1)] : powers,
    pickupStart: 0.8,
  };
});
