import { createProjectile, type Launcher } from '../entities/Bullet.js';
import { bodyPosition, type CelestialBody } from '../entities/CelestialBody.js';
import { simulateTrajectory, type CollisionTarget, type SpaceContext, type Trajectory, type Vec2 } from '../physics/gravity.js';

export interface OrbitalDeployment { bodyId: string; coverageDistance: number }
export interface OrbitalAim { angle: number; distance: number; trajectory: Trajectory; orbital: OrbitalDeployment }

function laneDistance(point: Vec2, self: Vec2, target: Vec2): number {
  const dx = self.x - target.x, dy = self.y - target.y;
  const t = ((point.x - target.x) * dx + (point.y - target.y) * dy) / Math.max(1, dx * dx + dy * dy);
  // Only the contested middle of the approach lane counts as area denial.
  if (t < 0.15 || t > 0.8) return Infinity;
  return Math.hypot(point.x - target.x - t * dx, point.y - target.y - t * dy);
}

/** Deploy onto a useful planet/moon, even when the enemy is not on its ring yet.
 * All captures and subsequent arcs use live projectile physics and future body motion.
 * Limit the expensive orbit checks to eight candidates, at most two per host. */
export function findOrbitalDeployment(self: Launcher & CollisionTarget, target: CollisionTarget,
  bodies: readonly CelestialBody[], context: SpaceContext): OrbitalAim | null {
  if (!bodies.some(b => (b.type === 'planet' || b.type === 'moon') && b.orbitCaptureRadius)) return null;
  const candidates: { angle: number; flight: Trajectory; rank: number }[] = [];
  for (let i = 0; i < 120; i++) {
    const angle = i * Math.PI * 2 / 120;
    const flight = simulateTrajectory(createProjectile(self, angle, 'orbital'), bodies, [self], 3, 4, { ...context, maxOrbitArc: 1e-6 });
    const orbit = flight.end.orbitState;
    if (flight.event || !orbit) continue;
    const host = bodies.find(b => b.id === orbit.bodyId)!;
    const center = bodyPosition(host, flight.end.time!);
    const range = Math.hypot(target.x - center.x, target.y - center.y);
    const ringGap = Math.max(0, range - orbit.apoapsis, orbit.periapsis - range);
    candidates.push({ angle, flight, rank: ringGap + flight.elapsed * 12 });
  }
  candidates.sort((a, b) => a.rank - b.rank);
  const hostCounts = new Map<string, number>();
  let checked = 0, best: OrbitalAim | null = null, bestScore = Infinity;
  for (const { angle, flight } of candidates) {
    const orbit = flight.end.orbitState!, count = hostCounts.get(orbit.bodyId) ?? 0;
    if (count >= 2) continue;
    hostCounts.set(orbit.bodyId, count + 1);
    const duration = Math.min(12, Math.max(4, Math.PI * 2 / orbit.meanMotion));
    const arc = simulateTrajectory(flight.end, bodies, [self], duration, 4,
      { wormholes: context.wormholes, maxOrbitArc: Math.PI * 2 });
    // Do not deploy a ring that soon hits its owner, another body or a wormhole.
    if (!arc.event && arc.end.orbitState?.bodyId === orbit.bodyId &&
        (arc.end.portalVisits ?? 0) === (flight.end.portalVisits ?? 0)) {
      let distance = Infinity, lane = Infinity;
      for (const point of arc.points) {
        distance = Math.min(distance, Math.hypot(point.x - target.x, point.y - target.y));
        lane = Math.min(lane, laneDistance(point, self, target));
      }
      const useful = distance <= 240 || (lane <= 65 && distance <= 420);
      const score = distance + Math.min(lane, 240) * 0.35 + flight.elapsed * 12;
      if (useful && score < bestScore) {
        bestScore = score;
        best = { angle, distance, orbital: { bodyId: orbit.bodyId, coverageDistance: distance },
          trajectory: { points: [...flight.points, ...arc.points.slice(1)], end: arc.end,
            event: null, elapsed: flight.elapsed + arc.elapsed } };
      }
    }
    if (++checked >= 8) break;
  }
  return best;
}
