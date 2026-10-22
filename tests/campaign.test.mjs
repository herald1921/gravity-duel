import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../.test-build/config.js';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { getMap } from '../.test-build/maps/maps.js';
import { bodyPosition, createBody } from '../.test-build/entities/CelestialBody.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { applyPickup, consumeShot } from '../.test-build/entities/PowerUp.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { Match } from '../.test-build/game/Match.js';
import { getShipAcceleration } from '../.test-build/physics/gravity.js';
import { difficultyFor } from '../.test-build/ai/Difficulty.js';
import { SpaceAI } from '../.test-build/ai/SpaceAI.js';
import { OpeningFireGate } from '../.test-build/game/OpeningFireGate.js';
import { Profile, SAVE_KEY } from '../.test-build/platform/Profile.js';
const idle = [IDLE_CONTROL, IDLE_CONTROL, IDLE_CONTROL, IDLE_CONTROL];
const fleet = () => new Match({ ...CAMPAIGN_MAPS[8], bodies: [], powerUps: [] }, 1);

test('27 campaign levels introduce mechanics in three ordered units', () => {
  assert.equal(CAMPAIGN_MAPS.length, 27);
  for (const [i, map] of CAMPAIGN_MAPS.entries()) {
    const unit = Math.floor(i / 9), stage = i % 9;
    assert.equal(getMap(map.id), map);
    assert.equal(map.shipGravity, unit === 2 ? 'all' : 'none');
    assert.equal(map.bodies.some(b => b.motion), stage >= 6);
    assert.equal(1 + map.extraEnemySpawns.length, stage < 7 ? 1 : stage === 7 ? 2 : 3);
    if (unit === 0) { assert.ok(map.bodies.every(b => ['planet', 'moon'].includes(b.type))); assert.equal(map.wormholes, undefined); }
    if (unit === 1) assert.ok(!map.bodies.some(b => b.type === 'blackHole'));
    if (unit === 2) assert.ok(map.bodies.some(b => b.type === 'blackHole'));
  }
  assert.equal(CAMPAIGN_MAPS[13].wormholes, undefined);
  assert.equal(CAMPAIGN_MAPS[14].wormholes.length, 2);
  assert.deepEqual(new Set(CAMPAIGN_MAPS.slice(0, 6).map(m => m.lesson)), new Set(['trajectory', 'shield', 'heavy', 'laser', 'homing', 'orbital']));
});

test('all campaign spawns stay clear of moving bodies and each lesson spawns its pickup first', () => {
  for (const map of CAMPAIGN_MAPS) {
    const spawns = [map.player1Spawn, map.player2Spawn, ...map.extraEnemySpawns];
    for (let t = 0; t <= 52; t += 0.5) for (const spawn of spawns) for (const body of map.bodies) {
      const p = bodyPosition(body, t);
      assert.ok(Math.hypot(spawn.x - p.x, spawn.y - p.y) > body.collisionRadius + C.SHIP_RADIUS + 15, map.id);
    }
    const m = new Match(map); m.phase = 'playing';
    assert.ok(m.isPickupSafe(map.powerUpSpawnPoints[0], 0), map.id);
    if (map.lesson) {
      for (let i = 0; i < 120; i++) m.step(idle);
      assert.equal(m.pickups[0]?.type, map.lesson, map.id);
      const touch = new Match({ ...map, player1Spawn: { x: 320, y: 460, angle: 0 } });
      assert.ok(touch.isPickupSafe(map.powerUpSpawnPoints[0]), 'touch ' + map.id);
    }
  }
});

test('guidance expires after 12 active seconds and coexists with shield and ammo', () => {
  const ship = new Ship(1, { x: 170, y: 555, angle: 0 });
  applyPickup(ship, 'laser'); applyPickup(ship, 'shield'); applyPickup(ship, 'trajectory');
  assert.equal(ship.aimAssistFor, 12); assert.equal(ship.specialShot, 'laser'); assert.equal(ship.shield, true);
  assert.equal(consumeShot(ship), 'laser'); assert.equal(ship.aimAssistFor, 12);
  for (let i = 0; i < 1441; i++) ship.update(C.PHYSICS_DT, IDLE_CONTROL, [], 0, 'none');
  assert.equal(ship.aimAssistFor, 0); applyPickup(ship, 'trajectory'); ship.reset({ x: 170, y: 555, angle: 0 });
  assert.equal(ship.aimAssistFor, 0);
});

test('ship gravity is off in units one/two and pulls toward every body type in unit three', () => {
  for (const type of ['planet', 'moon', 'star', 'pulsar', 'blackHole']) {
    const bodies = [createBody(type, type, 600, 350)], point = { x: 300, y: 350 };
    assert.deepEqual(getShipAcceleration(point, bodies, 0, 'none'), { x: 0, y: 0 });
    const force = getShipAcceleration(point, bodies, 0, 'all');
    assert.ok(force.x > 0 && force.x < C.SHIP_THRUST); assert.equal(force.y, 0);
    const ship = new Ship(1, { ...point, angle: 0 }); ship.update(C.PHYSICS_DT, IDLE_CONTROL, bodies, 0, 'all'); assert.ok(ship.vx > 0);
  }
});

test('a partial squad kill keeps combat running; full squad clears exactly one round', () => {
  const m = fleet(); m.phase = 'playing';
  m.resolveDeaths([{ victim: 2, cause: 'shot', highlight: 'PORTAL SHOT' }]);
  assert.equal(m.phase, 'playing'); assert.equal(m.scores[1], 0); assert.equal(m.ships[1].alive, false);
  assert.equal(m.fire(2), false); const before = m.ships[1].x;
  m.step([IDLE_CONTROL, { turn: 1, thrust: 1, fire: true }]); assert.equal(m.ships[1].x, before);
  m.resolveDeaths([{ victim: 3, cause: 'shot' }]); assert.equal(m.phase, 'playing');
  m.resolveDeaths([{ victim: 4, cause: 'shot' }]); assert.equal(m.winner, 1); assert.deepEqual(m.scores, { 1: 1, 2: 0 });
  assert.ok(m.scoringHighlights[1].has('PORTAL SHOT'));
  m.rematch(); assert.equal(m.ships.length, 4); assert.ok(m.ships.every(s => s.alive)); assert.equal(m.scoringHighlights[1].size, 0);
});

test('player death loses a wave; simultaneous final-enemy death draws; partial enemy death does not draw', () => {
  const a = fleet(); a.resolveDeaths([{ victim: 1, cause: 'shot' }, { victim: 2, cause: 'shot' }]);
  assert.equal(a.winner, 2); assert.equal(a.draw, false);
  const b = fleet(); b.resolveDeaths([{ victim: 2, cause: 'shot' }, { victim: 3, cause: 'shot' }]);
  b.resolveDeaths([{ victim: 1, cause: 'shot' }, { victim: 4, cause: 'shot' }]);
  assert.equal(b.draw, true); assert.deepEqual(b.scores, { 1: 0, 2: 0 }); assert.equal(b.phase, 'roundOver');
});

test('enemy cannon, homing and laser cannot attack teammates, but human shots can hit every enemy', () => {
  for (const kind of ['normal', 'homing', 'laser']) {
    const m = fleet(); m.phase = 'playing';
    Object.assign(m.ships[1], { x: 400, y: 300, angle: 0 }); Object.assign(m.ships[2], { x: 490, y: 300 });
    Object.assign(m.ships[0], { x: 800, y: 300 }); Object.assign(m.ships[3], { x: 1100, y: 600 });
    if (kind !== 'normal') m.ships[1].specialShot = kind;
    m.fire(2);
    for (let i = 0; i < 240 && m.phase === 'playing'; i++) m.step(idle);
    assert.equal(m.ships[2].alive, true, kind); assert.equal(m.winner, 2, kind);
  }
  for (const victim of [2, 3, 4]) {
    const m = fleet(); m.phase = 'playing'; const target = m.ships[victim - 1];
    m.bullets = [{ ...createProjectile(m.ships[0], 0), x: target.x, y: target.y, vx: 0, vy: 0, trail: [] }]; m.step(idle);
    assert.equal(target.alive, false); assert.equal(m.phase, 'playing');
  }
});

test('difficulty improves monotonically and advanced AI predicts movement, dodges and separates from allies', () => {
  for (let i = 1; i < 27; i++) for (const key of ['reaction', 'aimError', 'fireDelay', 'interval', 'windup']) assert.ok(difficultyFor(i)[key] < difficultyFor(i - 1)[key]);
  const self = new Ship(2, { x: 850, y: 300, angle: Math.PI }), target = new Ship(1, { x: 400, y: 300, angle: 0 }); target.vy = 100;
  let request;
  const advanced = new SpaceAI(() => 0.5, (r, done) => { request = r; done({ angle: Math.PI, distance: 0, trajectory: { points: [] } }); }, difficultyFor(26));
  const control = advanced.update(0.01, self, target, [], {}, [], [{ x: 700, y: 300, vx: 300, vy: 0, ownerId: 1 }], [self]);
  assert.ok(request.target.y > target.y); assert.equal(control.independentAim, true); assert.ok(Math.abs(control.move.y) > 0.5);
  const early = new SpaceAI(() => 0.5, (r, done) => { request = r; done({ angle: Math.PI, distance: 0, trajectory: { points: [] } }); }, difficultyFor(0));
  early.update(0.01, self, target, []); assert.equal(request.target.y, target.y);
  assert.equal(early.difficulty.seekPickups, false); assert.equal(early.difficulty.dodge, false);
  const nav = advanced.navigation(self, target, [], [], 0, [], [self, new Ship(3, { x: 850, y: 325, angle: 0 })]);
  assert.ok(Math.sin(nav.angle) < 0);
});

test('every campaign AI can fire with the actual difficulty fire gate and stays finite', () => {
  for (const map of CAMPAIGN_MAPS) {
    const m = new Match(map, 1), d = difficultyFor(map.campaignIndex), ai = new SpaceAI(() => 0.63, undefined, d), gate = new OpeningFireGate(null, d);
    m.phase = 'playing'; let shots = 0;
    for (let i = 0; i < 60 / C.PHYSICS_DT && m.phase === 'playing'; i++) {
      const s = m.ships[1];
      const c = ai.update(C.PHYSICS_DT, s, m.ships[0], map.bodies, { time: m.time, wormholes: map.wormholes }, m.pickups, m.bullets, m.ships.slice(1));
      c.fire = gate.step(C.PHYSICS_DT, c.fire, s.cooldown <= 1e-9 && !s.laserCharge);
      m.step([IDLE_CONTROL, c]); for (const e of m.drainEvents()) if (e.type === 'shot' || e.type === 'laser') shots++;
      assert.ok(m.ships.every(ship => Number.isFinite(ship.x) && Number.isFinite(ship.y)), map.id);
      if (shots >= 2) break;
    }
    assert.ok(shots > 0, map.id + ' never fires');
  }
});

test('new campaign preserves old save and carries settings across without unlocking unrelated levels', () => {
  const old = JSON.stringify({ version: 1, runIndex: 8, cleared: [0, 1, 8], tutorialDone: true, music: false, sfx: true, controls: 'classic', badges: ['portal'], paint: 'amber' });
  const values = new Map([['gravity-duel-playtest-v090', old]]), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const p = new Profile(() => storage); assert.deepEqual(p.data.cleared, []); assert.equal(p.data.runIndex, null);
  assert.equal(p.data.music, false); assert.equal(p.data.controls, 'classic'); assert.equal(p.data.paint, 'amber');
  p.clearArena(0); assert.equal(values.get('gravity-duel-playtest-v090'), old); assert.ok(values.has(SAVE_KEY));
  assert.deepEqual(new Profile(() => storage).data.cleared, [0]);
});

test('three active AI pilots run together with staggered volleys, portals and moving gravity', () => {
  for (const index of [8, 17, 26]) {
    const map = CAMPAIGN_MAPS[index], m = new Match(map, 3), d = difficultyFor(index);
    const ais = m.ships.slice(1).map((_, i) => new SpaceAI(() => 0.35 + i * 0.12, undefined, d));
    const gates = ais.map(() => new OpeningFireGate(null, d));
    m.phase = 'playing'; let volley = 0, shots = 0;
    for (let frame = 0; frame < 1800 && m.phase !== 'matchOver'; frame++) {
      volley = Math.max(0, volley - C.PHYSICS_DT);
      const controls = ais.map((ai, i) => {
        const s = m.ships[i + 1]; if (m.phase !== 'playing' || !s.alive) return IDLE_CONTROL;
        const c = ai.update(C.PHYSICS_DT, s, m.ships[0], map.bodies, { time: m.time, wormholes: map.wormholes }, m.pickups, m.bullets, m.ships.slice(1));
        c.fire = gates[i].step(C.PHYSICS_DT, c.fire && volley <= 0, s.cooldown <= 1e-9 && !s.laserCharge);
        if (c.fire) volley = 0.4; return c;
      });
      m.step([IDLE_CONTROL, ...controls]);
      for (const event of m.drainEvents()) {
        if (event.type === 'shot' || event.type === 'laser') shots++;
        if (event.type === 'respawn') { ais.forEach(a => a.reset()); gates.forEach(g => g.reset()); }
      }
      assert.ok(m.ships.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)));
      assert.ok(m.bullets.length <= m.ships.length * C.MAX_BULLETS_PER_SHIP);
    }
    assert.ok(shots > 0, map.id);
  }
});
