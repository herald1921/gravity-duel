import { AI_AIM_ERROR_DEGREES, AI_AIM_SECONDS, AI_FIRE_DELAY, AI_MOVE_SECONDS, AI_REACTION_TIME, AI_SEARCH_ANGLES, AI_SEARCH_SECONDS, ARENA_BOUNDS, LASER_CHARGE_TIME } from '../config.js';
import { createProjectile, type Launcher } from '../entities/Bullet.js';
import { bodyAt, inPulsarBeam, type CelestialBody } from '../entities/CelestialBody.js';
import type { Pickup, ProjectileKind, SpecialShot } from '../entities/PowerUp.js';
import { angleDifference, type Ship, type ShipControl, type PlayerId } from '../entities/Ship.js';
import { segmentCircleContact, simulateTrajectory, type CollisionTarget, type SpaceContext, type Trajectory, type Vec2 } from '../physics/gravity.js';
import { traceLaser } from '../physics/laser.js';
import type { AimPlanner } from './TrajectoryPlanner.js';
import type { Difficulty } from './Difficulty.js';
import type { Bullet } from '../entities/Bullet.js';
import type { SquadOrder } from './SquadCoordinator.js';
import { findOrbitalDeployment, type OrbitalDeployment } from './OrbitalTactics.js';
import { preferredRange, wantsPickup, weaponLeadTime } from './PickupTactics.js';
export interface AimSolution { angle: number; distance: number; trajectory: Trajectory; orbital?: OrbitalDeployment }
export function findAimSolution(self: Launcher & CollisionTarget, target: CollisionTarget,
  bodies: readonly CelestialBody[], context: SpaceContext = {}, weapon: SpecialShot | 'normal' = 'normal'): AimSolution {
  if (weapon === 'laser') {
    const angle = Math.atan2(target.y - self.y, target.x - self.x);
    const beam = traceLaser(self, bodies, [target], context.time ?? 0, angle);
    return { angle, distance: beam.event?.type === 'ship' ? 0 : Infinity,
      trajectory: { points: [beam.start, beam.end], end: createProjectile(self, angle), event: beam.event, elapsed: 0 } };
  }
  if (weapon === 'orbital') {
    const deployment = findOrbitalDeployment(self, target, bodies, context);
    if (deployment) return { ...deployment, trajectory: simulateTrajectory(createProjectile(self, deployment.angle, 'orbital'),
      bodies, [self, target], AI_SEARCH_SECONDS, 3, context) };
  }
  const kind: ProjectileKind = weapon;
  let best: AimSolution | null = null;
  const evaluate = (angle: number) => {
    const trajectory = simulateTrajectory(createProjectile(self, angle, kind), bodies, kind === 'homing' ? [self, target] : [self], AI_SEARCH_SECONDS, 3, context);
    let distance = Infinity;
    for (const point of trajectory.points) distance = Math.min(distance, Math.hypot(point.x - target.x, point.y - target.y));
    if (trajectory.event?.type === 'ship' && trajectory.event.shipId === self.id) distance += 500;
    if (!best || distance < best.distance || (distance === best.distance && trajectory.elapsed < best.trajectory.elapsed)) best = { angle, distance, trajectory };
  };
  const stride = Math.PI * 2 / AI_SEARCH_ANGLES;
  for (let i = 0; i < AI_SEARCH_ANGLES; i++) evaluate(i * stride);
  const coarse = best! as AimSolution;
  for (let i = -6; i <= 6; i++) evaluate(coarse.angle + i * stride / 6);
  const result = best! as AimSolution;
  return { ...result, trajectory: simulateTrajectory(createProjectile(self, result.angle, kind), bodies, [self, target], AI_SEARCH_SECONDS, 3, context) };
}
export class SpaceAI {
  solution: AimSolution | null = null; targetPoint: Vec2 | null = null;
  private decisionIn = 0; private planAge = 0; private goalAngle = 0;
  private blockedFor = 0;
  private guided = false; private aimOffset = 0; private observedVelocity = { x: 0, y: 0 };
  private targetId: PlayerId | null = null;
  private phaseTime = AI_AIM_SECONDS; private moving = false; private side = 1;
  private plannedWeapon: SpecialShot | 'normal' = 'normal';
  private pending = false; private revision = 0;
  constructor(private readonly random: () => number = Math.random, private readonly planner?: AimPlanner, readonly difficulty?: Difficulty) {}
  reset(): void {
    this.revision++; this.pending = false;
    this.solution = null; this.targetPoint = null; this.decisionIn = 0; this.planAge = 0;
    this.blockedFor = 0;
    this.guided = false; this.aimOffset = 0; this.observedVelocity = { x: 0, y: 0 };
    this.targetId = null;
    this.phaseTime = AI_AIM_SECONDS; this.moving = false; this.side = this.random() > 0.5 ? 1 : -1;
  }
  update(dt: number, self: Ship, target: Ship, bodies: readonly CelestialBody[], context: SpaceContext = {}, pickups: readonly Pickup[] = [], bullets: readonly Bullet[] = [], allies: readonly Ship[] = [], order?: SquadOrder): ShipControl {
    if (!self.alive || !target.alive) return { turn: 0, thrust: 0, fire: false };
    if (this.targetId !== target.id) { this.reset(); this.targetId = target.id; }
    this.decisionIn -= dt; this.phaseTime -= dt; this.planAge += dt;
    const weapon = self.specialShot ?? 'normal';
    if (this.guided !== (self.aimAssistFor > 0)) {
      this.guided = self.aimAssistFor > 0; this.decisionIn = 0;
      this.revision++; this.pending = false; this.solution = null;
    }
    if (weapon !== this.plannedWeapon) { this.decisionIn = 0; this.solution = null; }
    if (this.phaseTime <= 0) {
      this.moving = !this.moving; this.phaseTime = (this.moving ? AI_MOVE_SECONDS : AI_AIM_SECONDS) * (0.85 + this.random() * 0.3);
      if (this.moving) this.side = this.random() > 0.5 ? 1 : -1;
    }
    if (this.decisionIn <= 0 && !self.laserCharge && !this.pending) {
      this.pending = true; this.plannedWeapon = weapon; this.decisionIn = (this.difficulty?.reaction ?? AI_REACTION_TIME) * (this.guided ? 0.8 : 1);
      const lead = weaponLeadTime(self, target, this.difficulty?.lead ?? 0);
      const velocity = { x: target.vx, y: target.vy };
      const revision = ++this.revision, targetPoint = {
        x: Math.max(45, Math.min(1235, target.x + target.vx * lead)), y: Math.max(125, Math.min(650, target.y + target.vy * lead)) };
      const predicted = { id: target.id, ...targetPoint, radius: target.radius };
      const accept = (solution: AimSolution | null) => {
        if (revision !== this.revision) return;
        this.pending = false;
        if (!solution || !self.alive || (self.specialShot ?? 'normal') !== weapon) { this.decisionIn = 0; return; }
        this.solution = solution; this.targetPoint = targetPoint;
        this.aimOffset = (this.random() * 2 - 1) * (this.difficulty?.aimError ?? AI_AIM_ERROR_DEGREES) * Math.PI / 180 * (this.guided ? 0.45 : 1);
        this.goalAngle = solution.angle + this.aimOffset; this.observedVelocity = velocity;
        this.planAge = 0;
      };
      if (this.planner) this.planner({ self: { id: self.id, x: self.x, y: self.y, radius: self.radius, angle: self.angle, vx: self.vx, vy: self.vy },
        target: predicted, bodies, context, weapon }, accept);
      else accept(findAimSolution(self, predicted, bodies, context, weapon));
    }
    const current = bodies.map(body => bodyAt(body, (context.time ?? 0) + 0.5));
    const navigation = this.navigation(self, target, current, pickups, context.time ?? 0, bullets, allies, order);
    this.blockedFor = (this.solution?.distance ?? Infinity) > 125 ? this.blockedFor + dt : 0;
    if (order?.role === 'PRESSURE' && this.blockedFor > 0.9 && Math.hypot(order.waypoint.x - self.x, order.waypoint.y - self.y) > 60) navigation.urgent = true;
    const settlingLaser = weapon === 'laser' && Number.isFinite(this.solution?.distance);
    const moving = !self.laserCharge && ((this.moving && !settlingLaser) || navigation.urgent);
    if (weapon === 'laser' && this.targetPoint) {
      // Extrapolate only the last delayed observation, including the charge delay.
      this.goalAngle = Math.atan2(this.targetPoint.y + this.observedVelocity.y * this.planAge - self.y,
        this.targetPoint.x + this.observedVelocity.x * this.planAge - self.x) + this.aimOffset;
    }
    const independent = this.difficulty?.independentAim === true;
    const error = angleDifference(moving && !independent ? navigation.angle : this.goalAngle, self.angle);
    const speed = Math.hypot(self.vx, self.vy);
    const turn = Math.max(-1, Math.min(1, error * 3));
    const thrust = moving ? Math.abs(error) < 0.65 ? 1 : speed > 25 ? -1 : 0 : speed > 35 ? -1 : 0;
    // Pressure pilots also threaten a near-miss lane; precision weapons retain their stricter checks.
    const suppressing = order?.role === 'PRESSURE' && weapon === 'normal';
    const deployment = weapon === 'orbital' ? this.solution?.orbital : undefined;
    let fire = (!moving || independent) && this.planAge >= (this.difficulty?.fireDelay ?? AI_FIRE_DELAY) && Math.abs(error) < (suppressing ? 0.09 : 0.055) &&
      (Boolean(deployment) || (this.solution?.distance ?? Infinity) < (weapon === 'orbital' ? 115 : suppressing ? 125 : 75));
    if (fire && deployment) {
      if (self.cooldown <= 1e-9) {
        // Movement, aiming error and moving hosts can invalidate a worker snapshot.
        const check = simulateTrajectory(createProjectile(self, self.angle, 'orbital'), bodies, [self], 3, 12,
          { ...context, maxOrbitArc: 1e-6 });
        fire = !check.event && check.end.orbitState?.bodyId === deployment.bodyId;
      }
    }
    if (weapon === 'laser') fire = fire && speed < 45 && traceLaser(self, bodies,
      [{ ...target, x: target.x + target.vx * LASER_CHARGE_TIME, y: target.y + target.vy * LASER_CHARGE_TIME }],
      (context.time ?? 0) + LASER_CHARGE_TIME).event?.type === 'ship';
    if (fire && weapon === 'homing' && self.cooldown <= 1e-9) {
      // Recheck the actual launch heading: a lock beyond a nearby obstacle is not a safe shot.
      const check = simulateTrajectory(createProjectile(self, self.angle, 'homing'), bodies, [self, target], 0.6, 12, context);
      fire = !check.event || (check.event.type === 'ship' && check.event.shipId === target.id);
    }
    if (fire && self.cooldown <= 1e-9 && !this.difficulty) this.phaseTime = Math.min(this.phaseTime, 0.45);
    return independent ? { turn: 0, thrust: 0, fire, independentAim: true, aim: this.goalAngle,
      move: moving ? { x: Math.cos(navigation.angle), y: Math.sin(navigation.angle) } : { x: 0, y: 0 } } : { turn, thrust, fire };
  }
  private navigation(self: Ship, target: Ship, bodies: readonly CelestialBody[], pickups: readonly Pickup[], time: number, bullets: readonly Bullet[], allies: readonly Ship[], order?: SquadOrder): { angle: number; urgent: boolean } {
    const dx = target.x - self.x, dy = target.y - self.y, distance = Math.max(1, Math.hypot(dx, dy));
    const radial = Math.max(-1, Math.min(1, (distance - preferredRange(self)) / 180));
    let x = dx / distance * radial - dy / distance * this.side * 0.7, y = dy / distance * radial + dx / distance * this.side * 0.7;
    let urgent = false;
    if (order) {
      const wx = order.waypoint.x - self.x, wy = order.waypoint.y - self.y, d = Math.max(1, Math.hypot(wx, wy));
      x = wx / d * Math.min(2, d / 90); y = wy / d * Math.min(2, d / 90);
      urgent = order.advance && d > 75;
      // Follow a consistent side of an obstruction instead of pushing straight into it.
      for (const body of bodies) if (segmentCircleContact(self, order.waypoint, { ...body, radius: body.collisionRadius + self.radius + 45 }) !== null) {
        const bx = self.x - body.x, by = self.y - body.y, length = Math.max(1, Math.hypot(bx, by));
        x += -by / length * order.side * 2; y += bx / length * order.side * 2;
      }
      if (self.specialShot || self.shield) { x += dx / distance * radial * 0.8; y += dy / distance * radial * 0.8; }
    }
    if (self.specialShot === 'laser' || self.specialShot === 'homing' || self.specialShot === 'heavy') {
      const blocked = bodies.some(b => segmentCircleContact(self, target, { ...b, radius: b.collisionRadius + 15 }) !== null);
      if (blocked && (self.specialShot === 'laser' || this.blockedFor > 0.45)) {
        x += -dy / distance * this.side * 2; y += dx / distance * this.side * 2; urgent = true;
      }
    }
    const nearby = pickups.filter(p => wantsPickup(self, p.type) && (!order || p.id === order.pickupId) && Math.hypot(p.x - self.x, p.y - self.y) < 390 && !bodies.some(body =>
      segmentCircleContact(self, p, { x: body.x, y: body.y, radius: body.collisionRadius + self.radius + 30 }) !== null ||
      inPulsarBeam(p, { ...body, motion: undefined }, time)))
      .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0];
    if (nearby && this.moving && (this.difficulty?.seekPickups ?? true)) { const d = Math.max(1, Math.hypot(nearby.x - self.x, nearby.y - self.y)); x = (nearby.x - self.x) / d * 2; y = (nearby.y - self.y) / d * 2; }
    if (this.difficulty?.dodge || bullets.some(b => b.ownerId === self.id && b.orbitState)) {
      for (const bullet of bullets) {
        const returningOrbit = bullet.ownerId === self.id && Boolean(bullet.orbitState);
        if (!returningOrbit && (!this.difficulty?.dodge || bullet.ownerId === self.id || allies.some(s => s.id === bullet.ownerId))) continue;
        const rx = bullet.x - self.x, ry = bullet.y - self.y, vx = bullet.vx - self.vx, vy = bullet.vy - self.vy;
        const closest = Math.max(0, Math.min(0.65, -(rx * vx + ry * vy) / Math.max(1, vx * vx + vy * vy)));
        if (closest <= 0 || Math.hypot(rx + vx * closest, ry + vy * closest) > 65) continue;
        const speed = Math.max(1, Math.hypot(vx, vy)), side = rx * vy - ry * vx >= 0 ? 1 : -1;
        x += vy / speed * side * 4; y -= vx / speed * side * 4; urgent = true;
      }
      for (const ally of allies) {
        if (ally.id === self.id || !ally.alive) continue;
        const ax = self.x - ally.x, ay = self.y - ally.y, d = Math.max(1, Math.hypot(ax, ay));
        if (d < 190) { x += ax / d * 2; y += ay / d * 2; }
      }
    }
    for (const body of bodies) {
      const bx = self.x + self.vx * 0.6 - body.x, by = self.y + self.vy * 0.6 - body.y, d = Math.max(1, Math.hypot(bx, by));
      const safe = body.collisionRadius + self.radius + (body.lethal ? 150 : 90);
      if (d < safe) { const weight = (safe - d) / 40 + 1.5; x += bx / d * weight; y += by / d * weight; if (d < safe - 30) urgent = true; }
    }
    if (self.x < ARENA_BOUNDS.left + 80) { x += 3; urgent = true; }
    if (self.x > ARENA_BOUNDS.right - 80) { x -= 3; urgent = true; }
    if (self.y < ARENA_BOUNDS.top + 75) { y += 3; urgent = true; }
    if (self.y > ARENA_BOUNDS.bottom - 75) { y -= 3; urgent = true; }
    return { angle: Math.atan2(y, x), urgent };
  }
}
