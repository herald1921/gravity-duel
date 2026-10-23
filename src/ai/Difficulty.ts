export interface Difficulty {
  reaction: number; aimError: number; fireDelay: number; interval: number; windup: number;
  lead: number; seekPickups: boolean; dodge: boolean; independentAim: boolean;
}
export function difficultyFor(index: number): Difficulty {
  const n = Math.max(0, Math.min(26, index));
  // Only the six planet/moon lessons use the beginner ramp. Stellar systems
  // start with a complete pilot; new mechanics never reset learned tactics.
  const p = n < 6 ? n / 5 : (n - 6) / 20;
  if (n < 6) return { reaction: 1.35 - p * 0.55, aimError: 11 - p * 6,
    fireDelay: 0.55 - p * 0.17, interval: 3.8 - p * 1.2, windup: 0.6 - p * 0.2,
    lead: n < 3 ? 0 : (n - 2) * 0.12, seekPickups: n >= 2, dodge: n >= 4, independentAim: n >= 5 };
  return { reaction: 0.65 - p * 0.33, aimError: 3.8 - p * 2.4,
    fireDelay: 0.32 - p * 0.14, interval: 2.3 - p * 1.15, windup: 0.34 - p * 0.16,
    lead: 0.55 + p * 0.35, seekPickups: true, dodge: true, independentAim: true };
}
