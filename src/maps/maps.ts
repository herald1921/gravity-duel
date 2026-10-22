import { MOVING_MOON_ORBIT_PERIOD } from '../config.js';
import { CAMPAIGN_MAPS } from './campaign.js';
import { createBody, type CelestialBody } from '../entities/CelestialBody.js';
import type { Spawn } from '../entities/Ship.js';
import { portalPair, type Wormhole } from '../entities/Wormhole.js';
import type { PowerUpType } from '../entities/PowerUp.js';
import type { Vec2 } from '../physics/gravity.js';
export interface GameMap {
  id: string; name: string; description: string; hint: string;
  player1Spawn: Spawn; player2Spawn: Spawn; bodies: readonly CelestialBody[];
  wormholes?: readonly Wormhole[]; powerUpSpawnPoints?: readonly Vec2[];
  powerUps?: readonly PowerUpType[]; pickupStart?: number;
  shipGravity?: 'none' | 'all' | 'blackHoles';
  extraEnemySpawns?: readonly Spawn[];
  campaignIndex?: number; lesson?: PowerUpType;
}
const contest = [{ x: 610, y: 175 }, { x: 640, y: 600 }, { x: 380, y: 400 }, { x: 870, y: 400 }];
const spawns = { player1Spawn: { x: 210, y: 570, angle: -0.5 }, player2Spawn: { x: 1070, y: 190, angle: 2.65 } };
export const MAPS: readonly GameMap[] = [
  { id: 'classic-orbit', name: 'Classic Orbit', description: 'Let gravity finish the turn.',
    hint: 'AIM BESIDE THE PLANET — GRAVITY BENDS SHOTS',
    player1Spawn: { x: 260, y: 610, angle: -0.57 }, player2Spawn: { x: 900, y: 200, angle: 2.57 },
    bodies: [createBody('planet', 'planet', 600, 400)] },
  { id: 'twin-moons', name: 'Twin Moons', description: 'Two pulls. One winding shot.',
    hint: 'SHIELD BLOCKS ONE SHOT — NOT A LETHAL CORE',
    player1Spawn: { x: 210, y: 470, angle: 0 }, player2Spawn: { x: 990, y: 330, angle: Math.PI },
    bodies: [createBody('moon-a', 'moon', 460, 335), createBody('moon-b', 'moon', 740, 465)],
    powerUpSpawnPoints: contest, powerUps: ['shield'] },
  { id: 'solar-divide', name: 'Solar Divide', description: 'A lethal core. A wide slingshot.',
    hint: 'STARS ARE LETHAL — EVEN WITH A SHIELD',
    player1Spawn: { x: 225, y: 600, angle: -0.49 }, player2Spawn: { x: 975, y: 200, angle: 2.65 },
    bodies: [createBody('sun', 'star', 600, 400)], powerUpSpawnPoints: contest, powerUps: ['shield'] },
  { id: 'gravity-well', name: 'Event Horizon', description: 'Risk the pull. Bend the impossible.',
    hint: 'BLACK HOLES PULL SHIPS — THRUST TO ESCAPE',
    player1Spawn: { x: 240, y: 590, angle: -0.49 }, player2Spawn: { x: 960, y: 210, angle: 2.65 },
    bodies: [createBody('singularity', 'blackHole', 600, 400, { collisionRadius: 32 })],
    powerUpSpawnPoints: contest, powerUps: ['laser'] },
  { id: 'pulsar', name: 'Pulsar', description: 'Read the beam. Time your move.',
    hint: 'AVOID THE BEAM — THRUST AND TURN ARE REDUCED', ...spawns,
    bodies: [createBody('pulsar', 'pulsar', 640, 375, { beamPhase: -0.7 })],
    powerUpSpawnPoints: contest, powerUps: ['homing', 'shield', 'laser'] },
  { id: 'wormhole-relay', name: 'Wormhole Relay', description: 'One shot. Two sides of space.',
    hint: 'SHIPS + SHOTS CAN REUSE PORTALS — LASERS STAY STRAIGHT', ...spawns,
    bodies: [createBody('relay-moon', 'moon', 640, 370)],
    wormholes: portalPair([390, 320, 0], [890, 440, -Math.PI / 2]),
    powerUpSpawnPoints: [{ x: 550, y: 180 }, { x: 730, y: 585 }], powerUps: ['homing', 'shield', 'laser'] },
  { id: 'orbital-lab', name: 'Orbital Lab', description: 'Lock an orbit. Leave a lasting threat.',
    hint: 'ORBITAL: YOUR APPROACH SHAPES A SAFE ELLIPTICAL ORBIT', ...spawns,
    bodies: [createBody('lab-planet', 'planet', 540, 360, { radius: 78 }), createBody('lab-moon', 'moon', 865, 390, { radius: 40 })],
    powerUpSpawnPoints: [{ x: 390, y: 510 }, { x: 930, y: 245 }, { x: 665, y: 570 }],
    powerUps: ['orbital', 'orbital', 'orbital', 'shield'], pickupStart: 3 },
  { id: 'moving-orbit', name: 'Moving Orbit', description: 'The gravity well moves with the moon.',
    hint: 'THE MOON MOVES — LOCKED SHOTS TRAVEL WITH IT', ...spawns,
    bodies: [createBody('anchor', 'planet', 640, 375, { radius: 65 }),
      createBody('moving-moon', 'moon', 640, 375, { radius: 32, motion: { radius: 185, period: MOVING_MOON_ORBIT_PERIOD, phase: -1 } })],
    powerUpSpawnPoints: [{ x: 360, y: 380 }, { x: 920, y: 380 }, { x: 640, y: 610 }],
    powerUps: ['homing', 'orbital', 'shield', 'laser', 'heavy'] },
  { id: 'event-gateway', name: 'Event Gateway', description: 'A portal relay through a singularity.',
    hint: 'BEND THROUGH THE GATES — KEEP YOUR SHIP CLEAR', ...spawns,
    bodies: [createBody('gateway-hole', 'blackHole', 640, 375, { collisionRadius: 32 }),
      createBody('gateway-moon', 'moon', 940, 470, { radius: 32 })],
    wormholes: portalPair([425, 255, -0.25], [825, 530, -2.1]),
    powerUpSpawnPoints: [{ x: 475, y: 500 }, { x: 820, y: 230 }], powerUps: ['homing', 'shield', 'orbital', 'laser', 'heavy'] },
];
export function getMap(id: string): GameMap { return [...CAMPAIGN_MAPS, ...MAPS].find(map => map.id === id) ?? MAPS[0]; }
