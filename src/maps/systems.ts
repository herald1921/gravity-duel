import { createBody, type CelestialBody, type CelestialBodyType, type OrbitAnchor } from '../entities/CelestialBody.js';

/** Prescribed, repeatable game orbits: paired bodies share a barycenter and period.
 * Their radii balance gravitational strengths; this is not a full N-body solver. */
export function binarySystem(center: OrbitAnchor, aType: CelestialBodyType, bType: CelestialBodyType,
  separation: number, period: number, phase: number, radii: [number, number]): CelestialBody[] {
  const a = createBody('primary', aType, center.x, center.y, { radius: radii[0] });
  const b = createBody('secondary', bType, center.x, center.y, { radius: radii[1] });
  const total = a.gravityStrength + b.gravityStrength;
  a.motion = { radius: separation * b.gravityStrength / total, period, phase, ...(center.motion ? { parent: center } : {}) };
  b.motion = { radius: separation * a.gravityStrength / total, period, phase: phase + Math.PI, ...(center.motion ? { parent: center } : {}) };
  return [a, b];
}

export function solarFamily(): CelestialBody[] {
  const sun = createBody('sun', 'star', 640, 375, { radius: 52 });
  const planet = createBody('earth', 'planet', 640, 375, { radius: 27, motion: { radius: 155, period: 36, phase: -0.9 } });
  const moon = createBody('moon', 'moon', 640, 375, { radius: 13,
    motion: { radius: 62, period: 9, phase: 0.8, parent: { x: planet.x, y: planet.y, motion: planet.motion } } });
  return [sun, planet, moon];
}

export function tripleSystem(): CelestialBody[] {
  // A close binary and a distant third body orbit their common barycenter.
  const center = { x: 640, y: 375 }, outerSeparation = 222, outerPeriod = 48;
  const innerCenter = { ...center, motion: { radius: outerSeparation / 3, period: outerPeriod, phase: 0.2 } };
  const pair = binarySystem(innerCenter, 'star', 'star', 122, 14, -0.8, [30, 30]);
  const third = createBody('tertiary', 'star', center.x, center.y, { radius: 35,
    motion: { radius: outerSeparation * 2 / 3, period: outerPeriod, phase: 0.2 + Math.PI } });
  return [...pair, third];
}
