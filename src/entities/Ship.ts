import * as C from '../config.js';
import { getShipAcceleration, segmentCircleContact, type Vec2 } from '../physics/gravity.js';
import { bodyPosition, bodyVelocity, inPulsarBeam, type CelestialBody } from './CelestialBody.js';
import type { SpecialShot } from './PowerUp.js';
export type PlayerId = 1 | 2 | 3 | 4;
export interface ShipControl { turn: number; thrust: number; fire: boolean; move?: Vec2; aim?: number; independentAim?: boolean }
export const IDLE_CONTROL: ShipControl = { turn: 0, thrust: 0, fire: false };
export interface Spawn extends Vec2 { angle: number }
export const otherPlayer = (id: PlayerId): 1 | 2 => id === 1 ? 2 : 1;
export const angleDifference = (target: number, current: number): number => Math.atan2(Math.sin(target - current), Math.cos(target - current));
export class Ship {
  x = 0; y = 0; vx = 0; vy = 0; angle = 0; hullAngle = 0; cooldown = 0;
  portalCooldown = 0;
  aimAssistFor = 0;
  hp = 1; maxHP = 1; invulnerableFor = 0; respawnFor = 0;
  alive = true; thrusting = false; shield = false; specialShot: SpecialShot | null = null; jammedFor = 0;
  laserCharge: { remaining: number; angle: number } | null = null;
  radius = C.SHIP_RADIUS;
  constructor(readonly id: PlayerId, spawn: Spawn) { this.reset(spawn); }
  reset(spawn: Spawn): void {
    this.x = spawn.x; this.y = spawn.y; this.angle = spawn.angle; this.hullAngle = spawn.angle; this.vx = 0; this.vy = 0;
    this.cooldown = 0; this.portalCooldown = 0; this.alive = true; this.thrusting = false; this.shield = false;
    this.hp = this.maxHP; this.invulnerableFor = 0; this.respawnFor = 0;
    this.specialShot = null; this.jammedFor = 0; this.laserCharge = null; this.aimAssistFor = 0;
  }
  update(dt: number, control: ShipControl, bodies: readonly CelestialBody[], time = 0, gravity: 'none' | 'all' | 'blackHoles' = 'blackHoles'): string | null {
    if (!this.alive) return null;
    this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
    this.aimAssistFor = Math.max(0, this.aimAssistFor - dt);
    this.cooldown = Math.max(0, this.cooldown - dt); this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    this.jammedFor = bodies.some(body => inPulsarBeam(this, body, time)) ? C.PULSAR_RECOVERY_TIME : Math.max(0, this.jammedFor - dt);
    const jam = this.jammedFor > 0;
    const move = control.move && Number.isFinite(control.move.x) && Number.isFinite(control.move.y) ? control.move : undefined;
    const moveLength = move ? Math.hypot(move.x, move.y) : 0;
    const moving = moveLength > 1e-9;
    const rotationStep = C.SHIP_ROTATION_SPEED * dt * (jam ? C.PULSAR_TURN_MULTIPLIER : 1);
    // Touch movement uses screen coordinates, independent of the ship's current heading.
    // The nose follows smoothly, retaining the pulsar's turn interference.
    if (control.independentAim) {
      const aimStep = 7.5 * dt * (jam ? C.PULSAR_TURN_MULTIPLIER : 1);
      if (Number.isFinite(control.aim)) this.angle += Math.max(-aimStep, Math.min(aimStep, angleDifference(control.aim!, this.angle)));
      if (moving) this.hullAngle += Math.max(-rotationStep, Math.min(rotationStep, angleDifference(Math.atan2(move!.y, move!.x), this.hullAngle)));
    } else {
      this.angle += moving ? Math.max(-rotationStep, Math.min(rotationStep, angleDifference(Math.atan2(move!.y, move!.x), this.angle)))
        : Math.max(-1, Math.min(1, control.turn)) * rotationStep;
      this.hullAngle = this.angle;
    }
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
    const throttle = moving ? Math.min(1, moveLength) : Math.max(-1, Math.min(1, control.thrust));
    const braking = !moving && throttle < 0 && Math.hypot(this.vx, this.vy) > 30;
    const thrust = (throttle > 0 ? C.SHIP_THRUST * throttle : throttle < 0 && !braking ? C.SHIP_REVERSE_THRUST * throttle : 0) * (jam ? C.PULSAR_THRUST_MULTIPLIER : 1);
    const drag = Math.exp(-(braking ? C.SHIP_DRAG + (C.SHIP_BRAKE_DRAG - C.SHIP_DRAG) * -throttle : control.independentAim && !moving ? 3.2 : C.SHIP_DRAG) * dt);
    const force = getShipAcceleration(this, bodies, time, gravity);
    this.vx = (this.vx + ((moving ? move!.x / moveLength : Math.cos(this.angle)) * thrust + force.x) * dt) * drag;
    this.vy = (this.vy + ((moving ? move!.y / moveLength : Math.sin(this.angle)) * thrust + force.y) * dt) * drag;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > C.SHIP_MAX_SPEED) { this.vx *= C.SHIP_MAX_SPEED / speed; this.vy *= C.SHIP_MAX_SPEED / speed; }
    this.thrusting = thrust > 0;
    const before = { x: this.x, y: this.y };
    this.x += this.vx * dt; this.y += this.vy * dt;
    for (const body of bodies) {
      const old = bodyPosition(body, time), p = bodyPosition(body, time + dt);
      const t = segmentCircleContact({ x: before.x - old.x, y: before.y - old.y },
        { x: this.x - p.x, y: this.y - p.y }, { x: 0, y: 0, radius: body.collisionRadius }, this.radius);
      if (body.lethal && t !== null) return body.id;
      let dx = this.x - p.x, dy = this.y - p.y, distance = Math.hypot(dx, dy);
      const minimum = body.collisionRadius + this.radius;
      // A contact at t=0 must not push an already separating ship back onto the surface.
      const startedOutside = Math.hypot(before.x - old.x, before.y - old.y) > minimum + 1e-7;
      if (distance < minimum || (t !== null && startedOutside)) {
        if (t !== null && distance >= minimum) {
          dx = before.x - old.x + ((this.x - p.x) - (before.x - old.x)) * t;
          dy = before.y - old.y + ((this.y - p.y) - (before.y - old.y)) * t; distance = Math.hypot(dx, dy);
        }
        const nx = distance > 0 ? dx / distance : 1, ny = distance > 0 ? dy / distance : 0;
        this.x = p.x + nx * minimum; this.y = p.y + ny * minimum;
        const velocity = bodyVelocity(body, time + dt), inward = (this.vx - velocity.x) * nx + (this.vy - velocity.y) * ny;
        if (inward < 0) { this.vx -= inward * nx; this.vy -= inward * ny; }
      }
    }
    const b = C.ARENA_BOUNDS;
    if (this.x < b.left + this.radius) { this.x = b.left + this.radius; this.vx = Math.abs(this.vx) * C.BOUNDARY_BOUNCE; }
    if (this.x > b.right - this.radius) { this.x = b.right - this.radius; this.vx = -Math.abs(this.vx) * C.BOUNDARY_BOUNCE; }
    if (this.y < b.top + this.radius) { this.y = b.top + this.radius; this.vy = Math.abs(this.vy) * C.BOUNDARY_BOUNCE; }
    if (this.y > b.bottom - this.radius) { this.y = b.bottom - this.radius; this.vy = -Math.abs(this.vy) * C.BOUNDARY_BOUNCE; }
    return null;
  }
}
