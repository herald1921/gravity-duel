import { createBody, type CelestialBodyType as BodyType, type CelestialBody } from '../entities/CelestialBody.js';
import { portalPair } from '../entities/Wormhole.js';
import { type PowerUpType } from '../entities/PowerUp.js';
import type { GameMap } from './maps.js';
import { binarySystem, solarFamily, tripleSystem } from './systems.js';

export const UNITS = ['PLANETS & MOONS', 'STELLAR SYSTEMS', 'EVENT HORIZONS'];
export const UNIT_COUNTS = [7, 10, 13];
export const UNIT_STARTS = [0, 7, 17];
export const unitForIndex = (index: number): number => index < 7 ? 0 : index < 17 ? 1 : 2;
const powers: PowerUpType[] = ['trajectory', 'shield', 'heavy', 'laser', 'homing', 'orbital'];
const names = [
  ['First Orbit', 'Split Moons', 'Heavy Crossing', 'Laser Alley', 'Crescent Chase', 'Orbital Forge', 'Moon Pendulum', 'Twin Harbors', 'Lunar Crown'],
  ['First Light', 'Binary Suns', 'Neutron Star', 'Solar Family', 'Three Suns', 'Neutron Crossing', 'Solar Orbits', 'Neutron Patrol', 'Triple-Star Fleet'],
  ['Into the Well', 'Wormhole Passage', 'Twin Horizons', 'Dark Companion', 'Gravity Web', 'Event Relay', 'Moving Wells', 'Dark Satellite', 'Final Horizon', 'Split Vortices', 'Neutron Abyss', 'Wormhole Weave'],
];
// Each arena has its own geometry. Progression is independent of layout: six static
// lessons, moving duels, a four-way battle, a coordinated squad, then an extra boss.
const tactics = [
  ['One offset planet leaves a wide outside lane.', 'Two separated moons offer alternating cover.', 'Diagonal planets split the arena into crossing lanes.',
    'Four moons frame a clear central laser lane.', 'A crescent of moons shelters the far side of a planet.', 'Two unequal planets offer different orbital traps.',
    'A moving moon opens and closes the gap to a distant outpost.', 'Two planet-moon systems form separate fighting zones.', 'Three concentric moon orbits sweep the central arena.'],
  ['An offset sun leaves a safe lunar flank.', 'Unequal suns form a diagonal passage.', 'A neutron star sweeps between two lunar outposts.',
    'A static sun, planet and moon form three stepping stones.', 'Three suns surround an open central pocket.', 'A neutron beam crosses the passage below a sun.',
    'The moon follows its planet around the sun.', 'A moving neutron companion sweeps two changing firing lanes.', 'A close binary and distant third star shift the firing lanes.'],
  ['Escape an offset well toward the planet on the far side.', 'Wormholes connect the lunar passage to the far side of the well.', 'Opposite wells pull across a small central moon.',
    'A black hole and a sun guard opposite sides of the passage.', 'Three wells enclose a small planetary refuge.', 'An offset wormhole route crosses a chain of planetary cover.',
    'Paired black holes orbit beside a distant lunar outpost.', 'A planet and its moon circle a central black hole.', 'Three moving wells face two distant planetary strongholds.',
    'Separate moon systems orbit two distant wells.', 'A neutron star circles a black hole beside a small sun.', 'Two wormhole pairs cross a moving planetary screen.'],
];
function bodiesFor(unit: number, stage: number): CelestialBody[] {
  const body = (id: string, type: BodyType, x: number, y: number, radius: number) =>
    createBody(id, type, x, y, { radius });
  const orbit = (id: string, type: BodyType, x: number, y: number, radius: number, distance: number, period: number, phase: number) =>
    createBody(id, type, x, y, { radius, motion: { radius: distance, period, phase } });
  if (unit === 0) {
    if (stage === 0) return [body('planet', 'planet', 540, 385, 64)];
    if (stage === 1) return [body('moon-a', 'moon', 480, 285, 48), body('moon-b', 'moon', 790, 475, 58)];
    if (stage === 2) return [body('planet-a', 'planet', 470, 285, 62), body('planet-b', 'planet', 800, 480, 72), body('moon', 'moon', 650, 370, 24)];
    if (stage === 3) return [body('moon-a', 'moon', 470, 240, 35), body('moon-b', 'moon', 470, 535, 42), body('moon-c', 'moon', 810, 240, 42), body('moon-d', 'moon', 810, 535, 35)];
    if (stage === 4) return [body('planet', 'planet', 735, 380, 68), body('moon-a', 'moon', 510, 230, 25), body('moon-b', 'moon', 440, 375, 35), body('moon-c', 'moon', 510, 520, 25)];
    if (stage === 5) return [body('forge', 'planet', 500, 380, 80), body('anvil', 'planet', 870, 350, 45), body('moon-a', 'moon', 715, 210, 25), body('moon-b', 'moon', 720, 535, 30)];
    if (stage === 6) return [body('planet', 'planet', 480, 380, 55), orbit('pendulum', 'moon', 480, 380, 24, 145, 26, -1), body('outpost', 'moon', 900, 450, 40)];
    if (stage === 7) return [body('harbor-a', 'planet', 470, 380, 45), orbit('moon-a', 'moon', 470, 380, 22, 100, 18, -0.8),
      body('harbor-b', 'planet', 805, 365, 55), orbit('moon-b', 'moon', 805, 365, 24, 115, 27, 1.8)];
    return [body('crown', 'planet', 640, 375, 45), orbit('inner', 'moon', 640, 375, 16, 96, 12, -1),
      orbit('middle', 'moon', 640, 375, 22, 154, 23, 1.2), orbit('outer', 'moon', 640, 375, 16, 217, 38, 2.5),
      body('outpost-a', 'moon', 300, 350, 26), body('outpost-b', 'moon', 1000, 410, 32)];
  }
  if (unit === 1) {
    if (stage === 6) return solarFamily();
    if (stage === 7) return binarySystem({ x: 640, y: 375 }, 'star', 'pulsar', 230, 26, -1, [48, 25]);
    if (stage === 8) return tripleSystem();
    if (stage === 0) return [body('sun', 'star', 720, 300, 65), body('outpost', 'moon', 490, 490, 28)];
    if (stage === 1) return [body('sun-a', 'star', 470, 300, 52), body('sun-b', 'star', 805, 485, 70)];
    if (stage === 2) return [body('neutron', 'pulsar', 630, 380, 25), body('moon-a', 'moon', 405, 260, 34), body('moon-b', 'moon', 870, 515, 40)];
    if (stage === 3) return [body('sun', 'star', 470, 365, 60), body('earth', 'planet', 760, 360, 40), body('moon', 'moon', 850, 420, 20)];
    if (stage === 4) return [body('sun-a', 'star', 480, 275, 40), body('sun-b', 'star', 790, 265, 48), body('sun-c', 'star', 650, 495, 60)];
    return [body('sun', 'star', 590, 315, 62), body('neutron', 'pulsar', 780, 475, 25), body('outpost', 'moon', 415, 475, 32)];
  }
  if (stage >= 6) {
    if (stage === 9) return [body('west-well', 'blackHole', 440, 365, 25), orbit('west-moon', 'moon', 440, 365, 20, 112, 22, -0.8),
      body('east-well', 'blackHole', 840, 395, 25), orbit('east-moon', 'moon', 840, 395, 24, 130, 31, 1.6)];
    if (stage === 10) return [...binarySystem({ x: 590, y: 375 }, 'blackHole', 'pulsar', 220, 32, -0.7, [25, 23]),
      body('sun', 'star', 955, 340, 42), body('refuge', 'moon', 345, 240, 28)];
    if (stage === 11) return [body('well', 'blackHole', 640, 375, 26), orbit('screen-a', 'planet', 640, 375, 26, 115, 25, 0),
      orbit('screen-b', 'planet', 640, 375, 26, 115, 25, Math.PI), body('moon-a', 'moon', 410, 245, 28), body('moon-b', 'moon', 870, 510, 34)];
    if (stage === 6) return [...binarySystem({ x: 580, y: 375 }, 'blackHole', 'blackHole', 220, 30, -0.5, [25, 25]), body('outpost', 'moon', 970, 350, 35)];
    if (stage === 7) {
      const planet = orbit('satellite', 'planet', 620, 375, 30, 170, 32, -1);
      return [body('well', 'blackHole', 620, 375, 27), planet,
        createBody('moon', 'moon', 620, 375, { radius: 13, motion: { radius: 65, period: 9, phase: 0.8, parent: { x: planet.x, y: planet.y, motion: planet.motion } } }),
        body('outpost', 'moon', 950, 400, 28)];
    }
    return [...tripleSystem().map(b => createBody(b.id, 'blackHole', b.x, b.y, { radius: 23, motion: b.motion })),
      body('refuge-a', 'planet', 325, 310, 40), body('refuge-b', 'planet', 955, 480, 42)];
  }
  if (stage === 0) return [body('well', 'blackHole', 500, 380, 27), body('refuge', 'planet', 850, 300, 55)];
  if (stage === 1) return [body('well', 'blackHole', 720, 430, 27), body('moon-a', 'moon', 465, 260, 32), body('moon-b', 'moon', 465, 510, 40)];
  if (stage === 2) return [body('well-a', 'blackHole', 500, 260, 25), body('well-b', 'blackHole', 790, 490, 27), body('island', 'moon', 650, 375, 28)];
  if (stage === 3) return [body('well', 'blackHole', 530, 380, 27), body('sun', 'star', 820, 380, 55), body('moon', 'moon', 780, 210, 26)];
  if (stage === 4) return [body('well-a', 'blackHole', 450, 270, 24), body('well-b', 'blackHole', 825, 285, 24), body('well-c', 'blackHole', 650, 505, 24), body('refuge', 'planet', 640, 355, 38)];
  return [body('well', 'blackHole', 640, 360, 28), body('planet-a', 'planet', 430, 260, 50), body('planet-b', 'planet', 860, 500, 55), body('moon-a', 'moon', 465, 510, 25), body('moon-b', 'moon', 830, 220, 22)];
}
function portalsFor(unit: number, stage: number) {
  if (unit !== 2 || stage === 0) return undefined;
  if (stage === 9) return portalPair([300, 540, -0.7], [985, 185, 2.4]);
  if (stage === 10) return portalPair([320, 535, -0.5], [950, 565, -2.4]);
  if (stage === 11) return [
    ...portalPair([320, 410, 0], [960, 240, 2.4]),
    ...portalPair([500, 180, 1], [775, 590, -2.1]).map(w => ({ ...w, id: 'second-' + w.id, exitId: 'second-' + w.exitId })),
  ];
  return [
    portalPair([350, 385, 0], [960, 240, 2.5]), portalPair([375, 530, -0.7], [915, 240, 2.4]),
    portalPair([320, 225, 0.5], [975, 535, -2.6]), portalPair([340, 440, 0], [950, 440, Math.PI]),
    portalPair([335, 385, 0.3], [960, 340, -2.8]), portalPair([335, 230, 0.5], [960, 555, -2.5]),
    portalPair([300, 250, 0.5], [990, 550, -2.5]), portalPair([325, 535, -0.7], [955, 230, 2.4]),
  ][stage - 1];
}
const pickupSites = [
  [[350, 600], [810, 245], [770, 550], [370, 200]],
  [[350, 610], [645, 390], [925, 310], [650, 185]],
  [[350, 610], [615, 525], [790, 215], [950, 380]],
  [[345, 600], [640, 385], [920, 385], [350, 385]],
  [[330, 610], [610, 350], [945, 380], [740, 200]],
  [[340, 605], [660, 385], [925, 535], [545, 185]],
  [[340, 600], [740, 300], [760, 535], [910, 200]],
  [[330, 600], [640, 230], [650, 555], [1000, 245]],
  [[350, 605], [400, 185], [900, 580], [915, 200]],
  [[335, 595], [530, 260], [875, 440], [700, 570]],
  [[350, 610], [635, 375], [810, 205], [450, 520]],
  [[350, 600], [900, 245], [570, 570], [650, 180]],
  [[345, 605], [635, 240], [645, 530], [980, 350]],
  [[330, 600], [635, 350], [925, 405], [395, 450]],
  [[345, 605], [455, 200], [960, 350], [625, 590]],
  [[335, 600], [935, 350], [640, 625], [640, 135]],
  [[350, 600], [925, 270], [620, 610], [520, 185]],
  [[335, 600], [945, 350], [640, 625], [640, 135]],
  [[350, 610], [675, 250], [720, 550], [980, 450]],
  [[325, 610], [530, 385], [850, 190], [925, 580]],
  [[330, 600], [655, 180], [645, 565], [955, 385]],
  [[335, 600], [675, 385], [920, 190], [440, 190]],
  [[325, 610], [640, 190], [950, 590], [360, 385]],
  [[320, 605], [540, 385], [745, 580], [970, 200]],
  [[330, 610], [810, 245], [810, 540], [500, 180]],
  [[320, 610], [945, 220], [920, 585], [620, 115]],
  [[350, 610], [350, 190], [920, 610], [935, 345]],
  [[335, 610], [640, 210], [640, 550], [985, 460]],
  [[345, 610], [800, 570], [800, 200], [430, 555]],
  [[340, 610], [640, 180], [980, 555], [340, 190]],
];
// Stable authored layouts survive renumbering; legacy indices migrate completion by level identity.
const layouts = [
  ...[0, 2, 5, 6, 7, 8].map(stage => ({ unit: 0, layout: stage, legacy: stage })),
  { unit: 0, layout: 9, legacy: undefined },
  ...Array.from({ length: 9 }, (_, stage) => ({ unit: 1, layout: stage, legacy: 9 + stage })),
  { unit: 1, layout: 9, legacy: undefined },
  ...[0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 7, 8].map(stage => ({ unit: 2, layout: stage, legacy: stage < 9 ? 18 + stage : undefined })),
  { unit: 2, layout: 12, legacy: undefined },
];
const lessonGroups: PowerUpType[][] = [['trajectory', 'shield'], ['heavy', 'laser'], ['homing', 'orbital']];
const lessonHints = ['GUIDANCE REVEALS SHOT PATHS — SHIELD BLOCKS ONE HIT', 'HEAVY HITS HARD — LASER CHARGES THEN FIRES STRAIGHT', 'HOMING TURNS TOWARD RIVALS — ORBITAL ROUNDS CIRCLE PLANETS'];
export const CAMPAIGN_MAPS: readonly GameMap[] = Array.from({ length: 30 }, (_, index) => {
  const { unit, layout, legacy } = layouts[index], stage = index - UNIT_STARTS[unit], unitLength = UNIT_COUNTS[unit];
  const lessons = unit === 0 && stage < 3 ? lessonGroups[stage] : undefined, lesson = lessons?.[0];
  const freeForAll = stage === unitLength - 3, squad = stage === unitLength - 2, boss = stage === unitLength - 1;
  const wormholes = boss ? (unit === 2 ? portalPair([350, 190, 0.7], [940, 575, -2.4]) : undefined) : portalsFor(unit, layout);
  const bodies = boss ? bossBodies(unit) : bodiesFor(unit, layout);
  const extraEnemySpawns = freeForAll ? [{ x: 1100, y: 585, angle: Math.PI }, { x: 170, y: 185, angle: 0.35 }] : squad ? [{ x: 1100, y: 585, angle: Math.PI }] : [];
  const hint = freeForAll ? 'FOUR PILOTS — SCORE KILLS, RESPAWN, FIRST TO 4; 90 SECOND LIMIT' : lessons ? lessonHints[stage] : unit === 2 && stage === 0 ? 'SHIP GRAVITY IS ON — KEEP THRUSTING TO ESCAPE THE WELL' :
    wormholes && stage === 1 ? 'WORMHOLES CONNECT DISTANT SPACE — SHIPS AND SHOTS CAN CROSS; LASERS CANNOT' :
    unit === 1 && stage === 2 ? 'NEUTRON STAR: ROTATING BEAMS JAM THRUST AND TURN; THE CORE IS LETHAL' :
    boss ? 'BOSS: DODGE THE WARNING VOLLEY — STRIKE DURING RECOVERY' : squad ? 'OUTMANEUVER TWO COORDINATED ENEMIES' :
    bodies.some(b => b.motion) ? 'MOVING GRAVITY WELLS — WATCH THE NEXT POSITION' :
    unit === 1 ? 'STARS ARE LETHAL — YOUR SHIP STILL IGNORES GRAVITY' : 'MULTIPLE GRAVITY WELLS BEND EVERY SHOT';
  return {
    id: `unit-${unit + 1}-${stage + 1}`, name: boss ? ['Orbital Warden', 'Solar Dreadnought', 'Event Sovereign'][unit] : names[unit][layout], description: boss ? ['A lunar shield ring surrounds the four-cannon warden.', 'A drifting sun and neutron sentry protect the dreadnought.', 'Two wells frame a wormhole route behind the sovereign.'][unit] : tactics[unit][layout], hint,
    campaignIndex: index, unitIndex: unit, stageIndex: stage, unitLength, legacyIndex: legacy, lesson, lessons, shipGravity: unit === 2 ? 'all' : 'none',
    combat: freeForAll ? 'freeForAll' : 'squad', ...(freeForAll ? { scoreMode: 'kills' as const } : {}), ...(boss ? { boss: unit as 0 | 1 | 2 } : {}),
    player1Spawn: { x: 170, y: boss ? 555 : [555, 555, 590, 385, 580, 555, 555, 555, 555, 555, 555, 555][layout], angle: layout === 3 ? 0 : -0.35 },
    player2Spawn: { x: 1070, y: boss ? 185 : [185, 220, 190, 385, 200, 185, 185, 185, 185, 185, 185, 185][layout], angle: layout === 3 ? Math.PI : 2.8 },
    extraEnemySpawns, bodies,
    ...(wormholes ? { wormholes } : {}),
    powerUpSpawnPoints: (boss ? [[340, 610], [950, 350], [640, 600], [640, 175]] : pickupSites[legacy ?? 27 + layout - 9]).map(([x, y]) => ({ x, y })),
    powerUps: lessons ? [...lessons, ...powers.slice(0, stage * 2)] : powers,
    pickupStart: 0.8,
  };
});

function bossBodies(unit: number): CelestialBody[] {
  if (unit === 0) return [createBody('warden-world', 'planet', 650, 370, { radius: 53 }),
    ...[0, 1, 2].map(i => createBody('warden-moon-' + i, 'moon', 650, 370, { radius: 22, motion: { radius: 170, period: 34, phase: i * Math.PI * 2 / 3 } }))];
  if (unit === 1) return [createBody('dread-sun', 'star', 535, 370, { radius: 48, motion: { radius: 48, period: 40, phase: 0 } }),
    createBody('dread-neutron', 'pulsar', 810, 400, { radius: 23 }), createBody('dread-cover', 'planet', 680, 215, { radius: 32 })];
  return [createBody('sovereign-west', 'blackHole', 480, 340, { radius: 24 }),
    createBody('sovereign-east', 'blackHole', 820, 430, { radius: 24 }),
    createBody('sovereign-moon', 'moon', 650, 385, { radius: 23, motion: { radius: 105, period: 27, phase: 0.8 } })];
}
