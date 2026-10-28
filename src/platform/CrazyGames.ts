import { PauseState } from './Lifecycle.js';
import type { StorageLike } from './Profile.js';
import type { MultiplayerAPI } from './CrazyMultiplayer.js';

export interface CrazySDK {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  data: StorageLike;
  game: MultiplayerAPI & {
    loadingStart?(): void; loadingStop?(): void;
    gameplayStart(): void; gameplayStop(): void;
    settings: { muteAudio?: boolean };
    addSettingsChangeListener(listener: (settings: { muteAudio?: boolean }) => void): void;
    removeSettingsChangeListener(listener: (settings: { muteAudio?: boolean }) => void): void;
  };
}

/** Stop waiting without allowing a late SDK response to replace an active game's save. */
export async function within<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Platform initialization timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

/** Basic Launch build: intentionally makes no ad requests. */
export class CrazyGamesLifecycle {
  private sdk?: CrazySDK;
  private ready = false; private wantsGameplay = false; private gameplaySent = false;
  private destroyed = false; private unsubscribe: () => void;
  private settingsListener = (settings: { muteAudio?: boolean }) => this.setMuted(settings.muteAudio === true);
  constructor(readonly pause: PauseState, private setMuted: (value: boolean) => void = () => {}) {
    this.unsubscribe = pause.subscribe(() => this.sync());
  }
  async attach(sdk: CrazySDK, timeout = 8000): Promise<boolean> {
    if (this.sdk || this.destroyed) return false;
    try {
      await within(sdk.init(), timeout);
      if (this.destroyed || sdk.environment === 'disabled') return false;
      this.settingsListener(sdk.game.settings);
      sdk.game.addSettingsChangeListener(this.settingsListener);
      this.sdk = sdk;
      try{sdk.game.loadingStart?.();if(this.ready)sdk.game.loadingStop?.();}catch{}
      this.sync(); return true;
    } catch { return false; }
  }
  get storage(): StorageLike | undefined { return this.sdk?.data; }
  markGameReady(): void { if(!this.ready)try{this.sdk?.game.loadingStop?.();}catch{}this.ready = true; this.sync(); }
  setGameplay(value: boolean): void { this.wantsGameplay = value; this.sync(); }
  private sync(): void {
    if (!this.sdk || !this.ready) return;
    // Focus/visibility pauses still freeze local physics and audio; CrazyGames tracks those itself.
    const active = this.wantsGameplay && !['manual', 'orientation', 'ad'].some(reason => this.pause.has(reason as 'manual' | 'orientation' | 'ad'));
    if (active === this.gameplaySent) return;
    try {
      if (active) this.sdk.game.gameplayStart(); else this.sdk.game.gameplayStop();
      this.gameplaySent = active;
    } catch { /* A reporting failure must never interrupt the match. */ }
  }
  commercialBreak(): Promise<void> { return Promise.resolve(); }
  destroy(): void {
    this.setGameplay(false); this.destroyed = true; this.unsubscribe();
    try { this.sdk?.game.removeSettingsChangeListener(this.settingsListener); } catch { /* SDK already unavailable. */ }
  }
}
