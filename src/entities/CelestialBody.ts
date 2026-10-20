import * as C from '../config.js';
export type CelestialBodyType = 'planet' | 'moon' | 'star' | 'blackHole' | 'pulsar';
export interface CelestialBody {
  id: string; type: CelestialBodyType; x: number; y: number;
  radius: number; collisionRadius: number; gravityStrength: number; softening: number; lethal: boolean;
  orbitCaptureRadius?: number;
  motion?: { radius: number; period: number; phase: number };
  beamPhase?: number;
}
const defaults = {
  planet: { radius: 90, gravityStrength: C.PLANET_GRAVITY, softening: C.PLANET_SOFTENING, lethal: false },
  moon: { radius: 43, gravityStrength: C.MOON_GRAVITY, softening: C.MOON_SOFTENING, lethal: false },
  star: { radius: 115, gravityStrength: C.STAR_GRAVITY, softening: C.STAR_SOFTENING, lethal: true },
  blackHole: { radius: 27, gravityStrength: C.BLACK_HOLE_GRAVITY, softening: C.BLACK_HOLE_SOFTENING, lethal: true },
  pulsar: { radius: 25, gravityStrength: C.PULSAR_GRAVITY, softening: 40, lethal: true },
};
export function createBody(id: string, type: CelestialBodyType, x: number, y: number,
  overrides: Partial<Omit<CelestialBody, 'id' | 'type' | 'x' | 'y'>> = {}): CelestialBody {
  const body = { id, type, x, y, ...defaults[type], ...overrides };
  const collisionRadius = overrides.collisionRadius ?? body.radius;
  return { ...body, collisionRadius, orbitCaptureRadius: overrides.orbitCaptureRadius ??
    (type === 'planet' || type === 'moon' ? collisionRadius + (type === 'moon' ? C.MOON_CAPTURE_PADDING : C.ORBIT_CAPTURE_PADDING) : undefined) };
}
export function bodyPosition(body: CelestialBody, time = 0): { x: number; y: number } {
  if (!body.motion) return body;
  const angle = body.motion.phase + time * Math.PI * 2 / body.motion.period;
  return { x: body.x + body.motion.radius * Math.cos(angle), y: body.y + body.motion.radius * Math.sin(angle) };
}
export function bodyVelocity(body: CelestialBody, time: number): { x: number; y: number } {
  if (!body.motion) return { x: 0, y: 0 };
  const w = Math.PI * 2 / body.motion.period, a = body.motion.phase + w * time;
  return { x: -body.motion.radius * w * Math.sin(a), y: body.motion.radius * w * Math.cos(a) };
}
export function bodyAt(body: CelestialBody, time: number): CelestialBody { return { ...body, ...bodyPosition(body, time) }; }
export function pulsarAngle(body: CelestialBody, time: number): number { return (body.beamPhase ?? 0) + C.PULSAR_ROTATION_SPEED * time; }
export function inPulsarBeam(point: { x: number; y: number; radius: number }, body: CelestialBody, time: number): boolean {
  if (body.type !== 'pulsar') return false;
  const p = bodyPosition(body, time), a = pulsarAngle(body, time), dx = point.x - p.x, dy = point.y - p.y;
  return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= C.PULSAR_BEAM_LENGTH + point.radius &&
    Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= C.PULSAR_BEAM_HALF_WIDTH + point.radius;
}
