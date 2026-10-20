export type PauseReason = 'manual' | 'blur' | 'hidden' | 'orientation' | 'ad';
export class PauseState {
  private reasons = new Set<PauseReason>();
  private listeners = new Set<() => void>();
  get paused(): boolean { return this.reasons.size > 0; }
  has(reason: PauseReason): boolean { return this.reasons.has(reason); }
  set(reason: PauseReason, value: boolean): void {
    if (this.has(reason) === value) return;
    if (value) this.reasons.add(reason); else this.reasons.delete(reason);
    for (const listener of this.listeners) listener();
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
export interface PokiSDK {
  init(): Promise<void>; gameLoadingFinished(): void; gameplayStart(): void; gameplayStop(): void;
  commercialBreak(): Promise<unknown>;
}
export class PokiLifecycle {
  private sdk?: PokiSDK; private ready = false; private loadingSent = false; private wantsGameplay = false;
  private gameplaySent = false; private pending: Promise<void> | null = null; private unsubscribe: () => void;
  constructor(readonly pause: PauseState) { this.unsubscribe = pause.subscribe(() => this.sync()); }
  async attach(sdk: PokiSDK): Promise<void> {
    try { await sdk.init(); this.sdk = sdk; this.sync(); } catch { /* SDK failure must not prevent play. */ }
  }
  markGameReady(): void { this.ready = true; this.sync(); }
  setGameplay(value: boolean): void { this.wantsGameplay = value; this.sync(); }
  private sync(): void {
    if (!this.sdk || !this.ready) return;
    try {
      if (!this.loadingSent) { this.sdk.gameLoadingFinished(); this.loadingSent = true; }
      const active = this.wantsGameplay && !this.pause.paused;
      if (active !== this.gameplaySent) { if (active) this.sdk.gameplayStart(); else this.sdk.gameplayStop(); this.gameplaySent = active; }
    } catch { this.sdk = undefined; this.gameplaySent = false; }
  }
  commercialBreak(): Promise<void> {
    if (this.pending) return this.pending;
    if (!this.sdk) return Promise.resolve();
    const sdk = this.sdk;
    this.pause.set('ad', true);
    this.pending = Promise.resolve().then(() => sdk.commercialBreak()).then(() => {}, () => {}).finally(() => {
      this.pending = null; this.pause.set('ad', false);
    });
    return this.pending;
  }
  destroy(): void { this.setGameplay(false); this.unsubscribe(); }
}
