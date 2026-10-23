import test from 'node:test';
import assert from 'node:assert/strict';
import { SpaceAI, findAimSolution } from '../.test-build/ai/SpaceAI.js';
import { findOrbitalDeployment } from '../.test-build/ai/OrbitalTactics.js';
import { preferredRange, wantsPickup, weaponLeadTime } from '../.test-build/ai/PickupTactics.js';
import { difficultyFor } from '../.test-build/ai/Difficulty.js';
import { SquadCoordinator } from '../.test-build/ai/SquadCoordinator.js';
import { OpeningFireGate } from '../.test-build/game/OpeningFireGate.js';
import { Match } from '../.test-build/game/Match.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { createBody } from '../.test-build/entities/CelestialBody.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { applyPickup, createPickup } from '../.test-build/entities/PowerUp.js';
import { stepProjectile } from '../.test-build/physics/gravity.js';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { PHYSICS_DT as dt } from '../.test-build/config.js';
const pilots = () => [new Ship(2, { x: 1080, y: 530, angle: Math.PI }), new Ship(1, { x: 300, y: 330, angle: 0 })];
const planet = () => createBody('host', 'planet', 640, 380);

test('only unit one is a beginner ramp; all later stages retain full tactics without a reset', () => {
  assert.equal(difficultyFor(0).independentAim, false);
  for (let i = 6; i < 27; i++) {
    const d = difficultyFor(i);
    assert.ok(d.dodge && d.independentAim && d.seekPickups);
    assert.ok(d.reaction <= 0.65 && d.aimError <= 3.8 && d.lead >= 0.55);
    for (const key of ['reaction','aimError','fireDelay','interval','windup']) assert.ok(d[key] < difficultyFor(i - 1)[key]);
  }
});

test('orbital AI deploys to deny a lane even when its ring is outside the old firing threshold', () => {
  const [self, target] = pilots(), bodies = [planet()];
  const result = findAimSolution(self, target, bodies, {}, 'orbital');
  assert.equal(result.orbital?.bodyId, 'host'); assert.ok(result.distance > 115);
  const live = createProjectile(self, result.angle, 'orbital');
  let captured = false;
  for (let i = 0; i < Math.round(result.trajectory.elapsed / dt); i++) {
    assert.equal(stepProjectile(live, bodies, [self]), null);
    captured ||= Boolean(live.orbitState);
  }
  assert.ok(captured); assert.equal(live.orbitState.bodyId, 'host');
  assert.ok(Math.hypot(live.x - result.trajectory.end.x, live.y - result.trajectory.end.y) < 1e-6);
});

test('orbital plans account for moving hosts and reject irrelevant or ineligible hosts', () => {
  const [self, target] = pilots();
  const bodies = [createBody('moving', 'planet', 640, 380, { motion: { radius: 35, period: 28, phase: 0 } })];
  for (const time of [2, 11]) {
    const result = findOrbitalDeployment(self, target, bodies, { time });
    assert.ok(result?.orbital); const live = createProjectile(self, result.angle, 'orbital', time);
    for (let i = 0; i < Math.round(result.trajectory.elapsed / dt); i++) assert.equal(stepProjectile(live, bodies, [self]), null);
    assert.ok(Math.hypot(live.x - result.trajectory.end.x, live.y - result.trajectory.end.y) < 1e-6);
  }
  for (const type of ['star', 'pulsar', 'blackHole']) assert.equal(findOrbitalDeployment(self, target, [createBody(type, type, 640, 380)], {}), null);
  target.x = 80; target.y = 160;
  assert.equal(findOrbitalDeployment(self, target, [createBody('remote', 'moon', 1080, 220)], {}), null);
});

test('actual orbital controls pass the firing gate, consume ammo and capture instead of waiting for a direct hit', () => {
  const m = new Match({ ...CAMPAIGN_MAPS[2], bodies: [planet()], powerUps: [], extraEnemySpawns: [],
    player1Spawn: { x: 300, y: 330, angle: 0 }, player2Spawn: { x: 1080, y: 530, angle: Math.PI } });
  m.phase = 'playing'; applyPickup(m.ships[1], 'orbital');
  const d = difficultyFor(6), ai = new SpaceAI(() => 0.5, undefined, d), gate = new OpeningFireGate(null, d);
  let fired = false, captured = false;
  for (let i = 0; i < 12 / dt && !captured; i++) {
    const s = m.ships[1], c = ai.update(dt, s, m.ships[0], m.map.bodies, { time: m.time }, [], m.bullets);
    c.fire = gate.step(dt, c.fire, s.cooldown <= 1e-9);
    m.step([IDLE_CONTROL, c]);
    fired ||= m.drainEvents().some(e => e.type === 'shot' && e.kind === 'orbital' && e.owner === 2);
    captured ||= m.bullets.some(b => b.ownerId === 2 && b.orbitState?.bodyId === 'host');
  }
  assert.ok(fired); assert.ok(captured); assert.equal(m.ships[1].specialShot, null);
});

test('orbital launch rechecks an obsolete worker plan against the actual muzzle and host', () => {
  const [self, target] = pilots(), bodies = [planet()]; applyPickup(self, 'orbital');
  const plan = findAimSolution(self, target, bodies, {}, 'orbital');
  self.angle = plan.angle;
  const ai = new SpaceAI(() => 0.5, (_, done) => done(plan), difficultyFor(6));
  ai.update(dt, self, target, bodies);
  self.x = 80; self.y = 160;
  assert.equal(ai.update(0.34, self, target, bodies).fire, false);
});

test('heavy shells lead farther than cannon; homing aims for launch acquisition and lasers include charge delay', () => {
  const [self, target] = pilots(); target.vy = 90;
  const normal = weaponLeadTime(self, target, 0.7);
  self.specialShot = 'heavy'; assert.ok(weaponLeadTime(self, target, 0.7) > normal);
  self.specialShot = 'homing'; assert.ok(weaponLeadTime(self, target, 0.7) < normal);
  self.specialShot = 'laser'; assert.ok(weaponLeadTime(self, target, 0.7) > 0.25);
  let request;
  const ai = new SpaceAI(() => 0.5, (r, done) => { request = r; done(findAimSolution(r.self, r.target, r.bodies, r.context, r.weapon)); }, difficultyFor(6));
  ai.update(dt, self, target, []); assert.ok(request.target.y > target.y);
  const blocked = ai.navigation(self, target, [planet()], [], 0, [], []);
  assert.equal(blocked.urgent, true);
});

test('laser AI settles and fires through a clear lane, but never starts a charge through a body', () => {
  for (const bodies of [[], [planet()]]) {
    const [self, target] = pilots(); self.x = 1000; self.y = 380; target.x = 280; target.y = 380;
    applyPickup(self, 'laser'); const d = difficultyFor(6), ai = new SpaceAI(() => 0.5, undefined, d);
    const gate = new OpeningFireGate(null, d); let fired = false;
    for (let i = 0; i < 4 / dt; i++) {
      const c = ai.update(dt, self, target, bodies);
      fired ||= gate.step(dt, c.fire, true);
      // Fixed positions isolate the line-of-fire decision, independent of navigation.
      self.angle = c.aim ?? self.angle;
    }
    assert.equal(fired, bodies.length === 0);
  }
});

test('homing refuses a near-body launch even if an obsolete plan claims a target lock', () => {
  const [self, target] = pilots(); self.x = 850; self.y = 380; self.angle = Math.PI;
  applyPickup(self, 'homing');
  const obstacle = createBody('star', 'star', 640, 380);
  const ai = new SpaceAI(() => 0.5, (_, done) => done({ angle: Math.PI, distance: 0, trajectory: { points: [] } }), difficultyFor(6));
  ai.update(dt, self, target, [obstacle]);
  assert.equal(ai.update(0.34, self, target, [obstacle]).fire, false);
});

test('guidance temporarily sharpens aim and lead, then expires back to the same difficulty', () => {
  const [self, target] = pilots(); target.vy = 100;
  const d = difficultyFor(6), ai = new SpaceAI(() => 0.9, undefined, d);
  const plain = ai.update(dt, self, target, []), plainLead = ai.targetPoint.y;
  const plainError = Math.abs(plain.aim - ai.solution.angle);
  applyPickup(self, 'trajectory'); const guided = ai.update(dt, self, target, []);
  assert.ok(Math.abs(guided.aim - ai.solution.angle) < plainError * 0.5);
  assert.ok(ai.targetPoint.y > plainLead);
  self.aimAssistFor = 0; const expired = ai.update(dt, self, target, []);
  assert.ok(Math.abs(Math.abs(expired.aim - ai.solution.angle) - plainError) < 1e-9);
  assert.equal(ai.difficulty, d);
});

test('shield encourages closer positioning but never disables lethal-body avoidance', () => {
  const [self, target] = pilots(); self.x = 800; self.y = 380; target.x = 300; target.y = 380;
  const ai = new SpaceAI(() => 0.5, undefined, difficultyFor(6));
  const normal = ai.navigation(self, target, [], [], 0, [], []);
  const oldRange = preferredRange(self); applyPickup(self, 'shield');
  const shielded = ai.navigation(self, target, [], [], 0, [], []);
  assert.ok(preferredRange(self) < oldRange); assert.ok(Math.cos(shielded.angle) < Math.cos(normal.angle));
  assert.equal(ai.navigation(self, target, [createBody('star', 'star', 750, 380)], [], 0, [], []).urgent, true);
});

test('resource seeking avoids overwriting held ammo and squads now reserve guidance', () => {
  const [self] = pilots(); applyPickup(self, 'heavy'); applyPickup(self, 'shield'); applyPickup(self, 'trajectory');
  for (const type of ['heavy','homing','orbital','laser','shield','trajectory']) assert.equal(wantsPickup(self, type), false);
  self.aimAssistFor = 2; assert.equal(wantsPickup(self, 'trajectory'), true);
  const team = [new Ship(2, { x: 700, y: 300, angle: Math.PI }), new Ship(3, { x: 1000, y: 500, angle: Math.PI })];
  const target = new Ship(1, { x: 300, y: 300, angle: 0 }), squad = new SquadCoordinator(14);
  squad.update(dt, team, target, [], 0, [createPickup(7, 'trajectory', { x: 950, y: 500 })]);
  assert.equal(squad.orders.get(3).pickupId, 7);
});

test('a returning own orbital round triggers avoidance even for a beginner pilot', () => {
  const [self, target] = pilots(); const ai = new SpaceAI(() => 0.5, undefined, difficultyFor(0));
  const bullet = { x: self.x - 80, y: self.y, vx: 250, vy: 0, ownerId: self.id, kind: 'orbital', orbitState: { bodyId: 'host' } };
  assert.equal(ai.navigation(self, target, [], [], 0, [bullet], []).urgent, true);
});

test('all four ammo strategies actually fire in live matches; laser flanks a blocking planet', () => {
  for (const weapon of ['heavy','homing','laser','orbital']) for (const blocked of [false, true]) {
    const m = new Match({ ...CAMPAIGN_MAPS[2], bodies: blocked ? [planet()] : [], powerUps: [], extraEnemySpawns: [],
      player1Spawn: { x: 280, y: 380, angle: 0 }, player2Spawn: { x: 1000, y: 380, angle: Math.PI } });
    m.phase = 'playing'; applyPickup(m.ships[1], weapon);
    const d = difficultyFor(6), ai = new SpaceAI(() => 0.5, undefined, d), gate = new OpeningFireGate(null, d);
    let fired = false;
    for (let i = 0; i < 15 / dt && m.phase === 'playing' && !fired; i++) {
      const s = m.ships[1], c = ai.update(dt, s, m.ships[0], m.map.bodies, { time: m.time }, [], m.bullets);
      c.fire = gate.step(dt, c.fire, s.cooldown <= 1e-9 && !s.laserCharge);
      m.step([IDLE_CONTROL, c]);
      fired ||= m.drainEvents().some(e => e.owner === 2 && (weapon === 'laser' ? e.type === 'laser' : e.type === 'shot' && e.kind === weapon));
    }
    assert.ok(fired, weapon + ' blocked=' + blocked);
    if (weapon === 'laser' && blocked) assert.ok(Math.abs(m.ships[1].y - 380) > 80);
  }
});
