import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../.test-build/game/Match.js';
import { IDLE_CONTROL, Ship } from '../.test-build/entities/Ship.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { MAPS } from '../.test-build/maps/maps.js';
import { SpaceAI, findAimSolution } from '../.test-build/ai/SpaceAI.js';
import { simulateTrajectory } from '../.test-build/physics/gravity.js';
import { FIRST_TO_SCORE, FIRE_COOLDOWN, MAX_BULLETS_PER_SHIP, PHYSICS_DT, SHIP_RADIUS } from '../.test-build/config.js';

const idle = [IDLE_CONTROL, IDLE_CONTROL];
const start = (match) => { for (let n = 0; n < 500 && match.phase !== 'playing'; n++) match.step(idle); assert.equal(match.phase, 'playing'); };
const projectileAt = (ship, ownerId) => ({ x: ship.x, y: ship.y, vx: 0, vy: 0, radius: 3, age: 1, ownerId, trail: [] });
const seededRandom = (seed = 42) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('nine arenas have safe separated spawns and all five celestial types', () => {
  assert.equal(MAPS.length, 9); const types = new Set();
  for (const map of MAPS) {
    assert.ok(map.bodies.length >= 1 && map.bodies.length <= 3);
    assert.ok(Math.hypot(map.player1Spawn.x - map.player2Spawn.x, map.player1Spawn.y - map.player2Spawn.y) > 650);
    for (const body of map.bodies) {
      types.add(body.type);
      for (const spawn of [map.player1Spawn, map.player2Spawn]) assert.ok(Math.hypot(spawn.x - body.x, spawn.y - body.y) > body.collisionRadius + SHIP_RADIUS + 80);
    }
  }
  assert.equal(types.size, 5);
});

test('round countdown prevents firing and movement', () => {
  const match = new Match(MAPS[0]); const x = match.ships[0].x;
  assert.equal(match.fire(1), false);
  match.step([{ thrust: 1, turn: 1, fire: true }, IDLE_CONTROL]);
  assert.equal(match.ships[0].x, x); assert.equal(match.bullets.length, 0);
  start(match); assert.equal(match.fire(1), true);
});

test('P1 and P2 can move and fire in the same step', () => {
  const match = new Match(MAPS[0]); start(match);
  const before = match.ships.map(ship => ({ x: ship.x, y: ship.y }));
  match.step([{ thrust: 1, turn: -1, fire: true }, { thrust: 1, turn: 1, fire: true }]);
  assert.deepEqual(match.bullets.map(bullet => bullet.ownerId), [1, 2]);
  match.ships.forEach((ship, i) => assert.ok(Math.hypot(ship.x - before[i].x, ship.y - before[i].y) > 0));
});

test('fire cooldown is per ship and held fire respects its timing', () => {
  const match = new Match(MAPS[0]); start(match); match.drainEvents();
  let shots = 0;
  for (let i = 0; i < Math.round(3.2 / PHYSICS_DT); i++) {
    match.step([{ ...IDLE_CONTROL, fire: true }, IDLE_CONTROL]);
    shots += match.drainEvents().filter(event => event.type === 'shot').length;
  }
  assert.equal(shots, Math.floor(3.2 / FIRE_COOLDOWN) + 1);
  assert.equal(match.fire(2), true);
});

test('each side has an independent simultaneous bullet cap and dead ships cannot fire', () => {
  const match = new Match(MAPS[0]); start(match);
  for (let i = 0; i < MAX_BULLETS_PER_SHIP; i++) { match.ships[0].cooldown = 0; assert.equal(match.fire(1), true); }
  match.ships[0].cooldown = 0; assert.equal(match.fire(1), false); assert.equal(match.fire(2), true);
  match.ships[1].cooldown = 0; match.ships[1].alive = false; assert.equal(match.fire(2), false);
});

test('a real curved shot scores once, clears shots, and respawns both ships with score preserved', () => {
  const match = new Match(MAPS[0]); start(match); match.ships[0].angle = -59 * Math.PI / 180;
  match.fire(1);
  for (let i = 0; i < 400 && match.phase === 'playing'; i++) match.step(idle);
  assert.equal(match.phase, 'roundOver'); assert.deepEqual(match.scores, { 1: 1, 2: 0 });
  assert.equal(match.ships[1].alive, false); assert.equal(match.bullets.length, 0);
  start(match);
  assert.deepEqual(match.scores, { 1: 1, 2: 0 });
  match.ships.forEach((ship, i) => {
    const spawn = i === 0 ? match.map.player1Spawn : match.map.player2Spawn;
    assert.equal(ship.x, spawn.x); assert.equal(ship.y, spawn.y); assert.equal(ship.vx, 0); assert.equal(ship.alive, true);
  });
});

test('self-hits and lethal cores award the opponent a point', () => {
  const self = new Match(MAPS[0]); start(self); self.bullets.push(projectileAt(self.ships[0], 1)); self.step(idle);
  assert.equal(self.lastDeath.cause, 'self'); assert.deepEqual(self.scores, { 1: 0, 2: 1 });
  for (const map of [MAPS[2], MAPS[3]]) {
    const match = new Match(map); start(match); match.ships[1].x = map.bodies[0].x; match.ships[1].y = map.bodies[0].y;
    match.step(idle); assert.equal(match.lastDeath.cause, 'hazard'); assert.deepEqual(match.scores, { 1: 1, 2: 0 });
  }
});

test('simultaneous kills are a draw regardless of bullet array order', () => {
  for (const reverse of [false, true]) {
    const match = new Match(MAPS[0]); start(match);
    match.bullets = [projectileAt(match.ships[0], 2), projectileAt(match.ships[1], 1)];
    if (reverse) match.bullets.reverse(); match.step(idle);
    assert.equal(match.draw, true); assert.deepEqual(match.scores, { 1: 0, 2: 0 });
    assert.equal(match.phase, 'roundOver'); assert.ok(match.ships.every(ship => !ship.alive));
  }
});

test('duplicate hits in one step cannot award duplicate points', () => {
  const match = new Match(MAPS[0]); start(match);
  match.bullets = [projectileAt(match.ships[1], 1), projectileAt(match.ships[1], 1)]; match.step(idle);
  assert.deepEqual(match.scores, { 1: 1, 2: 0 });
});

test('five actual curved kills finish the match; rematch fully resets it', () => {
  const match = new Match(MAPS[0]);
  for (let kill = 0; kill < FIRST_TO_SCORE; kill++) {
    start(match); match.ships[0].angle = -59 * Math.PI / 180; assert.equal(match.fire(1), true);
    for (let step = 0; step < 400 && match.phase === 'playing'; step++) match.step(idle);
    assert.equal(match.scores[1], kill + 1);
  }
  assert.equal(match.phase, 'matchOver'); assert.equal(match.winner, 1);
  for (let i = 0; i < 300; i++) match.step([{ ...IDLE_CONTROL, fire: true }, IDLE_CONTROL]);
  assert.equal(match.scores[1], FIRST_TO_SCORE); assert.equal(match.bullets.length, 0);
  match.rematch(); assert.equal(match.winner, null); assert.equal(match.phase, 'ready');
  assert.deepEqual(match.scores, { 1: 0, 2: 0 }); assert.ok(match.ships.every(ship => ship.alive));
});

test('AI preserves gravity-assisted hits from either spawn on the four original maps', () => {
  for (const map of MAPS.slice(0, 4)) for (const reverse of [false, true]) {
    const ships = [new Ship(1, map.player1Spawn), new Ship(2, map.player2Spawn)]; if (reverse) ships.reverse();
    const [self, target] = ships; const solution = findAimSolution(self, target, map.bodies);
    const actual = simulateTrajectory(createProjectile(self, solution.angle), map.bodies, [self, target], 3, 3);
    assert.deepEqual(actual, solution.trajectory);
    assert.deepEqual(actual.event, { type: 'ship', shipId: target.id }, map.name);
    assert.notEqual(simulateTrajectory(createProjectile(self, solution.angle), map.bodies.map(body => ({ ...body, gravityStrength: 0 })), [self, target], 3).event?.type, 'ship', map.name);
  }
});

test('headless 1P smoke: AI moves, shoots and completes a match in the original arenas', () => {
  for (const map of MAPS.slice(0, 4)) {
    const match = new Match(map); const ai = new SpaceAI(seededRandom()); ai.reset();
    let shots = 0; let movement = 0;
    for (let n = 0; n < 180 / PHYSICS_DT && match.phase !== 'matchOver'; n++) {
      const self = match.ships[1]; const before = { x: self.x, y: self.y };
      const control = match.phase === 'playing' ? ai.update(PHYSICS_DT, self, match.ships[0], map.bodies) : IDLE_CONTROL;
      match.step([IDLE_CONTROL, control]);
      if (match.phase === 'playing') movement += Math.hypot(self.x - before.x, self.y - before.y);
      for (const event of match.drainEvents()) { if (event.type === 'respawn') ai.reset(); if (event.type === 'shot' && event.owner === 2) shots++; }
    }
    assert.ok(shots >= 5, map.name); assert.ok(movement > 100, map.name);
    assert.equal(match.winner, 2, map.name); assert.equal(match.scores[2], 5, map.name);
  }
});
