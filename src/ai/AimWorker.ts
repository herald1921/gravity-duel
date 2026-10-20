import { findAimSolution } from './SpaceAI.js';
import type { AimRequest } from './TrajectoryPlanner.js';
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AimRequest & { id: number }>) => void) | null;
  postMessage(message: unknown): void;
};
scope.onmessage = ({ data }) => {
  try { scope.postMessage({ id: data.id, solution: findAimSolution(data.self, data.target, data.bodies, data.context, data.weapon) }); }
  catch { scope.postMessage({ id: data.id, solution: null }); }
};
