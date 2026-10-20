import { PauseState, PokiLifecycle, type PokiSDK } from './Lifecycle.js';
import { Sound } from '../rendering/Sound.js';
import { Profile } from './Profile.js';
import { CrazyGamesLifecycle, within, type CrazySDK } from './CrazyGames.js';
const isPlaytest = import.meta.env.VITE_GAME_PLATFORM === 'playtest';
export const isCrazyGames = import.meta.env.VITE_GAME_PLATFORM === 'crazygames';
const unavailableStorage = () => { throw new Error('Platform save unavailable'); };
export const profile = new Profile(isCrazyGames ? unavailableStorage : undefined);
export const pause = new PauseState();
export const sound = new Sound(profile.data.sfx, profile.data.music, () => profile.setAudio(sound.musicEnabled, sound.enabled));
let platformMuted = false, platformLoading = isCrazyGames;
const syncAudio = () => sound.setBlocked(pause.paused || platformMuted || platformLoading);
export const platform = isCrazyGames ? new CrazyGamesLifecycle(pause, muted => { platformMuted = muted; syncAudio(); }) : new PokiLifecycle(pause);
export async function initializePlatform(): Promise<void> {
  if (!(platform instanceof CrazyGamesLifecycle)) return;
  const host = window as Window & { CrazyGames?: { SDK: CrazySDK } };
  try {
    if (!host.CrazyGames?.SDK) {
      const script = document.createElement('script');
      script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'; script.async = true;
      await within(new Promise<void>((resolve, reject) => {
        script.onload = () => resolve(); script.onerror = () => reject(new Error('SDK unavailable'));
        document.head.append(script);
      }), 15000);
    }
    if (host.CrazyGames?.SDK && await platform.attach(host.CrazyGames.SDK) && platform.storage) {
      const storage = platform.storage;
      profile.useStorage(() => storage);
      sound.enabled = profile.data.sfx; sound.musicEnabled = profile.data.music;
    }
  } catch { /* Play remains available with a clearly indicated session-only save. */ }
  finally { platformLoading = false; syncAudio(); }
}
export const device = { touch: navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || (import.meta.env.DEV && new URLSearchParams(location.search).has('touch')) };
export const seenMechanics = new Set<string>();
export function installPlatform(): () => void {
  let allowPortrait = false;
  const continueButton = document.getElementById('orientation-continue');
  const orientation = () => {
    const blocked = device.touch && innerHeight > innerWidth && !allowPortrait;
    const overlay = document.getElementById('orientation'); if (overlay) overlay.hidden = !blocked;
    pause.set('orientation', blocked);
  };
  const continueInPortrait = () => { allowPortrait = true; orientation(); if (!pause.paused) sound.unlock(); };
  const hidden = () => pause.set('hidden', document.hidden);
  const blur = () => pause.set('blur', true);
  const focus = () => { pause.set('blur', false); hidden(); orientation(); };
  const unlock = () => { if (!pause.paused) sound.unlock(); };
  const unsubscribe = pause.subscribe(syncAudio);
  window.addEventListener('resize', orientation); window.addEventListener('blur', blur); window.addEventListener('focus', focus);
  window.addEventListener('orientationchange', orientation);
  window.screen.orientation?.addEventListener('change', orientation);
  window.visualViewport?.addEventListener('resize', orientation);
  continueButton?.addEventListener('click', continueInPortrait);
  document.addEventListener('visibilitychange', hidden); document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
  orientation(); hidden(); syncAudio();
  const host = window as Window & { PokiSDK?: PokiSDK };
  if (!isPlaytest && platform instanceof PokiLifecycle && host.PokiSDK) void platform.attach(host.PokiSDK);
  else if (!isPlaytest && platform instanceof PokiLifecycle && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    const script = document.createElement('script'); script.src = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js'; script.async = true;
    script.onload = () => { if (host.PokiSDK && platform instanceof PokiLifecycle) void platform.attach(host.PokiSDK); };
    script.onerror = () => {}; document.head.append(script);
  }
  return () => {
    unsubscribe(); window.removeEventListener('resize', orientation); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
    window.removeEventListener('orientationchange', orientation);
    window.screen.orientation?.removeEventListener('change', orientation);
    window.visualViewport?.removeEventListener('resize', orientation);
    continueButton?.removeEventListener('click', continueInPortrait);
    document.removeEventListener('visibilitychange', hidden); document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock);
    platform.destroy(); sound.destroy();
  };
}
