import { isBadge, PAINTS, type BadgeId, type PaintId } from '../game/Rewards.js';
import { ARCADE } from '../game/Arcade.js';
export const SAVE_KEY = 'gravity-duel-campaign-v0100';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface ProfileData { version: 1; runIndex: number | null; cleared: number[]; tutorialDone: boolean; music: boolean; sfx: boolean; badges: BadgeId[]; paint: PaintId; controls: 'modern' | 'classic' }
const fresh = (): ProfileData => ({ version: 1, runIndex: null, cleared: [], tutorialDone: false, music: true, sfx: true, badges: [], paint: 'teal', controls: 'modern' });
const arenaIndex = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < ARCADE.length;
export class Profile {
  data = fresh(); persistent = true;
  constructor(private storage: () => StorageLike = () => window.localStorage) {
    this.load();
  }
  /** Called only before the first scene; platform saves are authoritative. */
  useStorage(storage: () => StorageLike): void {
    this.storage = storage; this.data = fresh(); this.persistent = true; this.load();
    // A failed cloud read must not later overwrite an existing save with defaults.
    if (!this.persistent) this.storage = () => { throw new Error('Save read failed; reload to retry'); };
  }
  private load(): void {
    try {
      const current = this.storage().getItem(SAVE_KEY);
      const raw = current ?? this.storage().getItem('gravity-duel-playtest-v090');
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1) return;
      const s = saved as Partial<ProfileData>;
      const badges = Array.isArray(s.badges) ? [...new Set(s.badges.filter(isBadge))] : [];
      const paint = PAINTS.find(p => p.id === s.paint && p.badges <= badges.length)?.id ?? 'teal';
      this.data = { version: 1, runIndex: arenaIndex(s.runIndex) ? s.runIndex : null,
        cleared: Array.isArray(s.cleared) ? [...new Set(s.cleared.filter(arenaIndex))] : [],
        tutorialDone: s.tutorialDone === true, music: s.music !== false, sfx: s.sfx !== false, badges, paint, controls: s.controls === 'classic' ? 'classic' : 'modern' };
      if (!current) { this.data.runIndex = null; this.data.cleared = []; }
    } catch { this.persistent = false; }
  }
  private save(): void {
    try { this.storage().setItem(SAVE_KEY, JSON.stringify(this.data)); this.persistent = true; }
    catch { this.persistent = false; }
  }
  begin(index: number): void { if (arenaIndex(index)) { this.data.runIndex = index; this.save(); } }
  clearArena(index: number): void {
    if (!arenaIndex(index)) return;
    if (!this.data.cleared.includes(index)) this.data.cleared.push(index);
    this.data.runIndex = index + 1 < ARCADE.length ? index + 1 : null; this.save();
  }
  awardBadges(ids: readonly BadgeId[]): BadgeId[] {
    const added = [...new Set(ids.filter(isBadge))].filter(id => !this.data.badges.includes(id));
    if (added.length) { this.data.badges.push(...added); this.save(); }
    return added;
  }
  equipPaint(id: PaintId): boolean {
    const paint = PAINTS.find(p => p.id === id && p.badges <= this.data.badges.length);
    if (!paint) return false;
    this.data.paint = paint.id; this.save(); return true;
  }
  get paintColor(): number { return PAINTS.find(p => p.id === this.data.paint)!.color; }
  finishTutorial(): void { this.data.tutorialDone = true; this.save(); }
  setControls(controls: 'modern' | 'classic'): void { this.data.controls = controls; this.save(); }
  setAudio(music: boolean, sfx: boolean): void { this.data.music = music; this.data.sfx = sfx; this.save(); }
}
