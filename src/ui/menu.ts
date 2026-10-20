import Phaser from 'phaser';
import { label } from '../rendering/draw.js';

export function bindMenuKeys(scene: Phaser.Scene, callback: (key: string) => void): void {
  const keyboard = scene.input.keyboard!;
  keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE,ENTER');
  keyboard.resetKeys();
  const handler = (event: KeyboardEvent) => {
    if (!event.repeat && scene.scene.isActive()) { event.stopPropagation(); callback(event.code); }
  };
  keyboard.on('keydown', handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    keyboard.off('keydown', handler); keyboard.resetKeys();
  });
}

export class MenuCard {
  readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, x: number, y: number, private readonly width: number,
    private readonly height: number, private readonly accent: number,
    onFocus: () => void, onChoose: () => void) {
    this.panel = scene.add.graphics();
    const zone = scene.add.zone(0, 0, width, height).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', onFocus);
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (pointer.wasTouch || pointer.leftButtonDown()) onChoose(); });
    this.container = scene.add.container(x, y, [this.panel, zone]);
    this.select(false);
  }
  select(selected: boolean): void {
    this.panel.clear().fillStyle(selected ? 0x122633 : 0x0b1523, 0.98).fillRoundedRect(0, 0, this.width, this.height, 9)
      .lineStyle(selected ? 1.5 : 1, selected ? this.accent : 0x293747, selected ? 0.85 : 0.65)
      .strokeRoundedRect(0, 0, this.width, this.height, 9);
    if (selected) this.panel.fillStyle(this.accent, 0.9).fillRoundedRect(0, 21, 3, this.height - 42, 1);
  }
  text(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#e7f1fa'): void {
    this.container.add(label(scene, x, y, text, size, color));
  }
}
