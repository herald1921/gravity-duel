import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../.test-build/config.js';
import { createBody, bodyPosition, bodyVelocity, inPulsarBeam } from '../.test-build/entities/CelestialBody.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { portalPair, teleportProjectile } from '../.test-build/entities/Wormhole.js';
import { applyPickup, consumeShot, blockAttack } from '../.test-build/entities/PowerUp.js';
import { captureOrbit, getGravityAcceleration, getShipAcceleration, orbitSpeed, simulateTrajectory, stepProjectile } from '../.test-build/physics/gravity.js';
import { traceLaser } from '../.test-build/physics/laser.js';
import { Match } from '../.test-build/game/Match.js';
import { ARCADE, nextArena } from '../.test-build/game/Arcade.js';
import { MAPS } from '../.test-build/maps/maps.js';
import { findAimSolution, SpaceAI } from '../.test-build/ai/SpaceAI.js';
import { PauseState, PokiLifecycle } from '../.test-build/platform/Lifecycle.js';
import { TouchState } from '../.test-build/input/TouchState.js';
const close = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps, a + ' != ' + b);
const idle = [IDLE_CONTROL, IDLE_CONTROL];
const shot = (overrides = {}) => ({ x: 100, y: 300, vx: 360, vy: 0, age: 1, radius: 3, ownerId: 1, kind: 'normal', ...overrides });
const emptyMap = { ...MAPS[0], bodies: [], player1Spawn: { x: 130, y: 300, angle: 0 }, player2Spawn: { x: 950, y: 300, angle: Math.PI } };
const start = (match) => { for (let i = 0; i < 150; i++) match.step(idle); assert.equal(match.phase, 'playing'); };
const planet = createBody('planet', 'planet', 640, 375);
test('wormhole rotates velocity and preserves identity, owner, kind, age and arbitrary state', () => {
  const [a, b] = portalPair([100, 300, 0], [800, 300, -Math.PI / 2]);
  const state = shot({ kind: 'orbital', ownerId: 2, customMarker: 'same object', age: 4 });
  const identity = state; teleportProjectile(state, a, b);
  assert.equal(state, identity); close(state.vx, 0); close(state.vy, -360);
  assert.equal(state.age, 4); assert.equal(state.ownerId, 2); assert.equal(state.kind, 'orbital'); assert.equal(state.customMarker, 'same object');
  close(Math.hypot(state.x - b.x, state.y - b.y), b.radius + state.radius + 2);
});
test('portal cooldown suppresses immediate reentry and eventually permits another traversal', () => {
  const gates = portalPair([100, 300, 0], [800, 300, 0]);
  const state = shot({ vx: 0 });
  stepProjectile(state, [], [], { wormholes: gates }); assert.ok(state.teleport);
  state.x = 800; state.y = 300;
  stepProjectile(state, [], [], { wormholes: gates }); assert.equal(state.teleport, undefined);
  let traversed = false;
  for (let i = 0; i < 40; i++) { stepProjectile(state, [], [], { wormholes: gates }); if (state.teleport) traversed = true; }
  assert.ok(traversed);
});
test('wormhole preview continues beyond exit, marks the gap, and exactly matches live steps', () => {
  const gates = portalPair([200, 300, 0], [800, 300, -Math.PI / 2]);
  const initial = shot({ age: 0 }), state = structuredClone(initial);
  const predicted = simulateTrajectory(initial, [], [], 1, 1, { wormholes: gates });
  assert.ok(predicted.points.some(p => p.breakBefore)); assert.ok(predicted.end.y < 200);
  for (let i = 0; i < predicted.elapsed / C.PHYSICS_DT - 1e-6; i++) stepProjectile(state, [], [], { wormholes: gates });
  assert.deepEqual(state, predicted.end); assert.equal(initial.x, 100);
});
test('moving moon motion is analytical and periodic, with no mutation or drift', () => {
  const moon = MAPS[7].bodies[1], before = structuredClone(moon);
  const a = bodyPosition(moon, 1.25), b = bodyPosition(moon, 1.25 + C.MOVING_MOON_ORBIT_PERIOD * 1000);
  close(a.x, b.x); close(a.y, b.y); assert.deepEqual(moon, before);
  assert.notDeepEqual(bodyPosition(moon, 0), bodyPosition(moon, 6));
});
test('moving body future gravity and collision agree between prediction and live simulation', () => {
  const map = MAPS[7], t = 7.3, initial = createProjectile(new Ship(1, map.player1Spawn), -0.4, 'normal', t);
  const result = simulateTrajectory(initial, map.bodies, [], 3, 1, { time: t }), state = structuredClone(initial);
  for (let i = 0; i < Math.round(result.elapsed / C.PHYSICS_DT); i++) stepProjectile(state, map.bodies);
  assert.deepEqual(state, result.end);
  assert.notDeepEqual(getGravityAcceleration(initial, map.bodies, t), getGravityAcceleration(initial, map.bodies, t + 6));
});
test('black hole alone pulls ships and its maximum pull leaves a thrust escape margin', () => {
  const hole = createBody('hole', 'blackHole', 640, 375), p = { x: 770, y: 375 };
  const ship = getShipAcceleration(p, [hole]), projectile = getGravityAcceleration(p, [hole]);
  assert.ok(ship.x < 0); close(ship.y, 0); close(ship.x / projectile.x, C.BLACK_HOLE_SHIP_GRAVITY_MULTIPLIER);
  assert.deepEqual(getShipAcceleration(p, [planet]), { x: 0, y: 0 });
  const s = new Ship(1, { ...p, angle: 0 });
  for (let i = 0; i < 240; i++) assert.equal(s.update(C.PHYSICS_DT, { ...IDLE_CONTROL, thrust: 1 }, [hole], i * C.PHYSICS_DT), null);
  assert.ok(s.x - hole.x > 2 * (p.x - hole.x));
  const idleShip = new Ship(1, { ...p, angle: 0 }); idleShip.update(0.2, IDLE_CONTROL, [hole]); assert.ok(idleShip.x < p.x);
  assert.ok(C.MAX_SHIP_GRAVITY_ACCELERATION < C.SHIP_THRUST);
});
test('pulsar beams rotate predictably, reduce thrust/turn, and recover quickly', () => {
  const body = createBody('pulse', 'pulsar', 640, 375);
  const s = new Ship(1, { x: 880, y: 375, angle: 0 }), normal = new Ship(1, { x: 880, y: 375, angle: 0 });
  assert.equal(inPulsarBeam(s, body, 0), true); assert.equal(inPulsarBeam(s, body, 3), false);
  const control = { turn: 1, thrust: 1, fire: false };
  s.update(C.PHYSICS_DT, control, [body], 0); normal.update(C.PHYSICS_DT, control, [], 0);
  close(s.angle / normal.angle, C.PULSAR_TURN_MULTIPLIER);
  close(Math.hypot(s.vx, s.vy) / Math.hypot(normal.vx, normal.vy), C.PULSAR_THRUST_MULTIPLIER);
  s.y = 600; for (let i = 0; i < Math.ceil(C.PULSAR_RECOVERY_TIME / C.PHYSICS_DT) + 1; i++) s.update(C.PHYSICS_DT, IDLE_CONTROL, [body], 0);
  assert.equal(s.jammedFor, 0);
});
test('pickup loadout replaces the special slot while shield is independent and one-use', () => {
  const loadout = { shield: false, specialShot: null };
  applyPickup(loadout, 'orbital'); applyPickup(loadout, 'shield'); applyPickup(loadout, 'laser');
  assert.equal(loadout.specialShot, 'laser'); assert.equal(consumeShot(loadout), 'laser'); assert.equal(consumeShot(loadout), 'normal');
  assert.equal(blockAttack(loadout), true); assert.equal(blockAttack(loadout), false);
});
test('all projectile weapons consume one shield instead of killing; the next hit kills', () => {
  for (const kind of ['normal', 'orbital', 'heavy']) {
    const match = new Match(emptyMap); start(match); const target = match.ships[1]; target.shield = true;
    const attack = () => { match.bullets.push(shot({ x: target.x, y: target.y, vx: 0, kind, trail: [] })); match.step(idle); };
    attack(); assert.equal(target.alive, true, kind); assert.equal(target.shield, false); assert.equal(match.bullets.length, 0);
    assert.ok(match.drainEvents().some(e => e.sound === 'shieldBreak')); attack(); assert.equal(target.alive, false);
  }
});
test('shield never prevents star or event-horizon death', () => {
  for (const type of ['star', 'blackHole', 'pulsar']) {
    const body = createBody('hazard', type, 640, 375), match = new Match({ ...emptyMap, bodies: [body] }); start(match);
    const s = match.ships[0]; s.x = body.x; s.y = body.y; s.shield = true; match.step(idle);
    assert.equal(s.alive, false); assert.equal(match.lastDeath.cause, 'hazard');
  }
});
test('laser charges once, consumes the slot, stays straight and kills on a clear ray', () => {
  const match = new Match(emptyMap); start(match); match.ships[0].specialShot = 'laser';
  assert.ok(match.fire(1)); assert.equal(match.ships[0].specialShot, null); assert.equal(match.bullets.length, 0);
  assert.ok(match.ships[0].laserCharge); assert.equal(match.fire(1), false);
  for (let i = 0; i < 30; i++) match.step(idle); assert.equal(match.ships[1].alive, true);
  for (let i = 0; i < 20; i++) match.step(idle);
  assert.equal(match.ships[1].alive, false); assert.equal(match.ships[0].laserCharge, null);
});
test('celestial bodies block lasers; gravity and portals do not bend them; shield absorbs them', () => {
  const ship = new Ship(1, emptyMap.player1Spawn), target = new Ship(2, emptyMap.player2Spawn);
  const body = createBody('block', 'moon', 640, 300);
  assert.equal(traceLaser(ship, [body], [target], 0).event.type, 'body');
  assert.equal(traceLaser(ship, [{ ...body, y: 500 }], [target], 0).event.type, 'ship');
  const match = new Match({ ...emptyMap, wormholes: portalPair([300, 300, 0], [500, 500, 1]) }); start(match);
  match.ships[1].shield = true; match.ships[0].specialShot = 'laser'; match.fire(1);
  for (let i = 0; i < 50; i++) match.step(idle);
  assert.equal(match.ships[1].shield, false); assert.equal(match.ships[1].alive, true);
});
test('capture is guaranteed for every tested incoming angle and speed, with no tangent prerequisite', () => {
  for (const angle of [0, 0.3, 1.7, Math.PI, 5.2]) for (const speed of [1, 90, 360, 1500]) {
    const state = shot({ x: planet.x + 148, y: planet.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, kind: 'orbital' });
    assert.equal(stepProjectile(state, [planet]), null); assert.equal(state.orbitState.bodyId, planet.id);
    close(Math.hypot(state.x - planet.x, state.y - planet.y), state.orbitState.radius);
  }
});
test('swept capture catches a fast entry; normal shots never acquire scripted orbit state', () => {
  const state = shot({ x: planet.x + planet.orbitCaptureRadius + 2, y: planet.y, vx: -1500, kind: 'orbital' });
  stepProjectile(state, [planet]); assert.ok(state.orbitState);
  const normal = shot({ x: planet.x + 148, y: planet.y, vx: -200 }); stepProjectile(normal, [planet]); assert.equal(normal.orbitState, undefined);
  for (const type of ['star', 'blackHole', 'pulsar']) {
    const other = createBody(type, type, 640, 375, { orbitCaptureRadius: 200 });
    const s = shot({ x: 790, y: 375, kind: 'orbital' }); stepProjectile(s, [other]); assert.equal(s.orbitState, undefined);
  }
});
test('Cartesian angular momentum sets CCW/CW deterministically, including radial fallback', () => {
  const up = shot({ x: 780, y: 375, vx: 0, vy: -100, kind: 'orbital' });
  const down = { ...up, vy: 100 }, radial = { ...up, vx: -300, vy: 0 };
  captureOrbit(up, planet, 0); captureOrbit(down, planet, 0); captureOrbit(radial, planet, 0);
  assert.equal(up.orbitState.direction, 1); assert.equal(down.orbitState.direction, -1); assert.equal(radial.orbitState.direction, -1);
  const again = shot({ x: 780, y: 375, vx: -300, vy: 0, kind: 'orbital' }); captureOrbit(again, planet, 0); assert.deepEqual(radial.orbitState, again.orbitState);
});
test('capture corrects unsafe velocity while retaining a safe noncircular orbit', () => {
  const state = shot({ x: 780, y: 390, vx: -1500, vy: 200, kind: 'orbital' });
  const before = structuredClone(state); captureOrbit(state, planet, 0);
  close(state.x,before.x);close(state.y,before.y);
  assert.ok(state.orbitState.eccentricity > 0.1);
  assert.ok(state.orbitState.periapsis >= planet.collisionRadius + state.radius + C.ORBIT_MIN_CLEARANCE - 1e-7);
  assert.ok(state.orbitState.apoapsis <= planet.orbitCaptureRadius * C.ORBIT_MAX_APOAPSIS_MULTIPLIER + 1e-7);
});
test('a legal circular orbit remains circular for thousands of steps despite another gravity source', () => {
  const state = shot({ x: 785, y: 375, vy: -300, kind: 'orbital', age: 0 }), perturb = createBody('external', 'star', 1100, 600);
  state.vx = 0; state.vy = -orbitSpeed(planet, Math.hypot(state.x-planet.x,state.y-planet.y));
  captureOrbit(state, planet, 0); const radius = state.orbitState.radius;
  for (let i = 0; i < 2600; i++) { assert.equal(stepProjectile(state, [planet, perturb]), null); close(Math.hypot(state.x - planet.x, state.y - planet.y), radius); }
});
test('a captured ellipse follows a moving moon and conserves local Kepler energy', () => {
  const moon = MAPS[7].bodies[1], p = bodyPosition(moon, 4);
  const state = shot({ x: p.x + 65, y: p.y, kind: 'orbital', time: 4, age: 0 }); captureOrbit(state, moon, 4);
  for (let i = 0; i < 1800; i++) {
    assert.equal(stepProjectile(state, [moon]), null);
    const center = bodyPosition(moon, state.time), velocity = bodyVelocity(moon, state.time);
    close(Math.hypot(state.x - center.x, state.y - center.y), state.orbitState.radius);
    const o = state.orbitState, speed2 = (state.vx - velocity.x) ** 2 + (state.vy - velocity.y) ** 2;
    close(speed2 / 2 - o.gravitationalParameter / o.radius, -o.gravitationalParameter / (2 * o.semiMajorAxis), 1e-6);
  }
});
test('free orbital shot can teleport then capture; captured shots detach at the next portal', () => {
  const gates = portalPair([100, 300, 0], [500, 300, 0]), moon = createBody('host', 'moon', 600, 300, { radius: 30 });
  const state = shot({ kind: 'orbital' }); stepProjectile(state, [moon], [], { wormholes: gates });
  assert.ok(state.teleport); assert.equal(state.orbitState.bodyId, 'host'); assert.equal(state.kind, 'orbital');
  const lockedGates = portalPair([state.x, state.y, 0], [1000, 300, 1]); state.portalCooldown = 0;
  stepProjectile(state, [moon], [], { wormholes: lockedGates }); assert.ok(state.teleport); assert.equal(state.orbitState, undefined); assert.equal(state.kind, 'orbital');
});
test('event horizon swallows a locked projectile without taking over its orbit', () => {
  const state = shot({ x: 785, y: 375, kind: 'orbital' }); captureOrbit(state, planet, 0);
  const hole = createBody('hole', 'blackHole', state.x, state.y);
  assert.deepEqual(stepProjectile(state, [planet, hole]), { type: 'body', bodyId: 'hole' });
});
test('orbital lifetime expires at 48 seconds even in a perfectly stable orbit', () => {
  const state = shot({ x: 785, y: 375, age: 0, kind: 'orbital' }); captureOrbit(state, planet, 0);
  assert.equal(C.ORBITAL_BULLET_LIFETIME, 48);
  for (let i = 0; i < C.ORBITAL_BULLET_LIFETIME / C.PHYSICS_DT - 1; i++) assert.equal(stepProjectile(state, [planet]), null);
  assert.equal(stepProjectile(state, [planet]).type, 'expired'); close(state.age, C.ORBITAL_BULLET_LIFETIME);
});
test('per-player orbital cap replaces the old shot without affecting the other player or cannon rounds', () => {
  const match = new Match(emptyMap); start(match);
  for (const s of match.ships) { s.specialShot = 'orbital'; match.fire(s.id); }
  const old = match.bullets[0], other = match.bullets[1];
  match.ships[0].cooldown = 0; match.fire(1); const normal = match.bullets[2];
  match.ships[0].cooldown = 0; match.ships[0].specialShot = 'orbital'; match.fire(1);
  assert.equal(match.bullets.includes(old), false); assert.ok(match.bullets.includes(other)); assert.ok(match.bullets.includes(normal));
  assert.equal(match.bullets.filter(b => b.ownerId === 1 && b.kind === 'orbital').length, 1);
});
test('orbital rounds can hit their owner after the common grace period', () => {
  const state = shot({ x: 785, y: 375, kind: 'orbital', age: 1 }); captureOrbit(state, planet, 0);
  assert.deepEqual(stepProjectile(state, [planet], [{ id: 1, x: state.x, y: state.y, radius: 20 }]), { type: 'ship', shipId: 1 });
});
test('preview limits the captured arc and never mutates the live orbit state', () => {
  const state = shot({ x: 785, y: 375, kind: 'orbital', age: 0 }); captureOrbit(state, planet, 0);
  const before = structuredClone(state);
  const trajectory = simulateTrajectory(state, [planet], [], 20, 3, { maxOrbitArc: C.ORBIT_PREVIEW_ARC });
  assert.ok(trajectory.end.orbitState.sweptAngle >= C.ORBIT_PREVIEW_ARC);
  assert.ok(trajectory.end.orbitState.sweptAngle <= C.ORBIT_PREVIEW_ARC + 0.03); assert.deepEqual(state, before);
});
test('AI candidates use the same portal, future body and orbital simulation', () => {
  for (const index of [5, 6, 7, 8]) for (const kind of ['normal', 'orbital']) {
    const map = MAPS[index], self = new Ship(2, map.player2Spawn), target = new Ship(1, map.player1Spawn);
    const context = { time: 4.5, wormholes: map.wormholes };
    const result = findAimSolution(self, target, map.bodies, context, kind);
    const prediction = simulateTrajectory(createProjectile(self, result.angle, kind), map.bodies, [self, target], C.AI_SEARCH_SECONDS, 3, context);
    assert.deepEqual(result.trajectory, prediction); assert.ok(Number.isFinite(result.angle));
  }
});
test('AI laser checks line of sight rather than firing through a body', () => {
  const self = new Ship(2, emptyMap.player2Spawn), target = new Ship(1, emptyMap.player1Spawn);
  assert.equal(findAimSolution(self, target, [createBody('block', 'planet', 640, 300)], {}, 'laser').distance, Infinity);
  assert.equal(findAimSolution(self, target, [], {}, 'laser').distance, 0);
});
test('pickup cadence/cap and round cleanup remain bounded; orbital lab introduces orbital first', () => {
  const map = MAPS[6], match = new Match(map); start(match);
  for (let i = 0; i < 400; i++) match.step(idle);
  assert.equal(match.pickups[0]?.type, 'orbital');
  for (let i = 0; i < 10000; i++) { match.step(idle); assert.ok(match.pickups.length <= C.POWERUP_MAX_COUNT); }
  match.ships[0].specialShot = 'laser'; match.fire(1); match.rematch();
  assert.equal(match.time, 0); assert.equal(match.pickups.length, 0); assert.equal(match.bullets.length, 0);
  assert.ok(match.ships.every(s => !s.shield && !s.specialShot && !s.laserCharge));
});
test('arcade progression visits all 27 campaign arenas once and stops at completion', () => {
  let i = 0, visited = [ARCADE[0].mapId];
  while (nextArena(i) !== null) { i = nextArena(i); visited.push(ARCADE[i].mapId); }
  assert.equal(visited.length, 27); assert.equal(new Set(visited).size, 27); assert.equal(nextArena(26), null);
});
test('simultaneous touch pointers remain independent and cancellation clears all actions', () => {
  const touch = new TouchState(); touch.press(1, 'left'); touch.press(2, 'thrust'); touch.press(3, 'fire');
  assert.deepEqual(touch.control(), { turn: -1, thrust: 1, fire: true }); touch.release(2);
  assert.deepEqual(touch.control(), { turn: -1, thrust: 0, fire: true }); touch.clear(); assert.deepEqual(touch.control(), IDLE_CONTROL);
});
test('Poki sends loading once, balances start/stop and preserves nested pause reasons across ads', async () => {
  const pause = new PauseState(), lifecycle = new PokiLifecycle(pause), calls = []; let release;
  await lifecycle.attach({ init: async () => {}, gameLoadingFinished: () => calls.push('loaded'),
    gameplayStart: () => calls.push('start'), gameplayStop: () => calls.push('stop'),
    commercialBreak: () => new Promise(resolve => { release = resolve; }) });
  lifecycle.markGameReady(); lifecycle.markGameReady(); lifecycle.setGameplay(true);
  const ad = lifecycle.commercialBreak(); assert.equal(lifecycle.commercialBreak(), ad);
  await Promise.resolve(); assert.equal(pause.has('ad'), true); pause.set('hidden', true); release(); await ad;
  assert.equal(pause.has('ad'), false); assert.equal(pause.paused, true); assert.deepEqual(calls, ['loaded', 'start', 'stop']);
  pause.set('hidden', false); assert.equal(calls.at(-1), 'start');
  pause.set('manual', true); pause.set('blur', true); pause.set('blur', false); assert.equal(pause.paused, true);
  lifecycle.destroy(); assert.equal(calls.filter(c => c === 'loaded').length, 1);
});
test('ad rejection clears only the ad pause; failed SDK initialization never blocks local play', async () => {
  const p = new PauseState(), l = new PokiLifecycle(p);
  await l.attach({ init: async () => {}, gameLoadingFinished() {}, gameplayStart() {}, gameplayStop() {}, commercialBreak: async () => { throw Error('ad unavailable'); } });
  p.set('manual', true); await l.commercialBreak(); assert.equal(p.has('ad'), false); assert.equal(p.has('manual'), true);
  const failed = new PokiLifecycle(new PauseState()); await failed.attach({ init: async () => { throw Error('blocked'); } });
  failed.markGameReady(); failed.setGameplay(true); await failed.commercialBreak(); assert.equal(failed.pause.paused, false);
});
test('pause gate freezes world time, pickups, orbit and laser charge together', async () => {
  const match = new Match(MAPS[7]); start(match); match.ships[0].specialShot = 'laser'; match.fire(1);
  const host = match.map.bodies[0], state = shot({ x: host.x + 115, y: host.y, kind: 'orbital', trail: [], time: match.time }); captureOrbit(state, host, match.time); match.bullets.push(state);
  const pause = new PauseState(); pause.set('ad', true); const before = JSON.stringify(match);
  for (let i = 0; i < 600; i++) if (!pause.paused) match.step(idle);
  assert.equal(JSON.stringify(match), before); pause.set('ad', false); match.step(idle); assert.ok(match.time > 0);
});
test('all nine arenas run with time-aware AI and legal weapon/collision state', () => {
  for (const map of MAPS) {
    const match = new Match(map, 1), ai = new SpaceAI(() => 0.4); start(match);
    let shots = 0;
    for (let i = 0; i < 30 / C.PHYSICS_DT && match.phase !== 'matchOver'; i++) {
      const control = ai.update(C.PHYSICS_DT, match.ships[1], match.ships[0], map.bodies, { time: match.time, wormholes: map.wormholes }, match.pickups);
      match.step([IDLE_CONTROL, control]);
      for (const event of match.drainEvents()) if (event.type === 'shot' && event.owner === 2) shots++;
      assert.ok(match.ships.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)));
    }
    assert.ok(shots > 0, map.name);
  }
});
