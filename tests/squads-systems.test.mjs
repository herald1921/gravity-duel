import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyPosition, bodyVelocity, bodyAt, inPulsarBeam, pulsarAngle } from '../.test-build/entities/CelestialBody.js';
import { binarySystem, solarFamily, tripleSystem } from '../.test-build/maps/systems.js';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { SquadCoordinator } from '../.test-build/ai/SquadCoordinator.js';
import { SpaceAI } from '../.test-build/ai/SpaceAI.js';
import { difficultyFor } from '../.test-build/ai/Difficulty.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { Match } from '../.test-build/game/Match.js';
import { OpeningFireGate } from '../.test-build/game/OpeningFireGate.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { simulateTrajectory, stepProjectile } from '../.test-build/physics/gravity.js';
import { PHYSICS_DT as dt } from '../.test-build/config.js';
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('binary stars, neutron companions and black holes share a fixed mass-balanced barycenter', () => {
  for (const types of [['star', 'star'], ['star', 'pulsar'], ['blackHole', 'blackHole']]) {
    const pair = binarySystem({ x: 640, y: 375 }, ...types, 230, 26, -1, [48, 25]);
    for (let t = 0; t < 80; t += 0.25) {
      const [a, b] = pair.map(body => bodyPosition(body, t));
      close(distance(a, b), 230);
      const [m, n] = pair.map(body => body.gravityStrength);
      close((m * a.x + n * b.x) / (m + n), 640); close((m * a.y + n * b.y) / (m + n), 375);
    }
    for (const body of pair) close(distance(bodyPosition(body, 0), bodyPosition(body, 26)), 0);
  }
});

test('moon follows the moving planet and its velocity includes the parent orbit', () => {
  const [sun, planet, moon] = solarFamily();
  for (let t = 0; t < 100; t += 0.3) {
    close(distance(bodyPosition(sun, t), bodyPosition(planet, t)), 155);
    close(distance(bodyPosition(planet, t), bodyPosition(moon, t)), 62);
    const before = bodyPosition(moon, t - 1e-4), after = bodyPosition(moon, t + 1e-4), velocity = bodyVelocity(moon, t);
    close((after.x - before.x) / 2e-4, velocity.x, 1e-5); close((after.y - before.y) / 2e-4, velocity.y, 1e-5);
    const snapshot = bodyAt(moon, t); assert.equal(snapshot.motion, undefined);
    assert.deepEqual(bodyPosition(snapshot, t + 1), bodyPosition(moon, t));
  }
});

test('hierarchical triple system preserves its total barycenter and never intersects', () => {
  const bodies = tripleSystem();
  for (let t = 0; t < 144; t += 0.2) {
    const p = bodies.map(b => bodyPosition(b, t));
    close(p.reduce((sum, b) => sum + b.x, 0) / 3, 640); close(p.reduce((sum, b) => sum + b.y, 0) / 3, 375);
    close(distance(p[0], p[1]), 122);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) assert.ok(distance(p[i], p[j]) > bodies[i].collisionRadius + bodies[j].collisionRadius + 15);
  }
});

test('all revised campaign systems keep bodies separated and inside the playable arena', () => {
  for (const map of CAMPAIGN_MAPS) for (let t = 0; t < 104; t += 0.25) {
    for (const [i, body] of map.bodies.entries()) {
      const p = bodyPosition(body, t);
      assert.ok(p.x - body.radius > 20 && p.x + body.radius < 1260 && p.y - body.radius > 100 && p.y + body.radius < 674, map.id);
      for (const other of map.bodies.slice(i + 1)) assert.ok(distance(p, bodyPosition(other, t)) > body.collisionRadius + other.collisionRadius + 8, map.id);
    }
  }
});

test('neutron star appears in introduction, static combination and moving companion levels; beams follow its orbit', () => {
  for (const index of [9, 12, 14]) assert.ok(CAMPAIGN_MAPS[index].bodies.some(b => b.type === 'pulsar'));
  const neutron = CAMPAIGN_MAPS[14].bodies.find(b => b.type === 'pulsar');
  assert.ok(neutron.motion);
  for (const t of [0, 3, 7, 11]) {
    const p = bodyPosition(neutron, t), a = pulsarAngle(neutron, t);
    const ship = new Ship(1, { x: p.x + 100 * Math.cos(a), y: p.y + 100 * Math.sin(a), angle: 0 });
    assert.ok(inPulsarBeam(ship, neutron, t)); ship.update(dt, IDLE_CONTROL, [neutron], t, 'none'); assert.ok(ship.jammedFor > 0);
    assert.equal(inPulsarBeam({ x: p.x - 150 * Math.sin(a), y: p.y + 150 * Math.cos(a), radius: 20 }, neutron, t), false);
  }
});

test('hierarchical and neutron-system predictions match live projectile motion after worker-style cloning', () => {
  for (const map of [CAMPAIGN_MAPS[13], CAMPAIGN_MAPS[14], CAMPAIGN_MAPS[15]]) {
    const ship = new Ship(1, map.player1Spawn), bullet = createProjectile(ship, -0.5, 'normal', 5.3);
    const prediction = simulateTrajectory(bullet, structuredClone(map.bodies), [], 2, 1, { time: 5.3 });
    const live = structuredClone(bullet); let event;
    for (let i = 0; i < Math.round(prediction.elapsed / dt); i++) { event = stepProjectile(live, map.bodies, [], { time: live.time }); if (event) break; }
    close(live.x, prediction.end.x); close(live.y, prediction.end.y);
  }
});

const ships = () => [new Ship(2, { x: 920, y: 250, angle: 2.8 }), new Ship(3, { x: 1000, y: 400, angle: Math.PI }), new Ship(4, { x: 950, y: 580, angle: -2.8 })];
const target = () => new Ship(1, { x: 350, y: 390, angle: 0 });
test('squad holds distinct roles and approach points, then reassigns when the pressure pilot dies', () => {
  const squad = new SquadCoordinator(26), team = ships(), player = target();
  squad.update(dt, team, player, [], 0, []);
  assert.deepEqual(new Set([...squad.orders.values()].map(o => o.role)), new Set(['PRESSURE', 'FLANK', 'INTERCEPT']));
  const points = [...squad.orders.values()].map(o => o.waypoint);
  for (let i = 0; i < points.length; i++) for (const p of points.slice(i + 1)) assert.ok(distance(points[i], p) >= 150);
  const pressure = team.find(s => squad.orders.get(s.id).role === 'PRESSURE');
  pressure.alive = false; squad.update(dt, team, player, [], 0.1, []);
  assert.equal(squad.orders.has(pressure.id), false); assert.equal(squad.orders.size, 2);
  assert.equal([...squad.orders.values()].filter(o => o.role === 'PRESSURE').length, 1);
  team.find(s => s.alive).alive = false; squad.update(dt, team, player, [], 0.2, []); assert.equal(squad.orders.size, 0);
});

test('pressure fire starts partner advancement and fire priority alternates instead of favoring the first array entry', () => {
  const squad = new SquadCoordinator(26), team = ships(), player = target(); squad.update(dt, team, player, [], 0, []);
  const pressure = team.find(s => squad.orders.get(s.id).role === 'PRESSURE');
  assert.ok([...squad.orders.values()].every(o => !o.advance));
  squad.recordShot(pressure.id, 1);
  assert.ok([...squad.orders.values()].filter(o => o.role !== 'PRESSURE').every(o => o.advance));
  assert.equal(squad.selectShooter(team.map(s => s.id), 1.2), null);
  const next = squad.selectShooter(team.map(s => s.id), 1.41); assert.notEqual(next, pressure.id);
  squad.recordShot(next, 1.41); assert.notEqual(squad.selectShooter(team.map(s => s.id), 1.82), next);
  squad.reset(); assert.equal(squad.orders.size, 0); assert.equal(squad.selectShooter([2], 0), 2);
});

test('cover orders change actual wing movement and pickup reservations prevent duplicate chasing', () => {
  const squad = new SquadCoordinator(26), team = ships(), player = target();
  const pickup = { id: 8, type: 'shield', x: 1010, y: 510, radius: 18, age: 0 };
  squad.update(dt, team, player, [], 0, [pickup]);
  assert.equal([...squad.orders.values()].filter(o => o.pickupId === 8).length, 1);
  const wing = team.find(s => squad.orders.get(s.id).role === 'FLANK'), order = squad.orders.get(wing.id);
  const ai = new SpaceAI(() => 0.5, () => {}, difficultyFor(26));
  const before = ai.update(dt, wing, player, [], {}, [], [], team, order); assert.equal(Math.hypot(before.move.x, before.move.y), 0);
  const pressure = team.find(s => squad.orders.get(s.id).role === 'PRESSURE'); squad.recordShot(pressure.id, 0.1);
  const after = ai.update(dt, wing, player, [], {}, [], [], team, order); assert.ok(Math.hypot(after.move.x, after.move.y) > 0.9);
  const position = { x: wing.x, y: wing.y }; for (let i = 0; i < 30; i++) wing.update(dt, after, [], 0, 'none');
  assert.ok(distance(wing, position) > 5);
});

test('coordinated squads actually fire and reposition in moving planetary, neutron and black-hole arenas', () => {
  for (const index of [5, 15, 28]) {
    const map = CAMPAIGN_MAPS[index], match = new Match(map, 3), squad = new SquadCoordinator(index), team = match.ships.slice(1), player = match.ships[0];
    const ais = team.map((_, i) => new SpaceAI(() => 0.4 + i * 0.11, undefined, difficultyFor(index)));
    const gates = team.map(() => new OpeningFireGate(null, difficultyFor(index)));
    match.phase = 'playing'; const fired = new Set(), roles = new Set(); let moved = false;
    for (let frame = 0; frame < 45 / dt && match.phase !== 'matchOver'; frame++) {
      squad.update(dt, team, player, map.bodies, match.time, match.pickups);
      for (const o of squad.orders.values()) roles.add(o.role);
      const controls = team.map((s, i) => match.phase === 'playing' && s.alive ? ais[i].update(dt, s, player, map.bodies, { time: match.time, wormholes: map.wormholes }, match.pickups, match.bullets, team, squad.orders.get(s.id)) : { ...IDLE_CONTROL });
      const ready = team.map(s => s.alive && s.cooldown <= 1e-9 && !s.laserCharge);
      squad.coordinateFire(dt, team, controls, gates, ready, match.time);
      match.step([IDLE_CONTROL, ...controls]);
      for (const event of match.drainEvents()) {
        if (event.type === 'shot' || event.type === 'laser') { fired.add(event.owner); squad.recordShot(event.owner, match.time); }
        if (event.type === 'respawn') { squad.reset(); ais.forEach(a => a.reset()); gates.forEach(g => g.reset()); }
      }
      moved ||= team.some(s => distance(s, s.id === 2 ? map.player2Spawn : map.extraEnemySpawns[s.id - 3]) > 100);
      assert.ok(team.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)));
      if (fired.size === team.length && moved) break;
    }
    assert.ok(roles.has('PRESSURE') && roles.has('FLANK'), map.id); assert.ok(moved, map.id);
    assert.ok(fired.size >= 2, map.id + ' squad did not share fire');
  }
});
