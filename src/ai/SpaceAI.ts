import { AI_AIM_ERROR_DEGREES, AI_AIM_SECONDS, AI_FIRE_DELAY, AI_MOVE_SECONDS, AI_PREFERRED_DISTANCE, AI_REACTION_TIME, AI_SEARCH_ANGLES, AI_SEARCH_SECONDS, ARENA_BOUNDS } from '../config.js';
import { createProjectile, type Launcher } from '../entities/Bullet.js';
import { bodyAt, inPulsarBeam, type CelestialBody } from '../entities/CelestialBody.js';
import type { Pickup, ProjectileKind, SpecialShot } from '../entities/PowerUp.js';
import { angleDifference, type Ship, type ShipControl } from '../entities/Ship.js';
import { segmentCircleContact, simulateTrajectory, type CollisionTarget, type SpaceContext, type Trajectory, type Vec2 } from '../physics/gravity.js';
import { traceLaser } from '../physics/laser.js';
import type { AimPlanner } from './TrajectoryPlanner.js';
export interface AimSolution { angle: number; distance: number; trajectory: Trajectory }
export function findAimSolution(self: Launcher & CollisionTarget, target: CollisionTarget,
  bodies: readonly CelestialBody[], context: SpaceContext = {}, weapon: SpecialShot | 'normal' = 'normal'): AimSolution {
  if (weapon === 'laser') {
    const angle = Math.atan2(target.y - self.y, target.x - self.x);
    const beam = traceLaser(self, bodies, [target], context.time ?? 0, angle);
    return { angle, distance: beam.event?.type === 'ship' ? 0 : Infinity,
      trajectory: { points: [beam.start, beam.end], end: createProjectile(self, angle), event: beam.event, elapsed: 0 } };
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
  private phaseTime = AI_AIM_SECONDS; private moving = false; private side = 1;
  private plannedWeapon: SpecialShot | 'normal' = 'normal';
  private pending = false; private revision = 0;
  constructor(private readonly random: () => number = Math.random, private readonly planner?: AimPlanner) {}
  reset(): void {
    this.revision++; this.pending = false;
    this.solution = null; this.targetPoint = null; this.decisionIn = 0; this.planAge = 0;
    this.phaseTime = AI_AIM_SECONDS; this.moving = false; this.side = this.random() > 0.5 ? 1 : -1;
  }
  update(dt: number, self: Ship, target: Ship, bodies: readonly CelestialBody[], context: SpaceContext = {}, pickups: readonly Pickup[] = []): ShipControl {
    this.decisionIn -= dt; this.phaseTime -= dt; this.planAge += dt;
    const weapon = self.specialShot ?? 'normal';
    if (weapon !== this.plannedWeapon) { this.decisionIn = 0; this.solution = null; }
    if (this.phaseTime <= 0) {
      this.moving = !this.moving; this.phaseTime = (this.moving ? AI_MOVE_SECONDS : AI_AIM_SECONDS) * (0.85 + this.random() * 0.3);
      if (this.moving) this.side = this.random() > 0.5 ? 1 : -1;
    }
    if (this.decisionIn <= 0 && !self.laserCharge && !this.pending) {
      this.pending = true; this.plannedWeapon = weapon; this.decisionIn = AI_REACTION_TIME;
      const revision = ++this.revision, targetPoint = { x: target.x, y: target.y };
      const accept = (solution: AimSolution | null) => {
        if (revision !== this.revision) return;
        this.pending = false;
        if (!solution || !self.alive || (self.specialShot ?? 'normal') !== weapon) { this.decisionIn = 0; return; }
        this.solution = solution; this.targetPoint = targetPoint;
        this.goalAngle = solution.angle + (this.random() * 2 - 1) * AI_AIM_ERROR_DEGREES * Math.PI / 180;
        this.planAge = 0;
      };
      if (this.planner) this.planner({ self: { id: self.id, x: self.x, y: self.y, radius: self.radius, angle: self.angle, vx: self.vx, vy: self.vy },
        target: { id: target.id, x: target.x, y: target.y, radius: target.radius }, bodies, context, weapon }, accept);
      else accept(findAimSolution(self, target, bodies, context, weapon));
    }
    const current = bodies.map(body => bodyAt(body, (context.time ?? 0) + 0.5));
    const navigation = this.navigation(self, target, current, pickups, context.time ?? 0);
    const moving = !self.laserCharge && (this.moving || navigation.urgent);
    const error = angleDifference(moving ? navigation.angle : this.goalAngle, self.angle);
    const speed = Math.hypot(self.vx, self.vy);
    const turn = Math.max(-1, Math.min(1, error * 3));
    const thrust = moving ? Math.abs(error) < 0.65 ? 1 : speed > 25 ? -1 : 0 : speed > 35 ? -1 : 0;
    let fire = !moving && this.planAge >= AI_FIRE_DELAY && Math.abs(error) < 0.055 && (this.solution?.distance ?? Infinity) < (weapon === 'orbital' ? 115 : 75);
    if (weapon === 'laser') fire = fire && traceLaser(self, bodies, [target], context.time ?? 0).event?.type === 'ship';
    if (fire && self.cooldown <= 1e-9) this.phaseTime = Math.min(this.phaseTime, 0.45);
    return { turn, thrust, fire };
  }
  private navigation(self: Ship, target: Ship, bodies: readonly CelestialBody[], pickups: readonly Pickup[], time: number): { angle: number; urgent: boolean } {
    const dx = target.x - self.x, dy = target.y - self.y, distance = Math.max(1, Math.hypot(dx, dy));
    const radial = Math.max(-1, Math.min(1, (distance - AI_PREFERRED_DISTANCE) / 180));
    let x = dx / distance * radial - dy / distance * this.side * 0.7, y = dy / distance * radial + dx / distance * this.side * 0.7;
    let urgent = false;
    const nearby = pickups.filter(p => Math.hypot(p.x - self.x, p.y - self.y) < 360 && !bodies.some(body =>
      segmentCircleContact(self, p, { x: body.x, y: body.y, radius: body.collisionRadius + self.radius + 30 }) !== null ||
      inPulsarBeam(p, { ...body, motion: undefined }, time)))
      .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0];
    if (nearby && this.moving) { const d = Math.max(1, Math.hypot(nearby.x - self.x, nearby.y - self.y)); x = (nearby.x - self.x) / d * 2; y = (nearby.y - self.y) / d * 2; }
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
