import Phaser from 'phaser';
import { WORLD } from './config.js';
import { GameScene } from './scenes/GameScene.js';
import { TutorialScene } from './scenes/TutorialScene.js';
import { HangarScene } from './scenes/HangarScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { MapSelectScene } from './scenes/MapSelectScene.js';
import { installPlatform, pause, platform, sound, profile, initializePlatform } from './platform/runtime.js';
import './style.css';
const cleanup = installPlatform();
async function boot(): Promise<void> {
await initializePlatform();
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: WORLD.width, height: WORLD.height,
  backgroundColor: '#0b1830', antialias: true, input: { activePointers: 4 },
  audio: { noAudio: true }, // Sound owns the single audio context and platform mute policy.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { roundPixels: false }, scene: [MenuScene, HangarScene, MapSelectScene, TutorialScene, GameScene],
  callbacks: { postBoot: instance => {
    document.getElementById('loading')?.remove();
    instance.canvas.tabIndex = 0;
    instance.canvas.setAttribute('aria-label', 'Gravity Duel v0.11.1. Three units, 27 levels. WASD to move, mouse to aim and fire. Touch: left stick moves, right stick aims and fires. Classic controls available in menu.');
    instance.events.once(Phaser.Core.Events.DESTROY, cleanup);
  } }, banner: false,
});
// Development-only inspection hook. Vite removes this block from the production build.
if (import.meta.env.DEV) Object.assign(window, { __gravity: { game, pause, platform, sound, profile, initializePlatform } });

}
void boot();
