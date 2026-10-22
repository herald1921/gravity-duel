export interface Difficulty {
  reaction: number; aimError: number; fireDelay: number; interval: number; windup: number;
  lead: number; seekPickups: boolean; dodge: boolean; independentAim: boolean;
}
export function difficultyFor(index: number): Difficulty {
  const n = Math.max(0, Math.min(26, index)), p = n / 26;
  return { reaction: 1.35 - p * 1.03, aimError: 11 - p * 9.6, fireDelay: 0.55 - p * 0.37,
    interval: 3.8 - p * 2.65, windup: 0.6 - p * 0.42,
    lead: n < 4 ? 0 : Math.min(0.9, (n - 3) * 0.045), seekPickups: n >= 3, dodge: n >= 6, independentAim: n >= 12 };
}
