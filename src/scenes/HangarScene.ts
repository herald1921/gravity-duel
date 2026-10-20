import Phaser from 'phaser';
import { BADGES, PAINTS } from '../game/Rewards.js';
import { pause, platform, profile, sound } from '../platform/runtime.js';
import { drawBackground, drawShip, label } from '../rendering/draw.js';
import { bindMenuKeys } from '../ui/menu.js';
import { button } from '../ui/widgets.js';
export class HangarScene extends Phaser.Scene {
  constructor() { super('Hangar'); }
  create(): void {
    platform.setGameplay(false); drawBackground(this);
    label(this, 64, 38, 'PILOT HANGAR', 36, '#77eee3');
    label(this, 64, 90, 'Earn badges in Arcade or 1-player practice.', 20, '#a4b6c7');
    button(this, 1042, 25, 198, 72, 'BACK', () => this.scene.start('Menu'));
    BADGES.forEach((badge, i) => {
      const earned = profile.data.badges.includes(badge.id), y = 155 + i * 119;
      this.add.graphics().fillStyle(0x10212e).fillRoundedRect(64, y, 584, 102, 12)
        .lineStyle(1.5, earned ? 0xffcf70 : 0x42576a).strokeRoundedRect(64, y, 584, 102, 12);
      label(this, 86, y + 18, (earned ? '★  ' : '○  ') + badge.name, 24, earned ? '#ffcf70' : '#a4b6c7');
      label(this, 86, y + 62, badge.description, 18, '#a4b6c7');
    });
    const g = this.add.graphics(); g.save().translateCanvas(924, 205).scaleCanvas(3.3, 3.3);
    drawShip(g, { x: 0, y: 0, id: 1, angle: -0.4, thrusting: false }, 0, profile.paintColor); g.restore();
    label(this, 924, 295, 'YOUR SHIP · ' + profile.data.badges.length + ' / 4 BADGES', 20, '#77eee3').setOrigin(0.5);
    PAINTS.forEach((paint, i) => {
      const unlocked = profile.data.badges.length >= paint.badges;
      const text = paint.name + (profile.data.paint === paint.id ? ' · EQUIPPED' : unlocked ? ' · EQUIP' : ' · ' + paint.badges + ' BADGES');
      button(this, 716, 335 + i * 73, 416, 60, text, () => {
        if (unlocked && profile.equipPaint(paint.id)) { sound.play('pickup'); this.scene.restart(); }
      }, unlocked ? paint.color : 0x526779);
    });
    label(this, 640, 665, profile.persistent ? 'Paint changes your hull. Your handling and firepower stay the same.' : 'Progress lasts only this visit.', 18, profile.persistent ? '#a4b6c7' : '#ffcf70').setOrigin(0.5);
    bindMenuKeys(this, key => { if (!pause.paused && key === 'Escape') this.scene.start('Menu'); });
  }
}
