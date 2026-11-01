import type Phaser from 'phaser';
import type { BossEncounter } from '../game/BossEncounter.js';
import type { Ship } from '../entities/Ship.js';

/** Mechanical iris: opening exposes a cyan core; sealed armor stays amber. */
export function drawBoss(g: Phaser.GameObjects.Graphics, ship: Ship, boss: BossEncounter, time: number): void {
  const open=boss.vulnerable, color=open?0x69f4df:0xffb96e;
  const plates=[4,6,8][boss.unit], r=ship.radius;
  g.save().translateCanvas(ship.x,ship.y);
  g.fillStyle(0x07111c).lineStyle(2,0x71879b).fillCircle(0,0,r).strokeCircle(0,0,r);
  g.fillStyle(color,.12).fillCircle(0,0,r*1.15);
  for(let i=0;i<plates;i++) {
    const a=i*Math.PI*2/plates+boss.angle;
    g.save().rotateCanvas(a);
    const offset=open?10:0;
    g.fillStyle(0x152c40).lineStyle(1,0x6c8ca5,.9).beginPath()
      .moveTo(12+offset,-8).lineTo(r+9,-12).lineTo(r+17,-6).lineTo(r+17,6).lineTo(r+9,12).lineTo(12+offset,8).closePath().fillPath().strokePath();
    g.fillStyle(0x56728a).fillTriangle(r+9,-10,r+16,-5,18+offset,-5);
    g.fillStyle(color).fillRect(r+9,-4,8,8);
    g.lineStyle(2,color,.45).lineBetween(22,-5,r+5,-5);
    g.restore();
  }
  // Different unit silhouettes: cross frame, hexagonal cruiser, octagonal citadel.
  g.lineStyle(2,color,.7).beginPath();
  for(let i=0;i<=plates;i++){const a=i*Math.PI*2/plates+boss.angle,x=Math.cos(a)*(r+3),y=Math.sin(a)*(r+3);if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}
  g.strokePath();
  if(open){
    for(let i=3;i>0;i--)g.fillStyle(color,.08).fillCircle(0,0,10+i*6);
    g.fillStyle(0xd8fff8).fillCircle(0,0,11+Math.sin(time*9)*2);
  }else{
    g.fillStyle(0x233d51).lineStyle(1,0xa4bdcc).fillCircle(0,0,18).strokeCircle(0,0,18);
    for(let i=0;i<3;i++){const a=time*.2+i*Math.PI*2/3;g.lineStyle(2,0x09141e).lineBetween(0,0,Math.cos(a)*18,Math.sin(a)*18);}
    g.fillStyle(color).fillCircle(0,0,5);
  }
  if(boss.unit===2&&!boss.laser&&boss.phase==='warning'){
    g.save().rotateCanvas(boss.angle);
    g.lineStyle(2,0x94bfff,.7).lineBetween(62,-14,80,0).lineBetween(80,0,62,14);g.restore();
  }
  g.restore();
}
