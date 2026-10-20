import type { ShipControl } from '../entities/Ship.js';
export type TouchAction = 'left' | 'right' | 'thrust' | 'fire';
export const STICK_DEAD_ZONE = 0.18;
export class TouchState {
  private pointers = new Map<number, TouchAction>();
  private stick?: { id: number; x: number; y: number };
  private pendingFire = false;
  private aimStick?: { id: number; x: number; y: number };
  private lastAim?: number;
  constructor(private dual = false) {}
  beginAim(id: number, x: number, y: number): boolean {
    if (this.aimStick || this.stick?.id === id || this.pointers.has(id)) return false;
    this.aimStick = { id, x: 0, y: 0 }; this.moveAim(id, x, y); return true;
  }
  moveAim(id: number, x: number, y: number): void {
    if (this.aimStick?.id !== id || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const length = Math.max(1, Math.hypot(x, y));
    this.aimStick.x = x / length; this.aimStick.y = y / length;
    if (Math.hypot(x, y) > 0.22) this.lastAim = Math.atan2(y, x);
  }
  get aimPosition(): { x: number; y: number; held: boolean } {
    return { x: this.aimStick?.x ?? 0, y: this.aimStick?.y ?? 0, held: !!this.aimStick };
  }
  press(id: number, action: TouchAction): void {
    if (this.stick?.id === id || this.aimStick?.id === id) return;
    this.pointers.set(id, action); if (action === 'fire') this.pendingFire = true;
  }
  beginStick(id: number, x: number, y: number): boolean {
    if (this.stick || this.aimStick?.id === id || this.pointers.has(id)) return false;
    this.stick = { id, x: 0, y: 0 }; this.moveStick(id, x, y); return true;
  }
  moveStick(id: number, x: number, y: number): void {
    if (this.stick?.id !== id || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const length = Math.max(1, Math.hypot(x, y));
    this.stick.x = x / length; this.stick.y = y / length;
  }
  get stickPosition(): { x: number; y: number; held: boolean } {
    return { x: this.stick?.x ?? 0, y: this.stick?.y ?? 0, held: !!this.stick };
  }
  release(id: number): void { this.pointers.delete(id); if (this.stick?.id === id) this.stick = undefined; if (this.aimStick?.id === id) this.aimStick = undefined; }
  clear(): void { this.pointers.clear(); this.stick = undefined; this.aimStick = undefined; this.lastAim = undefined; this.pendingFire = false; }
  consumeFire(): void { this.pendingFire = false; }
  down(action: TouchAction): boolean { return [...this.pointers.values()].includes(action); }
  control(): ShipControl {
    const { x, y } = this.stickPosition, length = Math.hypot(x, y);
    const gain = length > STICK_DEAD_ZONE ? (length - STICK_DEAD_ZONE) / ((1 - STICK_DEAD_ZONE) * length) : 0;
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    return { turn: clamp(Number(this.down('right')) - Number(this.down('left'))),
      thrust: Number(this.down('thrust')), fire: this.down('fire') || this.pendingFire || (this.dual && Math.hypot(this.aimStick?.x ?? 0, this.aimStick?.y ?? 0) > 0.22),
      ...(this.dual ? { independentAim: true, ...(this.lastAim === undefined ? {} : { aim: this.lastAim }) } : {}),
      ...(gain > 0 ? { move: { x: x * gain, y: y * gain } } : {}) };
  }
}
