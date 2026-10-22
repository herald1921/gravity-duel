import * as C from '../config.js';
import { bodyPosition, bodyVelocity, type CelestialBody } from '../entities/CelestialBody.js';
import { teleportProjectile, type Wormhole } from '../entities/Wormhole.js';
import type { ProjectileKind } from '../entities/PowerUp.js';
import type { PlayerId } from '../entities/Ship.js';
export interface Vec2 { x: number; y: number }
export interface Circle extends Vec2 { radius: number }
export interface OrbitState {
  bodyId: string; radius: number; direction: 1 | -1;
  angle: number; angularVelocity: number; sweptAngle: number;
  semiMajorAxis: number; eccentricity: number; argumentOfPeriapsis: number;
  meanAnomaly: number; meanMotion: number; gravitationalParameter: number;
  periapsis: number; apoapsis: number;
}
export interface ProjectileState extends Circle {
  vx: number; vy: number; age: number; ownerId: PlayerId; kind?: ProjectileKind; time?: number;
  orbitState?: OrbitState; portalCooldown?: number; portalVisits?: number; gravityTurn?: number;
  teleport?: { from: Vec2; to: Vec2 }; justCaptured?: boolean; homingTargetId?: PlayerId;
}
export interface CollisionTarget extends Circle { id: PlayerId; previous?: Vec2; alive?: boolean }
export type ProjectileEvent = { type: 'body'; bodyId: string } | { type: 'ship'; shipId: PlayerId } | { type: 'bounds' | 'expired' };
export interface TrajectoryPoint extends Vec2 { breakBefore?: boolean }
export interface Trajectory { points: TrajectoryPoint[]; end: ProjectileState; event: ProjectileEvent | null; elapsed: number }
export interface SpaceContext { time?: number; wormholes?: readonly Wormhole[]; maxOrbitArc?: number }

/** Original softened Newtonian force, evaluated at absolute simulation time. */
export function getGravityAcceleration(position: Vec2, bodies: readonly CelestialBody[], time = 0): Vec2 {
  let x = 0, y = 0;
  for (const body of bodies) {
    const center = bodyPosition(body, time), dx = center.x - position.x, dy = center.y - position.y;
    const scale = body.gravityStrength / (dx * dx + dy * dy + Math.max(C.MIN_SOFTENING, body.softening) ** 2) ** 1.5;
    x += dx * scale; y += dy * scale;
  }
  const length = Math.hypot(x, y);
  if (length > C.MAX_GRAVITY_ACCELERATION) { x *= C.MAX_GRAVITY_ACCELERATION / length; y *= C.MAX_GRAVITY_ACCELERATION / length; }
  return { x, y };
}
export function getShipAcceleration(position: Vec2, bodies: readonly CelestialBody[], time = 0, mode: 'none' | 'all' | 'blackHoles' = 'blackHoles'): Vec2 {
  if (mode === 'none') return { x: 0, y: 0 };
  const a = getGravityAcceleration(position, mode === 'all' ? bodies : bodies.filter(body => body.type === 'blackHole'), time);
  const length = Math.hypot(a.x, a.y);
  const scale = Math.min(C.BLACK_HOLE_SHIP_GRAVITY_MULTIPLIER, C.MAX_SHIP_GRAVITY_ACCELERATION / Math.max(1, length));
  return { x: a.x * scale, y: a.y * scale };
}
/** Original semi-implicit Euler; ordinary shots never receive scripted orbits. */
export function integrateProjectile(state: ProjectileState, bodies: readonly CelestialBody[], dt: number, gravityScale = 1): void {
  const time = state.time ?? state.age, a = getGravityAcceleration(state, bodies, time);
  const heading = Math.atan2(state.vy, state.vx);
  state.vx += a.x * dt * gravityScale; state.vy += a.y * dt * gravityScale;
  const bent = Math.atan2(state.vy, state.vx) - heading;
  state.gravityTurn = (state.gravityTurn ?? 0) + Math.atan2(Math.sin(bent), Math.cos(bent));
  const speed = Math.hypot(state.vx, state.vy);
  if (speed > C.MAX_PROJECTILE_SPEED) { state.vx *= C.MAX_PROJECTILE_SPEED / speed; state.vy *= C.MAX_PROJECTILE_SPEED / speed; }
  state.x += state.vx * dt; state.y += state.vy * dt; state.age += dt; state.time = time + dt;
}
export function segmentCircleContact(start: Vec2, end: Vec2, circle: Circle, padding = 0): number | null {
  const dx = end.x - start.x, dy = end.y - start.y, fx = start.x - circle.x, fy = start.y - circle.y;
  const c = fx * fx + fy * fy - (circle.radius + padding) ** 2;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
export function orbitSpeed(body: CelestialBody, radius: number): number {
  return Math.max(C.ORBIT_MIN_SPEED, Math.min(C.ORBIT_MAX_SPEED, Math.sqrt(body.gravityStrength / radius) * C.ORBIT_SPEED_MULTIPLIER));
}
export function captureOrbit(state: ProjectileState, body: CelestialBody, time: number): void {
  const center = bodyPosition(body, time), centerVelocity = bodyVelocity(body, time);
  const dx = state.x - center.x, dy = -(state.y - center.y), theta = Math.atan2(dy, dx);
  const minimum = body.collisionRadius + state.radius + C.ORBIT_MIN_CLEARANCE;
  const radius = Math.max(minimum, Math.hypot(dx, dy));
  const maximum = Math.max(radius, (body.orbitCaptureRadius ?? radius) * C.ORBIT_MAX_APOAPSIS_MULTIPLIER);
  const mu = Math.max(1, body.gravityStrength * C.ORBIT_SPEED_MULTIPLIER ** 2);
  const circular = Math.sqrt(mu / radius), ux = Math.cos(theta), uy = Math.sin(theta);
  const vx = state.vx - centerVelocity.x, vy = -(state.vy - centerVelocity.y);
  const radial = vx * ux + vy * uy, tangent = -vx * uy + vy * ux;
  const direction = (Math.abs(tangent) > 1e-7 ? Math.sign(tangent) : vx >= 0 ? 1 : -1) as 1 | -1;
  // A=e*cos(f), B=e*sin(f). For a fixed contact radius, periapsis,
  // apoapsis and eccentricity limits give an interval of legal radial speeds.
  // Project the incoming velocity onto that feasible set; preserve legal input exactly.
  const lo = Math.max(-C.ORBIT_MAX_ECCENTRICITY, (minimum - radius) / (minimum + radius));
  const hi = Math.min(C.ORBIT_MAX_ECCENTRICITY, (maximum - radius) / (maximum + radius));
  let bestA = 0, bestRadial = 0, bestCost = Infinity;
  const evaluate = (raw: number) => {
    const A = Math.max(lo, Math.min(hi, raw));
    const eLimit = Math.max(0, Math.min(C.ORBIT_MAX_ECCENTRICITY,
      radius * (1 + A) / minimum - 1, 1 - radius * (1 + A) / maximum));
    if (eLimit + 1e-8 < Math.abs(A)) return;
    const t = circular * Math.sqrt(1 + A);
    const radialLimit = circular * Math.sqrt(Math.max(0, eLimit ** 2 - A ** 2)) / Math.sqrt(1 + A);
    const r = Math.max(-radialLimit, Math.min(radialLimit, radial));
    const cost = (t - Math.abs(tangent)) ** 2 + (r - radial) ** 2;
    if (cost < bestCost) { bestCost = cost; bestA = A; bestRadial = r; }
  };
  evaluate(tangent ** 2 / circular ** 2 - 1); evaluate(0);
  if (bestCost > 1e-12) {
    for (let i = 0; i <= 48; i++) evaluate(lo + (hi - lo) * i / 48);
    const coarse = bestA, stride = (hi - lo) / 48;
    for (let i = -12; i <= 12; i++) evaluate(coarse + stride * i / 12);
  }
  const B = direction * bestRadial * Math.sqrt(1 + bestA) / circular;
  const eccentricity = Math.hypot(bestA, B), p = radius * (1 + bestA);
  const semiMajorAxis = p / (1 - eccentricity ** 2);
  const f = eccentricity > 1e-9 ? Math.atan2(B, bestA) : 0;
  const E = Math.atan2(Math.sqrt(1 - eccentricity ** 2) * Math.sin(f), eccentricity + Math.cos(f));
  state.orbitState = { bodyId: body.id, radius, direction, angle: theta,
    angularVelocity: Math.sqrt(mu * p) / (radius * radius), sweptAngle: 0,
    semiMajorAxis, eccentricity, argumentOfPeriapsis: theta - f,
    meanAnomaly: E - eccentricity * Math.sin(E), meanMotion: Math.sqrt(mu / semiMajorAxis ** 3),
    gravitationalParameter: mu, periapsis: semiMajorAxis * (1 - eccentricity), apoapsis: semiMajorAxis * (1 + eccentricity) };
  state.justCaptured = true; advanceOrbit(state, body, time, 0);
}
function advanceOrbit(state: ProjectileState, body: CelestialBody, time: number, dt: number): void {
  const orbit = state.orbitState!, e = orbit.eccentricity, a = orbit.semiMajorAxis;
  orbit.meanAnomaly = Math.atan2(Math.sin(orbit.meanAnomaly + orbit.direction * orbit.meanMotion * dt),
    Math.cos(orbit.meanAnomaly + orbit.direction * orbit.meanMotion * dt));
  let E = orbit.meanAnomaly;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - orbit.meanAnomaly) / (1 - e * Math.cos(E));
  const cos = Math.cos(E), sin = Math.sin(E), minor = Math.sqrt(1 - e * e);
  const x = a * (cos - e), y = a * minor * sin, rate = orbit.direction * orbit.meanMotion / (1 - e * cos);
  const vx = -a * sin * rate, vy = a * minor * cos * rate;
  const c = Math.cos(orbit.argumentOfPeriapsis), s = Math.sin(orbit.argumentOfPeriapsis);
  const angle = orbit.argumentOfPeriapsis + Math.atan2(minor * sin, cos - e);
  if (dt > 0) orbit.sweptAngle += Math.abs(Math.atan2(Math.sin(angle - orbit.angle), Math.cos(angle - orbit.angle)));
  orbit.angle = angle; orbit.radius = a * (1 - e * cos);
  orbit.angularVelocity = Math.sqrt(orbit.gravitationalParameter * a * (1 - e * e)) / orbit.radius ** 2;
  const center = bodyPosition(body, time), velocity = bodyVelocity(body, time);
  state.x = center.x + c * x - s * y; state.y = center.y - s * x - c * y;
  state.vx = velocity.x + c * vx - s * vy; state.vy = velocity.y - s * vx - c * vy;
}
function movingContact(start: Vec2, end: Vec2, body: CelestialBody, time: number, radius: number, padding: number): number | null {
  const a = bodyPosition(body, time), b = bodyPosition(body, time + C.PHYSICS_DT);
  if (!body.motion) return segmentCircleContact(start, end, { ...a, radius }, padding);
  return segmentCircleContact({ x: start.x - a.x, y: start.y - a.y }, { x: end.x - b.x, y: end.y - b.y }, { x: 0, y: 0, radius }, padding);
}
export function steerHoming(state: ProjectileState, targets: readonly CollisionTarget[]): void {
  delete state.homingTargetId;
  if (state.kind !== 'homing' || state.age + 1e-9 < C.HOMING_ARM_TIME ||
      state.age >= C.HOMING_ARM_TIME + C.HOMING_TRACK_TIME) return;
  const target = targets.find(t => t.id !== state.ownerId && t.alive !== false);
  if (!target) return;
  state.homingTargetId = target.id;
  const currentSpeed = Math.hypot(state.vx, state.vy), angle = Math.atan2(state.vy, state.vx);
  const engineStep = C.HOMING_ENGINE_ACCELERATION * C.PHYSICS_DT;
  const speed = currentSpeed + Math.max(-engineStep, Math.min(engineStep, C.HOMING_CRUISE_SPEED - currentSpeed));
  const error = Math.atan2(target.y - state.y, target.x - state.x) - angle;
  const delta = Math.atan2(Math.sin(error), Math.cos(error)), limit = C.HOMING_TURN_RATE * C.PHYSICS_DT;
  const next = angle + Math.max(-limit, Math.min(limit, delta));
  state.vx = Math.cos(next) * speed; state.vy = Math.sin(next) * speed;
}
function lifetime(state: ProjectileState): number {
  return state.kind === 'homing' ? C.HOMING_LIFETIME : state.kind === 'orbital' ? C.ORBITAL_BULLET_LIFETIME : state.kind === 'heavy' ? C.HEAVY_LIFETIME : C.BULLET_LIFETIME;
}
/** Sole projectile step used by Match, previews and AI. Portals never create a new projectile. */
export function stepProjectile(state: ProjectileState, bodies: readonly CelestialBody[],
  targets: readonly CollisionTarget[] = [], context: SpaceContext = {}): ProjectileEvent | null {
  delete state.teleport; delete state.justCaptured;
  const time = context.time ?? state.time ?? state.age;
  state.time = time;
  state.portalCooldown = Math.max(0, (state.portalCooldown ?? 0) - C.PHYSICS_DT);
  const before = { x: state.x, y: state.y }, previousAge = state.age;
  if (state.orbitState) {
    const host = bodies.find(body => body.id === state.orbitState!.bodyId);
    if (!host) return { type: 'expired' };
    state.age += C.PHYSICS_DT; state.time += C.PHYSICS_DT;
    advanceOrbit(state, host, state.time, C.PHYSICS_DT);
  } else {
    steerHoming(state, targets);
    // Active guidance counteracts part of gravity; cannon/heavy/free orbital physics stay unchanged.
    integrateProjectile(state, bodies, C.PHYSICS_DT, state.homingTargetId ? C.HOMING_GRAVITY_MULTIPLIER : 1);
  }
  let event: ProjectileEvent | null = null, contact = Infinity;
  let portal: Wormhole | undefined, capture: CelestialBody | undefined;
  for (const body of bodies) {
    const t = movingContact(before, state, body, time, body.collisionRadius, state.radius);
    if (t !== null && t < contact) { event = { type: 'body', bodyId: body.id }; contact = t; }
  }
  for (const ship of targets) {
    if (ship.alive === false || (ship.id === state.ownerId && previousAge + 1e-9 < C.OWNER_GRACE_TIME)) continue;
    const previous = ship.previous ?? ship;
    const t = segmentCircleContact({ x: before.x - previous.x, y: before.y - previous.y },
      { x: state.x - ship.x, y: state.y - ship.y }, { x: 0, y: 0, radius: ship.radius }, state.radius);
    if (t !== null && t < contact) { event = { type: 'ship', shipId: ship.id }; contact = t; }
  }
  {
    if (state.portalCooldown <= 1e-9) for (const gate of context.wormholes ?? []) {
      if (!(context.wormholes ?? []).some(exit => exit.id === gate.exitId)) continue;
      const t = segmentCircleContact(before, state, gate, state.radius);
      if (t !== null && t < contact) { portal = gate; capture = undefined; event = null; contact = t; }
    }
    if (!state.orbitState && state.kind === 'orbital') for (const body of bodies) {
      if ((body.type !== 'planet' && body.type !== 'moon') || !body.orbitCaptureRadius) continue;
      const t = movingContact(before, state, body, time, body.orbitCaptureRadius, 0);
      if (t !== null && t < contact) { capture = body; portal = undefined; event = null; contact = t; }
    }
  }
  if (Number.isFinite(contact)) {
    state.x = before.x + (state.x - before.x) * contact;
    state.y = before.y + (state.y - before.y) * contact;
    if (event) return event;
    if (portal) {
      delete state.orbitState;
      teleportProjectile(state, portal, context.wormholes!.find(exit => exit.id === portal.exitId)!);
      state.portalVisits = (state.portalVisits ?? 0) + 1;
      // No collision segment is ever drawn/tested through the gap between portals.
      for (const body of bodies) {
        const p = bodyPosition(body, state.time!);
        if (Math.hypot(state.x - p.x, state.y - p.y) <= body.collisionRadius + state.radius) return { type: 'body', bodyId: body.id };
      }
      for (const target of targets) if (target.alive !== false &&
        (target.id !== state.ownerId || previousAge >= C.OWNER_GRACE_TIME) &&
        Math.hypot(state.x - target.x, state.y - target.y) <= target.radius + state.radius) return { type: 'ship', shipId: target.id };
      if (state.kind === 'orbital') {
        const host = bodies.find(body => (body.type === 'planet' || body.type === 'moon') && body.orbitCaptureRadius &&
          Math.hypot(state.x - bodyPosition(body, state.time!).x, state.y - bodyPosition(body, state.time!).y) <= body.orbitCaptureRadius);
        if (host) captureOrbit(state, host, state.time!);
      }
    } else if (capture) {
      captureOrbit(state, capture, time + C.PHYSICS_DT * contact);
      advanceOrbit(state, capture, state.time!, C.PHYSICS_DT * (1 - contact));
    }
  }
  const margin = C.OUT_OF_BOUNDS_MARGIN;
  // A captured ellipse is bounded and may return from outside the camera.
  if (!state.orbitState && (state.x < -margin || state.x > C.WORLD.width + margin || state.y < -margin || state.y > C.WORLD.height + margin)) return { type: 'bounds' };
  if (state.age + 1e-9 >= lifetime(state)) return { type: 'expired' };
  return null;
}
/** Target ships are snapshots: future human controls are unknowable. Bodies use future absolute time. */
export function simulateTrajectory(initial: ProjectileState, bodies: readonly CelestialBody[],
  targets: readonly CollisionTarget[] = [], duration = C.TRAJECTORY_PREVIEW_TIME,
  sampleSteps = C.PREDICTION_SAMPLE_STEPS, context: SpaceContext = {}): Trajectory {
  const state: ProjectileState = { ...initial, ...(initial.orbitState ? { orbitState: { ...initial.orbitState } } : {}) };
  state.time = context.time ?? initial.time ?? initial.age;
  const points: TrajectoryPoint[] = [{ x: state.x, y: state.y }];
  const snapshots = targets.map(({ id, x, y, radius, alive }) => ({ id, x, y, radius, alive }));
  let event: ProjectileEvent | null = null, steps = 0;
  const stride = Math.max(1, Math.floor(sampleSteps)), maxSteps = Math.max(0, Math.floor(duration / C.PHYSICS_DT + 1e-9));
  for (let i = 0; i < maxSteps; i++) {
    event = stepProjectile(state, bodies, snapshots, { wormholes: context.wormholes }); steps++;
    if (state.teleport) { points.push(state.teleport.from, { ...state.teleport.to, breakBefore: true }); }
    if (steps % stride === 0 || event || state.justCaptured || i === maxSteps - 1) points.push({ x: state.x, y: state.y });
    if (event || (context.maxOrbitArc !== undefined && (state.orbitState?.sweptAngle ?? 0) >= context.maxOrbitArc)) break;
  }
  return { points, end: state, event, elapsed: steps * C.PHYSICS_DT };
}
