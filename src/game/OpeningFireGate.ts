// Early arcade opponents visibly prepare a shot. Later arenas retain normal AI timing.
export class OpeningFireGate {
  private age: number | null = null;
  private elapsed = 0;
  readonly interval: number;
  readonly windup: number;
  constructor(index: number | null, timing?: { interval: number; windup: number }) {
    this.interval = timing?.interval ?? (index === 0 ? 3.2 : index === 1 ? 2.6 : 0);
    this.windup = timing?.windup ?? (index === 0 ? 0.55 : index === 1 ? 0.35 : 0);
  }
  reset(): void { this.age = null; this.elapsed = 0; }
  get warning(): boolean { return this.age !== null; }
  step(dt: number, wantsFire: boolean, ready: boolean): boolean {
    if (!this.prepare(dt, wantsFire, ready)) return false;
    this.consume(); return true;
  }
  /** Preparation is per pilot; squad arbitration must not reset or delay a partner's timer. */
  prepare(dt: number, wantsFire: boolean, ready: boolean): boolean {
    if (!this.windup) return wantsFire && ready;
    this.elapsed += dt;
    if (!ready) { this.age = null; return false; }
    if (this.elapsed < this.interval) return false;
    if (this.age === null && wantsFire) this.age = 0;
    if (this.age === null) return false;
    this.age += dt;
    if (this.age > 1.8) { this.age = null; return false; }
    if (this.age < this.windup || !wantsFire) return false;
    return true;
  }
  consume(): void { this.age = null; this.elapsed = 0; }
}
