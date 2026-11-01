import Phaser from 'phaser';
import type { Ship } from '../entities/Ship.js';
import type { Vec2 } from '../physics/gravity.js';
import { label, playerColor } from './draw.js';

interface Spark extends Vec2 { vx: number; vy: number; age: number; life: number; color: number; size: number }
interface Ring extends Vec2 { age: number; life: number; color: number; size: number }

export class GameEffects {
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private engineTime = 0;
  private notices: { text: Phaser.GameObjects.Text; age: number }[] = [];
  private readonly graphics: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) { this.graphics = scene.add.graphics().setDepth(5); }
  clear(): void { this.sparks = []; this.rings = []; this.engineTime = 0; this.graphics.clear(); for (const notice of this.notices) notice.text.destroy(); this.notices = []; }

  notice(position: Vec2, message: string, color: string): void {
    const text = label(this.scene, Math.max(150, Math.min(1130, position.x)), Math.max(145, Math.min(625, position.y - 26)), message, 17, color)
      .setOrigin(0.5).setDepth(31).setBackgroundColor('#0b1825dd').setPadding(7, 4);
    this.notices.push({ text, age: 0 });
    if (this.notices.length > 6) this.notices.shift()!.text.destroy();
  }
  burst(position: Vec2, color: number, count: number, size = 2): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2; const speed = 25 + Math.random() * 150;
      this.sparks.push({ ...position, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        age: 0, life: 0.25 + Math.random() * 0.6, color, size });
    }
  }
  flash(position: Vec2, color: number, explosion = false): void {
    this.rings.push({ ...position, color, age: 0, life: explosion ? 0.8 : 0.12, size: explosion ? 95 : 13 });
    this.burst(position, color, explosion ? 40 : 5);
  }
  update(dt: number, ships: readonly Ship[], playing: boolean): void {
    this.engineTime += dt;
    for (const notice of this.notices) { notice.age += dt; notice.text.y -= dt * 9; notice.text.setAlpha(Math.min(1, (1.8 - notice.age) / 0.4)); }
    this.notices = this.notices.filter(notice => { if (notice.age < 1.8) return true; notice.text.destroy(); return false; });
    if (playing && this.engineTime >= 0.04) {
      this.engineTime = 0;
      for (const ship of ships) if (ship.alive && ship.thrusting) {
        const spread = (Math.random() - 0.5) * 0.6;
        this.sparks.push({ x: ship.x - Math.cos(ship.hullAngle) * 17, y: ship.y - Math.sin(ship.hullAngle) * 17,
          vx: -Math.cos(ship.hullAngle + spread) * 65, vy: -Math.sin(ship.hullAngle + spread) * 65,
          color: playerColor(ship.id), life: 0.22, age: 0, size: 1.5 });
      }
    }
    for (const spark of this.sparks) {
      spark.age += dt; spark.x += spark.vx * dt; spark.y += spark.vy * dt;
      const drag = Math.exp(-2 * dt); spark.vx *= drag; spark.vy *= drag;
    }
    this.sparks = this.sparks.filter(spark => spark.age < spark.life).slice(-240);
    for (const ring of this.rings) ring.age += dt;
    this.rings = this.rings.filter(ring => ring.age < ring.life);
  }
  draw(): void {
    const g = this.graphics.clear();
    for (const spark of this.sparks) {
      const alpha=1-spark.age/spark.life;
      g.lineStyle(spark.size,spark.color,alpha).lineBetween(spark.x,spark.y,spark.x-spark.vx*.035,spark.y-spark.vy*.035);
      g.fillStyle(0xe9faff,alpha*.65).fillCircle(spark.x,spark.y,spark.size*.5);
    }
    for (const ring of this.rings) {
      const progress = ring.age / ring.life;
      if(ring.size>50&&progress<.4){
        g.fillStyle(0xf2ffff,(1-progress/.4)*.8).fillCircle(ring.x,ring.y,9+progress*25);
        g.fillStyle(ring.color,(1-progress/.4)*.12).fillCircle(ring.x,ring.y,25+progress*80);
      }
      g.lineStyle(3 - progress*2, ring.color, 1 - progress).strokeCircle(ring.x, ring.y, 4 + ring.size * progress);
    }
  }
}
