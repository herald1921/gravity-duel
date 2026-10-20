import Phaser from 'phaser';
import { FIRE_COOLDOWN } from '../config.js';
import { POWERUP_NAMES } from '../entities/PowerUp.js';
import { otherPlayer, type PlayerId } from '../entities/Ship.js';
import { ARCADE, nextArena } from '../game/Arcade.js';
import { BADGES, PAINTS, defeatTip, type BadgeId } from '../game/Rewards.js';
import type { GameMode, Match } from '../game/Match.js';
import { device, pause, profile } from '../platform/runtime.js';
import { label, playerColor } from '../rendering/draw.js';
import { button, soundButton } from './widgets.js';
interface Actions { pause(): void; resume(): void; restart(): void; menu(): void; next(): void; again(): void }
export class GameHUD {
  private panelArt: Phaser.GameObjects.Graphics; private emblem: Phaser.GameObjects.Graphics;
  private rewardText: Phaser.GameObjects.Text; private rewards: BadgeId[] = []; private resultTime = 0;
  private score: Phaser.GameObjects.Text; private bars: Phaser.GameObjects.Graphics;
  private loadouts: Phaser.GameObjects.Text[];
  private overlay: Phaser.GameObjects.Container; private actions: Phaser.GameObjects.Container;
  private audio: Phaser.GameObjects.Container;
  private title: Phaser.GameObjects.Text; private detail: Phaser.GameObjects.Text; private banner: Phaser.GameObjects.Text;
  private jam: Phaser.GameObjects.Text;
  private notice: Phaser.GameObjects.Text; private noticeTime = 0;
  private debugText?: Phaser.GameObjects.Text; private panelKey = ''; private primary?: () => void;
  constructor(private scene: Phaser.Scene, private mode: GameMode, match: Match, private arcadeIndex: number | null, private callbacks: Actions) {
    scene.add.graphics().setDepth(10).fillStyle(0x0c1d31, 0.97).fillRoundedRect(16, 12, 1248, 84,14).lineStyle(1, 0x71b5c4, 0.35).lineBetween(32, 95, 1248, 95);
    label(scene, 32, 23, match.map.name, 24).setDepth(11);
    label(scene, 32, 60, arcadeIndex === null ? 'FREE PLAY' : 'ARENA ' + (arcadeIndex+1) + ' / '+ARCADE.length, 22, '#9ab5ce').setDepth(11);
    this.score = label(scene, 640, 23, '', 30).setOrigin(0.5, 0).setDepth(11);
    label(scene, 640, 65, 'FIRST TO ' + match.targetScore, 18, '#a4b6c7').setOrigin(0.5, 0).setDepth(11);
    this.loadouts = [label(scene, 290, 23, '', 21, '#77eee3'), label(scene, 850, 23, '', 21, '#ff9189')];
    this.loadouts.forEach(t => t.setDepth(11));
    this.bars = scene.add.graphics().setDepth(11);
    button(scene, 1094, 22, 154, 60, 'PAUSE', callbacks.pause).setDepth(11);
    if (!device.touch) label(scene, 640, 700, mode === '2p' ? 'P1: WASD + Space    P2: Arrows + Enter    P: pause' : profile.data.controls==='modern' ? 'WASD move    Mouse aim + fire    P pause    R retry' : 'W/S thrust + brake    A/D turn    Space fire    P pause', 22, '#b3c9dc').setOrigin(0.5).setDepth(11);
    const dim = scene.add.graphics().fillStyle(0x030711, 0.78).fillRect(-640, -360, 1280, 720);
    const block = scene.add.zone(-640, -360, 1280, 720).setOrigin(0).setInteractive();
    const panel = this.panelArt = scene.add.graphics().fillStyle(0x0b1825, 0.99).fillRoundedRect(-350, -250, 700, 540, 16).lineStyle(1.5, 0x77b6bc, 0.55).strokeRoundedRect(-350, -250, 700, 540, 16);
    this.emblem = scene.add.graphics();
    this.rewardText = label(scene, 0, 230, '', 17, '#b6ff74').setOrigin(0.5).setAlign('center').setWordWrapWidth(620);
    this.title = label(scene, 0, -195, '', 36).setOrigin(0.5);
    this.detail = label(scene, 0, -146, '', 20, '#a4b6c7').setOrigin(0.5).setWordWrapWidth(630).setAlign('center');
    this.actions = scene.add.container(0, 0); this.audio = soundButton(scene, -235, 201, 470, 64);
    this.overlay = scene.add.container(640, 360, [dim, block, panel, this.emblem, this.title, this.detail, this.actions, this.audio, this.rewardText]).setDepth(30).setVisible(false);
    this.banner = label(scene, 640, 478, '', 27).setOrigin(0.5).setAlign('center').setBackgroundColor('#0b1825ee').setPadding(18, 10).setDepth(12);
    this.jam = label(scene, 640, 267, 'SIGNAL JAMMED\nTHRUST 30%  /  TURN 45%', 25, '#99ecff').setOrigin(0.5).setAlign('center').setBackgroundColor('#173846ee').setPadding(20, 10).setDepth(13).setVisible(false);
    this.notice = label(scene, 640, 210, '', 28, '#b6ff74').setOrigin(0.5).setAlign('center').setBackgroundColor('#0b1825ee').setPadding(20, 12).setDepth(13).setVisible(false);
    if (import.meta.env.DEV) this.debugText = label(scene, 30, 167, '', 13, '#c0a1ff').setDepth(12);
  }
  announce(text: string, color = '#b6ff74'): void { this.notice.setText(text).setColor(color); this.noticeTime = 2.5; }
  setRewards(ids: BadgeId[]): void { this.rewards = ids; }
  tick(dt: number): void { this.noticeTime = Math.max(0, this.noticeTime - dt); this.resultTime += dt; }
  name(id: PlayerId): string { return this.mode === '1p' ? id === 1 ? 'YOU' : 'AI' : 'P' + id; }
  activatePrimary(): void { if (!pause.has('ad')) this.primary?.(); }
  private panel(key: string, title: string, detail: string, actions: [string, () => void][]): void {
    this.overlay.setVisible(true); this.banner.setVisible(false); this.audio.setVisible(key === 'pause'); this.rewardText.setVisible(false);
    if (this.panelKey === key) return;
    this.panelKey = key; this.resultTime = 0; this.emblem.clear(); this.title.setColor('#e7f1fa');
    this.panelArt.clear().fillStyle(0x0b1825, 0.99).fillRoundedRect(-350, -250, 700, 540, 16).lineStyle(1.5, 0x77b6bc, 0.55).strokeRoundedRect(-350, -250, 700, 540, 16);
    this.title.setText(title); this.detail.setText(detail); this.actions.removeAll(true);
    this.primary = actions[0]?.[1];
    actions.forEach(([text, action], i) => this.actions.add(button(this.scene, -235, -95 + i * 96, 470, 80, text, action, i === 0 ? 0x77eee3 : 0x91a6bb)));
  }
  private drawResult(match: Match): void {
    const won = this.mode === '2p' || match.winner === 1;
    const accent = this.mode === '2p' ? playerColor(match.winner!) : won ? 0xffcf70 : 0xff9189;
    this.title.setColor('#' + accent.toString(16));
    this.panelArt.clear().fillStyle(won ? 0x10232d : 0x201d2a, 0.99).fillRoundedRect(-350, -250, 700, 540, 16)
      .lineStyle(2, accent, 0.65).strokeRoundedRect(-350, -250, 700, 540, 16);
    const g = this.emblem.clear(), t = Math.min(this.resultTime, 1.4), r = 24 + Math.sin(Math.min(1, t * 2) * Math.PI) * 5;
    g.fillStyle(0x0b1825).fillCircle(0, -250, r + 9).lineStyle(2, accent).strokeCircle(0, -250, r);
    if (won) {
      g.fillStyle(accent).beginPath().moveTo(-14, -259).lineTo(-8, -249).lineTo(0, -265).lineTo(8, -249).lineTo(14, -259).lineTo(11, -241).lineTo(-11, -241).closePath().fillPath();
      if (t < 1.4) for (let i = 0; i < 28; i++) {
        const side = i % 2 ? 1 : -1, x = side * (365 + Math.sin(i * 3.7) * 85 * t), y = -210 + (i % 14) * 26 + t * 90;
        g.fillStyle(i % 3 ? accent : 0x77eee3, Math.max(0, 1 - t / 1.4)).fillRect(x, y, 4, 9);
      }
    } else g.lineStyle(2, accent).lineBetween(-10, -260, 10, -240).lineBetween(10, -260, -10, -240);
    const names = this.rewards.map(id => BADGES.find(b => b.id === id)!.name);
    const before = profile.data.badges.length - this.rewards.length;
    const unlocked = PAINTS.filter(p => p.badges > before && p.badges <= profile.data.badges.length).map(p => p.name);
    const next = BADGES.find(b => !profile.data.badges.includes(b.id));
    this.rewardText.setText(this.mode === '2p' ? 'One keyboard. One more duel.' : names.length ?
      'BADGE: ' + names.join(' / ') + (unlocked.length ? '\nPAINT UNLOCKED: ' + unlocked.join(' / ') + ' · HANGAR' : '') :
      next ? 'NEXT BADGE: ' + next.name + '\n' + next.description : 'ALL FOUR BADGES EARNED · EXPLORE YOUR HANGAR').setVisible(true);
    if (!profile.persistent && this.mode === '1p') this.rewardText.setText(this.rewardText.text + '\nProgress lasts only this visit.');
  }
  update(match: Match, debug: boolean, fps: number): void {
    this.score.setText(this.name(1) + ' ' + match.scores[1] + ' : ' + match.scores[2] + ' ' + this.name(2));
    this.bars.clear();
    match.ships.forEach((ship, i) => {
      this.loadouts[i].setText((ship.laserCharge ? 'CHARGING' : ship.specialShot ? POWERUP_NAMES[ship.specialShot] : 'CANNON') +
        '\n' + (ship.shield ? 'SHIELD ON' : ship.cooldown > 0 ? 'RELOADING' : 'READY'));
      this.bars.fillStyle(0x293b48).fillRect(i === 0 ? 290 : 850, 81, 155, 4);
      this.bars.fillStyle(playerColor(ship.id), 0.9).fillRect(i === 0 ? 290 : 850, 81, Math.max(0.1, 155 * (1 - ship.cooldown / FIRE_COOLDOWN)), 4);
    });
    if (import.meta.env.DEV) this.debugText?.setText(debug ? 'DEBUG ' + fps.toFixed(0) + ' FPS\nF2: COLLISIONS / CAPTURE / AI\n' + match.bullets.map(b => b.kind + (b.orbitState ? ' LOCK ' + b.orbitState.bodyId + ' r=' + b.orbitState.radius.toFixed(1) : ' FREE')).join('\n') : '');
    this.notice.setVisible(this.noticeTime > 0 && !pause.paused && match.phase !== 'matchOver');
    this.jam.setVisible(match.ships[0].jammedFor > 0 && !pause.paused && match.phase === 'playing');
    const c = this.callbacks;
    if (pause.has('ad')) this.panel('ad', 'PLEASE WAIT', 'Returning to the arena…', []);
    else if (pause.paused) this.panel('pause', 'PAUSED', profile.persistent ? 'Your orbit can wait. Audio settings below.' : 'Progress lasts only this visit.', [['RESUME', c.resume], ['RESTART', c.restart], ['MAIN MENU', c.menu]]);
    else if (match.phase === 'matchOver') {
      if (this.arcadeIndex !== null && match.winner === 1) {
        if (nextArena(this.arcadeIndex) === null) this.panel('complete', 'GRAVITY MASTER', 'ALL NINE ARENAS COMPLETE', [['PLAY AGAIN', c.again], ['MAIN MENU', c.menu]]);
        else this.panel('clear', 'ARENA CLEAR', match.map.name + '  /  ' + match.scores[1] + ' : ' + match.scores[2], [['NEXT ARENA', c.next], ['RETRY', c.restart], ['MAIN MENU', c.menu]]);
      } else this.panel('over', match.winner === 1 && this.mode === '1p' ? 'YOU WIN' : this.mode === '1p' ? 'TRY AGAIN' : this.name(match.winner!) + ' WINS', match.scores[1] + ' : ' + match.scores[2] + (this.mode === '1p' && match.winner === 2 ? '\n' + defeatTip(match) : '\nA well-earned victory.'), [['REMATCH', c.restart], ['MAIN MENU', c.menu]]);
      this.drawResult(match);
    } else {
      this.overlay.setVisible(false); this.panelKey = ''; this.primary = undefined;
      this.banner.setVisible(match.phase !== 'playing');
      if (match.phase === 'ready') this.banner.setText('GET READY  ' + match.phaseTime.toFixed(1));
      else if (match.phase === 'roundOver') {
        const death = match.lastDeath, reason = death?.cause === 'self' ? 'HIT BY OWN SHOT' : death?.cause === 'hazard' ? 'DESTROYED BY CORE' : 'HIT BY ENEMY';
        this.banner.setText(match.draw ? 'DOUBLE K.O.' : this.name(otherPlayer(death!.victim)) + ' +1\n' + this.name(death!.victim) + ': ' + reason);
      }
    }
  }
}
