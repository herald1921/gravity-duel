import * as C from '../config.js';
import { shotHighlight, type Highlight } from './Highlights.js';
import { createProjectile, type Bullet } from '../entities/Bullet.js';
import { bodyPosition, inPulsarBeam } from '../entities/CelestialBody.js';
import { applyPickup, blockAttack, consumeShot, createPickup, type Pickup, type PowerUpType, type ProjectileKind } from '../entities/PowerUp.js';
import { Ship, IDLE_CONTROL, otherPlayer, type PlayerId, type ShipControl } from '../entities/Ship.js';
import type { GameMap } from '../maps/maps.js';
import { teleportShip } from '../entities/Wormhole.js';
import { stepProjectile, segmentCircleContact, type Vec2 } from '../physics/gravity.js';
import { traceLaser, type LaserTrace } from '../physics/laser.js';
export type GameMode = '1p' | '2p';
export type MatchPhase = 'ready' | 'playing' | 'roundOver' | 'matchOver';
export interface Death { victim: PlayerId; cause: 'shot' | 'self' | 'hazard'; highlight?: Highlight; owner?: PlayerId }
export type MechanicSound = 'pickup' | 'shieldActivate' | 'shieldBreak' | 'laserCharge' | 'teleport' | 'orbitLock';
export type MatchEvent =
  | { type: 'shot'; owner: PlayerId; position: Vec2; kind: ProjectileKind }
  | { type: 'impact'; position: Vec2; kind?: ProjectileKind }
  | { type: 'orbitalEnd'; position: Vec2; owner: PlayerId; reason: 'collision' | 'expired' | 'replaced' | 'lost'; bodyId?: string }
  | { type: 'death'; victim: PlayerId; position: Vec2; highlight?: Highlight; owner?: PlayerId }
  | { type: 'mechanic'; sound: MechanicSound; position: Vec2; pickupType?: PowerUpType; owner?: PlayerId }
  | { type: 'laser'; owner: PlayerId; position: Vec2 }
  | { type: 'respawn' };
export class Match {
  readonly ships: Ship[];
  readonly scores: Record<number, number> = { 1: 0, 2: 0 };
  readonly deathCounts: Record<PlayerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  readonly scoringHighlights: Record<PlayerId, Set<Highlight>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
  bullets: Bullet[] = []; pickups: Pickup[] = [];
  laserBeams: (LaserTrace & { age: number; owner: PlayerId })[] = [];
  phase: MatchPhase = 'ready'; phaseTime = C.ROUND_START_TIME; time = 0;
  winner: PlayerId | null = null; lastDeath: Death | null = null; draw = false;
  roundWinner: PlayerId | null = null;
  get freeForAll(): boolean { return this.map.combat === 'freeForAll'; }
  private pickupIn: number; private pickupSequence = 0; private spawnCursor = 0;
  private events: MatchEvent[] = [];
  private roundHighlights = new Set<Highlight>();
  constructor(readonly map: GameMap, readonly targetScore = C.FIRST_TO_SCORE) {
    this.ships = [new Ship(1, map.player1Spawn), new Ship(2, map.player2Spawn)];
    for (const [i, spawn] of (map.extraEnemySpawns ?? []).slice(0, 2).entries()) this.ships.push(new Ship((i + 3) as PlayerId, spawn));
    if (this.freeForAll) for (const ship of this.ships) this.scores[ship.id] = 0;
    this.pickupIn = map.pickupStart ?? 6;
  }
  rematch(): void {
    for (const ship of this.ships) { this.deathCounts[ship.id] = 0; this.scoringHighlights[ship.id].clear(); }
    this.deathCounts[1] = 0; this.deathCounts[2] = 0; this.scoringHighlights[1].clear(); this.scoringHighlights[2].clear();
    for (const id of Object.keys(this.scores)) this.scores[Number(id)] = 0;
    this.winner = null; this.time = 0;
    this.pickups = []; this.pickupIn = this.map.pickupStart ?? 6; this.pickupSequence = 0; this.spawnCursor = 0;
    this.events = []; this.respawn();
  }
  private respawn(): void {
    this.roundHighlights.clear();
    this.ships[0].reset(this.map.player1Spawn); this.ships[1].reset(this.map.player2Spawn);
    this.ships.slice(2).forEach((ship, i) => ship.reset(this.map.extraEnemySpawns![i]));
    this.bullets = []; this.laserBeams = []; this.phase = 'ready'; this.phaseTime = C.ROUND_START_TIME;
    this.lastDeath = null; this.roundWinner = null; this.draw = false; this.events.push({ type: 'respawn' });
  }
  drainEvents(): MatchEvent[] { return this.events.splice(0); }
  fire(id: PlayerId): boolean {
    const ship = this.ships[id - 1];
    if (this.phase !== 'playing' || !ship.alive || ship.cooldown > 1e-9 || ship.laserCharge) return false;
    const kind = ship.specialShot ?? 'normal';
    const owned = this.bullets.filter(b => b.ownerId === id);
    const replaceOrbit = kind === 'orbital' && owned.some(b => b.kind === 'orbital');
    if (kind !== 'laser' && owned.length >= C.MAX_BULLETS_PER_SHIP && !replaceOrbit) return false;
    consumeShot(ship); ship.cooldown = C.FIRE_COOLDOWN;
    if (kind === 'laser') {
      ship.laserCharge = { remaining: C.LASER_CHARGE_TIME, angle: ship.angle };
      this.events.push({ type: 'mechanic', sound: 'laserCharge', position: { x: ship.x, y: ship.y }, owner: id });
    } else {
      if (kind === 'orbital') {
        const old = owned.filter(b => b.kind === 'orbital');
        const remove = new Set(old.slice(0, Math.max(0, old.length - C.MAX_ORBITAL_BULLETS_PER_PLAYER + 1)));
        for (const b of remove) this.events.push({ type: 'orbitalEnd', position: { x: b.x, y: b.y }, owner: id, reason: 'replaced' });
        this.bullets = this.bullets.filter(b => !remove.has(b));
      }
      const projectile = createProjectile(ship, ship.angle, kind, this.time);
      this.bullets.push({ ...projectile, trail: [] });
      this.events.push({ type: 'shot', owner: id, kind, position: { x: projectile.x, y: projectile.y } });
    }
    return true;
  }
  private attack(victim: PlayerId, owner: PlayerId, deaths: Map<PlayerId, Death>, bullet?: Bullet): void {
    if (deaths.has(victim) || !this.ships[victim - 1].alive) return;
    const ship = this.ships[victim - 1];
    if (blockAttack(ship)) {
      this.events.push({ type: 'mechanic', sound: 'shieldBreak', position: { x: ship.x, y: ship.y } });
    } else deaths.set(victim, { victim, owner, cause: victim === owner ? 'self' : 'shot',
      ...(bullet && victim !== owner ? { highlight: shotHighlight(bullet) } : {}) });
  }
  isPickupSafe(point: Vec2, time = this.time): boolean {
    return !this.map.bodies.some(body => {
      const p = bodyPosition(body, time);
      return Math.hypot(point.x - p.x, point.y - p.y) < body.collisionRadius + C.SHIP_RADIUS + C.POWERUP_RADIUS + 16 ||
        inPulsarBeam({ ...point, radius: C.POWERUP_RADIUS }, body, time);
    }) && ![this.map.player1Spawn, this.map.player2Spawn, ...this.map.extraEnemySpawns ?? []].some(spawn => Math.hypot(spawn.x - point.x, spawn.y - point.y) < 140);
  }
  private updatePickups(deaths: Map<PlayerId, Death>): void {
    for (const pickup of this.pickups) pickup.age += C.PHYSICS_DT;
    this.pickups = this.pickups.filter(pickup => pickup.age < C.POWERUP_LIFETIME && !this.map.bodies.some(body => {
      const p = bodyPosition(body, this.time);
      return Math.hypot(pickup.x - p.x, pickup.y - p.y) < body.collisionRadius + pickup.radius;
    }));
    this.pickupIn -= C.PHYSICS_DT;
    const points = this.map.powerUpSpawnPoints ?? [], types = this.map.powerUps ?? [];
    if (this.pickupIn <= 0 && types.length && points.length) {
      if (this.pickups.length < C.POWERUP_MAX_COUNT) {
        for (let i = 0; i < points.length; i++) {
          const index = (this.spawnCursor + i) % points.length, p = points[index];
          if (!this.isPickupSafe(p) || !this.isPickupSafe(p, this.time + 1) || this.pickups.some(other => Math.hypot(other.x - p.x, other.y - p.y) < 60)) continue;
          this.pickups.push(createPickup(this.pickupSequence, types[this.pickupSequence % types.length], p));
          this.pickupSequence++; this.spawnCursor = (index + 1) % points.length; break;
        }
      }
      this.pickupIn = C.POWERUP_SPAWN_INTERVAL;
    }
    this.pickups = this.pickups.filter(pickup => {
      const candidates = this.ships.filter(ship => ship.alive && !deaths.has(ship.id) &&
        Math.hypot(ship.x - pickup.x, ship.y - pickup.y) < ship.radius + pickup.radius)
        .sort((a, b) => Math.hypot(a.x - pickup.x, a.y - pickup.y) - Math.hypot(b.x - pickup.x, b.y - pickup.y));
      const ship = candidates[0]; if (!ship) return true;
      applyPickup(ship, pickup.type);
      this.events.push({ type: 'mechanic', sound: pickup.type === 'shield' ? 'shieldActivate' : 'pickup',
        position: { x: ship.x, y: ship.y }, pickupType: pickup.type, owner: ship.id });
      return false;
    });
  }
  step(controls: readonly ShipControl[]): void {
    if (this.phase === 'matchOver') return;
    if (this.phase !== 'playing') {
      this.phaseTime = Math.max(0, this.phaseTime - C.PHYSICS_DT);
      if (this.phaseTime < 1e-9) { if (this.phase === 'ready') this.phase = 'playing'; else this.respawn(); }
      return;
    }
    const previous = this.ships.map(ship => ({ x: ship.x, y: ship.y }));
    const deaths = new Map<PlayerId, Death>();
    for (const ship of this.ships) {
      const hazard = ship.update(C.PHYSICS_DT, controls[ship.id - 1] ?? IDLE_CONTROL, this.map.bodies, this.time, this.map.shipGravity);
      if (hazard) deaths.set(ship.id, { victim: ship.id, cause: 'hazard' });
    }
    for (const ship of this.ships) {
      if (!ship.alive || deaths.has(ship.id) || ship.portalCooldown > 1e-9) continue;
      const gates = this.map.wormholes ?? [], start = previous[ship.id - 1];
      const entry = gates.map(gate => ({ gate, t: segmentCircleContact(start, ship, gate, ship.radius) }))
        .filter(contact => contact.t !== null && gates.some(exit => exit.id === contact.gate.exitId))
        .sort((a, b) => a.t! - b.t!)[0]?.gate;
      if (!entry) continue;
      teleportShip(ship, entry, gates.find(gate => gate.id === entry.exitId)!);
      // The portal gap is not a movement/collision segment.
      previous[ship.id - 1] = { x: ship.x, y: ship.y };
      const hazard = ship.update(0, IDLE_CONTROL, this.map.bodies, this.time + C.PHYSICS_DT, this.map.shipGravity);
      if (hazard) deaths.set(ship.id, { victim: ship.id, cause: 'hazard' });
      this.events.push({ type: 'mechanic', sound: 'teleport', position: { x: ship.x, y: ship.y }, owner: ship.id });
    }
    this.updatePickups(deaths);
    for (const ship of this.ships) if (!deaths.has(ship.id) && controls[ship.id - 1]?.fire) this.fire(ship.id);
    const targets = this.ships.map((ship, i) => ({ id: ship.id, x: ship.x, y: ship.y, radius: ship.radius, alive: ship.alive, previous: previous[i] }));
    for (const beam of this.laserBeams) beam.age += C.PHYSICS_DT;
    this.laserBeams = this.laserBeams.filter(beam => beam.age < 0.18);
    for (const ship of this.ships) {
      if (!ship.laserCharge || deaths.has(ship.id)) continue;
      ship.laserCharge.remaining -= C.PHYSICS_DT;
      if (ship.laserCharge.remaining > 1e-9) continue;
      const beam = traceLaser(ship, this.map.bodies, targets.filter(t => this.canHit(ship.id, t.id)), this.time + C.PHYSICS_DT, ship.laserCharge.angle);
      ship.laserCharge = null; this.laserBeams.push({ ...beam, age: 0, owner: ship.id });
      this.events.push({ type: 'laser', owner: ship.id, position: beam.end });
      if (beam.event?.type === 'ship') this.attack(beam.event.shipId, ship.id, deaths);
    }
    const survivors: Bullet[] = [];
    for (const bullet of this.bullets) {
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      const trailLimit = bullet.orbitState ? 72 : bullet.kind === 'homing' ? 96 : 24;
      if (bullet.trail.length > trailLimit) bullet.trail.shift();
      const event = stepProjectile(bullet, this.map.bodies, targets.filter(t => this.canHit(bullet.ownerId, t.id)), { time: this.time, wormholes: this.map.wormholes });
      if (bullet.teleport) { bullet.trail = []; this.events.push({ type: 'mechanic', sound: 'teleport', position: bullet.teleport.to }); }
      if (bullet.justCaptured) this.events.push({ type: 'mechanic', sound: 'orbitLock', position: { x: bullet.x, y: bullet.y } });
      if (!event) { survivors.push(bullet); continue; }
      if (event.type === 'ship') this.attack(event.shipId, bullet.ownerId, deaths, bullet);
      if (bullet.kind === 'orbital') {
        const reason = event.type === 'body' || event.type === 'ship' ? 'collision' : event.type === 'expired' ? 'expired' : 'lost';
        this.events.push({ type: 'orbitalEnd', position: { x: bullet.x, y: bullet.y }, owner: bullet.ownerId, reason,
          ...(event.type === 'body' ? { bodyId: event.bodyId } : {}) });
      } else if (event.type === 'body') this.events.push({ type: 'impact', position: { x: bullet.x, y: bullet.y }, kind: bullet.kind });
    }
    this.bullets = survivors; this.time += C.PHYSICS_DT;
    if (deaths.size) this.resolveDeaths([...deaths.values()]);
  }
  private canHit(owner: PlayerId, target: PlayerId): boolean { return this.freeForAll || owner === 1 || target === 1 || owner === target; }
  private resolveDeaths(deaths: Death[]): void {
    for (const death of deaths) {
      this.deathCounts[death.victim]++;
      const ship = this.ships[death.victim - 1]; ship.alive = false; ship.laserCharge = null; ship.thrusting = false;
      this.events.push({ type: 'death', victim: death.victim, owner: death.owner, position: { x: ship.x, y: ship.y }, highlight: death.highlight });
      if (this.ships.length > 2 && death.victim > 1 && death.cause === 'shot' && death.highlight && (!this.freeForAll || death.owner === 1)) this.roundHighlights.add(death.highlight);
    }
    const playerDead = !this.ships[0].alive, enemiesDead = this.ships.slice(1).every(ship => !ship.alive);
    const living = this.ships.filter(ship => ship.alive);
    if (this.freeForAll ? living.length > 1 : this.ships.length > 2 && !playerDead && !enemiesDead) return;
    this.draw = this.freeForAll ? living.length === 0 : this.ships.length === 2 ? deaths.length === 2 : playerDead && enemiesDead;
    this.lastDeath = deaths.find(d => d.victim === 1) ?? deaths[0]; this.bullets = [];
    for (const ship of this.ships) { ship.thrusting = false; ship.laserCharge = null; }
    if (!this.draw) {
      const scorer = this.freeForAll ? living[0].id : this.ships.length === 2 ? otherPlayer(deaths[0].victim) : playerDead ? 2 : 1;
      this.roundWinner = scorer; this.scores[scorer]++;
      const scoredDeath = deaths.find(death => this.freeForAll ? death.owner === scorer : otherPlayer(death.victim) === scorer);
      if (scoredDeath?.cause === 'shot' && scoredDeath.highlight) this.scoringHighlights[scorer].add(scoredDeath.highlight);
      if (scorer === 1) for (const highlight of this.roundHighlights) this.scoringHighlights[1].add(highlight);
      if (this.scores[scorer] >= this.targetScore) this.winner = scorer;
    }
    this.phase = this.winner ? 'matchOver' : 'roundOver'; this.phaseTime = C.RESPAWN_DELAY;
  }
}
