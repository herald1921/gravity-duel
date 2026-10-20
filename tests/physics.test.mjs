import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBody } from '../.test-build/entities/CelestialBody.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { FixedClock } from '../.test-build/physics/FixedClock.js';
import { getGravityAcceleration, integrateProjectile, segmentCircleContact, simulateTrajectory, stepProjectile } from '../.test-build/physics/gravity.js';
import { MAPS } from '../.test-build/maps/maps.js';
import { ARENA_BOUNDS, BULLET_LIFETIME, BULLET_SPEED, BULLET_VELOCITY_INHERITANCE, MAX_GRAVITY_ACCELERATION, MAX_PROJECTILE_SPEED, MUZZLE_OFFSET, OWNER_GRACE_TIME, PHYSICS_DT, SHIP_MAX_SPEED, SHIP_ROTATION_SPEED } from '../.test-build/config.js';

const close = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const planet = MAPS[0].bodies[0];
const stationary = (overrides = {}) => ({ x: 100, y: 200, vx: 0, vy: 0, radius: 3, age: 0, ownerId: 1, ...overrides });
const fixtures = JSON.parse(readFileSync(new URL('./v01-regression.json', import.meta.url)));

test('four captured V0.1 trajectories are preserved after generalizing to multiple bodies', () => {
  for (const fixture of fixtures) {
    const ship = new Ship(1, MAPS[0].player1Spawn);
    const actual = simulateTrajectory(createProjectile(ship, fixture.angle * Math.PI / 180), [planet], [{ id: 2, x: 900, y: 200, radius: 26 }], 3, 7);
    assert.equal(actual.points.length, fixture.points.length);
    actual.points.forEach((point, i) => { close(point.x, fixture.points[i].x); close(point.y, fixture.points[i].y); });
    for (const field of ['x', 'y', 'vx', 'vy', 'age']) close(actual.end[field], fixture.end[field]);
    close(actual.elapsed, fixture.elapsed);
    assert.equal(actual.event?.type ?? null, fixture.event === 'planet' ? 'body' : fixture.event === 'enemy' ? 'ship' : fixture.event);
  }
});

test('multi-body gravity is the vector sum, including a symmetric cancellation', () => {
  const point = { x: 600, y: 400 };
  const left = createBody('left', 'moon', 400, 350);
  const right = createBody('right', 'moon', 800, 450);
  const a = getGravityAcceleration(point, [left]); const b = getGravityAcceleration(point, [right]);
  const both = getGravityAcceleration(point, [left, right]);
  close(both.x, a.x + b.x); close(both.y, a.y + b.y); close(both.x, 0); close(both.y, 0);
});

test('gravity points inward, stays finite at a center, and clamps extreme parameters', () => {
  const a = getGravityAcceleration({ x: planet.x + 100, y: planet.y }, [planet]);
  assert.ok(a.x < 0); close(a.y, 0);
  close(a.x, -planet.gravityStrength * 100 / (100 ** 2 + planet.softening ** 2) ** 1.5);
  assert.deepEqual(getGravityAcceleration(planet, [planet]), { x: 0, y: 0 });
  const extreme = createBody('extreme', 'blackHole', 0, 0, { gravityStrength: 1e20, softening: 0 });
  const acceleration = getGravityAcceleration({ x: 0.001, y: 0.001 }, [extreme]);
  close(Math.hypot(acceleration.x, acceleration.y), MAX_GRAVITY_ACCELERATION);
  const bullet = stationary({ x: 0, y: 0, vx: 1e6 });
  integrateProjectile(bullet, [extreme], PHYSICS_DT);
  assert.ok(Object.values(bullet).every(Number.isFinite));
  close(Math.hypot(bullet.vx, bullet.vy), MAX_PROJECTILE_SPEED);
});

test('semi-implicit Euler updates velocity before position', () => {
  const state = stationary({ x: 10, y: 0, vx: 2 });
  const body = createBody('test', 'moon', 0, 0, { gravityStrength: 1000, softening: 1 });
  const ax = -10000 / 101 ** 1.5;
  integrateProjectile(state, [body], 0.1);
  close(state.vx, 2 + ax * 0.1); close(state.x, 10 + (2 + ax * 0.1) * 0.1); close(state.age, 0.1);
});

test('launch and preview inherit exactly one quarter of ship velocity', () => {
  const ship = new Ship(1, { x: 260, y: 610, angle: -Math.PI / 3 }); ship.vx = 120; ship.vy = -60;
  const shot = createProjectile(ship);
  close(Math.hypot(shot.x - ship.x, shot.y - ship.y), MUZZLE_OFFSET);
  close(shot.vx, Math.cos(ship.angle) * BULLET_SPEED + ship.vx * BULLET_VELOCITY_INHERITANCE);
  close(shot.vy, Math.sin(ship.angle) * BULLET_SPEED + ship.vy * BULLET_VELOCITY_INHERITANCE);
  const before = { ...shot }; simulateTrajectory(shot, [planet]); assert.deepEqual(shot, before);
});

test('swept collision catches crossed circles and resolves the first body in the path', () => {
  close(segmentCircleContact({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0, radius: 10 }), 0.45);
  assert.equal(segmentCircleContact({ x: -100, y: 11 }, { x: 100, y: 11 }, { x: 0, y: 0, radius: 10 }), null);
  const state = stationary({ x: 0, y: 0, vx: 1500, radius: 0 });
  const body = createBody('blocker', 'moon', 8, 0, { radius: 1, gravityStrength: 0 });
  assert.deepEqual(stepProjectile(state, [body], [{ id: 2, x: 12, y: 0, radius: 1 }]), { type: 'body', bodyId: 'blocker' });
  close(state.x, 7);
});

test('relative swept collision detects a moving ship crossing a stationary projectile', () => {
  const event = stepProjectile(stationary(), [], [{ id: 2, x: 150, y: 200, previous: { x: 50, y: 200 }, radius: 5 }]);
  assert.deepEqual(event, { type: 'ship', shipId: 2 });
});

test('owner grace ends at 0.2 seconds; opponents never receive that grace', () => {
  const owner = { id: 1, x: 100, y: 200, radius: 20 };
  assert.equal(stepProjectile(stationary(), [], [owner]), null);
  assert.deepEqual(stepProjectile(stationary({ age: OWNER_GRACE_TIME }), [], [owner]), { type: 'ship', shipId: 1 });
  assert.deepEqual(stepProjectile(stationary(), [], [{ ...owner, id: 2 }]), { type: 'ship', shipId: 2 });
});

test('direct aim is blocked but both V0.1 gravitational bypasses still hit', () => {
  const ship = new Ship(1, MAPS[0].player1Spawn); const target = new Ship(2, MAPS[0].player2Spawn);
  const direct = Math.atan2(target.y - ship.y, target.x - ship.x);
  assert.equal(simulateTrajectory(createProjectile(ship, direct), [planet], [target], 3).event?.type, 'body');
  for (const degrees of [-59, -5]) {
    const result = simulateTrajectory(createProjectile(ship, degrees * Math.PI / 180), [planet], [target], 3);
    assert.equal(result.event?.type, 'ship'); assert.ok(result.elapsed < 3);
    assert.notEqual(simulateTrajectory(createProjectile(ship, degrees * Math.PI / 180), [{ ...planet, gravityStrength: 0 }], [target], 3).event?.type, 'ship');
  }
});

test('Twin Moons supports an S-curve with both signs of curvature', () => {
  const map = MAPS[1]; const ship = new Ship(1, map.player1Spawn);
  const points = simulateTrajectory(createProjectile(ship, -3 * Math.PI / 180), map.bodies, [], 2.3, 3).points;
  const cross = [];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    cross.push((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  }
  assert.ok(cross.some(n => n < -0.1)); assert.ok(cross.some(n => n > 0.1));
});

test('live and predicted positions match at 30/60/144 FPS and irregular frames on all maps', () => {
  for (const map of MAPS) for (const frames of [[1 / 30], [1 / 60], [1 / 144], [0.008, 0.044, 0.012, 0.1, 0.005]]) {
    const ship = new Ship(1, map.player1Spawn); ship.vx = 45; ship.vy = -30;
    const initial = createProjectile(ship, -Math.PI / 3);
    const prediction = simulateTrajectory(initial, map.bodies, [], 3, 1);
    const live = { ...initial }; const clock = new FixedClock(); let step = 0; let event = null;
    for (let frame = 0; frame < 1000 && step < prediction.points.length - 1; frame++) {
      clock.advance(frames[frame % frames.length], () => {
        if (event || step >= prediction.points.length - 1) return;
        event = stepProjectile(live, map.bodies); step++;
        assert.deepEqual({ x: live.x, y: live.y }, prediction.points[step]);
      });
    }
    assert.deepEqual(live, prediction.end); assert.deepEqual(event, prediction.event);
  }
});

test('long stalls clamp catch-up to 12 fixed steps; reset discards remainder', () => {
  const clock = new FixedClock(); let steps = 0;
  clock.advance(5, () => steps++); assert.equal(steps, 12);
  clock.advance(PHYSICS_DT / 2, () => steps++); clock.reset(); clock.advance(PHYSICS_DT / 2, () => steps++);
  assert.equal(steps, 12);
});

test('lifetime and distant bounds terminate shots; zero-length previews are disabled', () => {
  const result = simulateTrajectory(stationary(), [], [], 12);
  assert.equal(result.event.type, 'expired'); close(result.elapsed, BULLET_LIFETIME);
  assert.equal(stepProjectile(stationary({ x: 1441 }), []).type, 'bounds');
  assert.equal(simulateTrajectory(stationary(), [], [], 0).elapsed, 0);
});

test('ships rotate at a limited rate, have inertia, brake/reverse, and ignore gravity', () => {
  const ship = new Ship(1, MAPS[0].player1Spawn); const before = { x: ship.x, y: ship.y, angle: ship.angle };
  ship.update(PHYSICS_DT, { ...IDLE_CONTROL, turn: 1 }, [planet]);
  close(ship.angle - before.angle, SHIP_ROTATION_SPEED * PHYSICS_DT); close(ship.x, before.x); close(ship.y, before.y);
  ship.angle = 0;
  for (let i = 0; i < 120; i++) ship.update(PHYSICS_DT, { ...IDLE_CONTROL, thrust: 1 }, []);
  assert.ok(ship.vx > 100 && ship.vx <= SHIP_MAX_SPEED);
  const v = ship.vx; ship.update(PHYSICS_DT, IDLE_CONTROL, []); assert.ok(ship.vx > 0 && ship.vx < v);
  for (let i = 0; i < 300; i++) ship.update(PHYSICS_DT, { ...IDLE_CONTROL, thrust: -1 }, []);
  assert.ok(ship.vx < 0);
});

test('solid bodies stop ships; stars and black holes report lethal entry', () => {
  const ship = new Ship(1, { x: planet.x - planet.radius - 22, y: planet.y, angle: 0 });
  for (let i = 0; i < 300; i++) ship.update(PHYSICS_DT, { ...IDLE_CONTROL, thrust: 1 }, [planet]);
  close(Math.hypot(ship.x - planet.x, ship.y - planet.y), planet.collisionRadius + ship.radius); close(ship.vx, 0);
  for (const type of ['star', 'blackHole']) {
    const body = createBody(type, type, 600, 400);
    const inside = new Ship(1, { x: body.x, y: body.y, angle: 0 });
    assert.equal(inside.update(PHYSICS_DT, IDLE_CONTROL, [body]), type);
  }
});

test('ships stay inside visible arena boundaries with speed capped', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const ship = new Ship(1, { x: 600, y: 400, angle });
    for (let i = 0; i < 1400; i++) {
      ship.update(PHYSICS_DT, { ...IDLE_CONTROL, thrust: 1 }, []);
      assert.ok(Math.hypot(ship.vx, ship.vy) <= SHIP_MAX_SPEED + 1e-9);
      assert.ok(ship.x >= ARENA_BOUNDS.left + ship.radius && ship.x <= ARENA_BOUNDS.right - ship.radius);
      assert.ok(ship.y >= ARENA_BOUNDS.top + ship.radius && ship.y <= ARENA_BOUNDS.bottom - ship.radius);
    }
  }
});
