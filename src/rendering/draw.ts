import Phaser from 'phaser';
import { WORLD } from '../config.js';
import type { CelestialBody } from '../entities/CelestialBody.js';
import type { PlayerId, Ship } from '../entities/Ship.js';
import type { Vec2 } from '../physics/gravity.js';
export const COLORS = { 1: 0x69f4df, 2: 0xff8c79, 3: 0xffbb70, 4: 0xef8fbf, white: 0xf0f6ff, muted: 0xa8bed3, gold: 0xffd080 };
export const MONO = 'Arial, Helvetica, sans-serif';
export const playerColor = (id: PlayerId): number => COLORS[id];
export function label(scene: Phaser.Scene, x: number, y: number, value: string, size = 22, color = '#e7f1fa'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, { fontFamily: MONO, fontSize: `${Math.max(22,size)}px`, fontStyle: size >= 28 ? 'bold' : 'normal', color });
}
export function drawBackground(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-5);
  g.fillGradientStyle(0x101e36, 0x0a172c, 0x060f1e, 0x0e1c32, 1).fillRect(0,0,WORLD.width,WORLD.height);
  for (let i=16;i>0;i--) {
    g.fillStyle(0x2a5d7b,0.008).fillEllipse(850,310,270+i*48,100+i*26);
    g.fillStyle(0x544c91,0.006).fillEllipse(210,570,120+i*38,80+i*18);
  }
  const random = new Phaser.Math.RandomDataGenerator(['gravity-duel-v090']);
  for (let i = 0; i < 185; i++) {
    const x=random.between(20,1260),y=random.between(20,700);
    g.fillStyle(i%4 ? 0xa8c8e4 : 0x66c9ce,random.realInRange(0.15,0.6)).fillCircle(x,y,i%12===0?1.6:0.8);
    if(i%38===0) g.lineStyle(1,0xc8e1ff,0.28).lineBetween(x-4,y,x+4,y).lineBetween(x,y-4,x,y+4);
  }
  g.lineStyle(1,0x82bdd9,0.07).strokeEllipse(880,380,1100,820).strokeEllipse(880,380,1420,1080);
  g.lineStyle(1,0x9bc5dd,0.16).strokeRoundedRect(12,12,1256,696,16);
}
export function drawBody(g: Phaser.GameObjects.Graphics, body: CelestialBody, seconds=0): void {
  const {x,y,radius:r,type}=body;
  if(type==='blackHole') {
    g.save().translateCanvas(x,y).rotateCanvas(-0.35);
    for(let i=7;i>0;i--) g.lineStyle(2+i,0xffb66b,0.018).strokeEllipse(0,0,145+i*8,52+i*4);
    g.lineStyle(3,0xffb96e,0.9).strokeEllipse(0,0,150,56);
    g.lineStyle(1.5,0xffedd6,0.8).beginPath().arc(0,0,body.collisionRadius+9,seconds*.3,seconds*.3+4.2).strokePath();
    g.restore();
    g.fillStyle(0x020610).fillCircle(x,y,body.collisionRadius);
    g.lineStyle(2,0xe4b6ff,0.9).strokeCircle(x,y,body.collisionRadius);
    return;
  }
  if(type==='star') {
    for(let i=10;i>0;i--) g.fillStyle(0xff9446,0.022).fillCircle(x,y,r+i*4);
    g.fillStyle(0xe56e39).fillCircle(x,y,r);
    for(let i=0;i<24;i++) {
      const c=Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(242,133,52),new Phaser.Display.Color(255,242,184),24,i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r,c.g,c.b)).fillCircle(x-i*1.1,y-i*.9,r-i*1.8);
    }
    for(let i=0;i<14;i++) {
      const a=i*Math.PI/7+seconds*.07;
      g.lineStyle(3,0xffb853,0.6).beginPath().arc(x,y,r+8+Math.sin(seconds+i)*3,a,a+.13).strokePath();
    }
    g.lineStyle(2,0xffe3a4,0.9).strokeCircle(x,y,body.collisionRadius); return;
  }
  const moon=type==='moon';
  for(let i=6;i>0;i--) g.fillStyle(moon?0xb4bbdd:0x5de5ed,0.022).fillCircle(x,y,r+i*3);
  g.fillStyle(moon?0x39465e:0x123d58).fillCircle(x,y,r);
  for(let i=0;i<24;i++) {
    const c=Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(...(moon?[91,110,139]:[27,96,120]) as [number,number,number]),new Phaser.Display.Color(...(moon?[179,195,211]:[77,166,172]) as [number,number,number]),24,i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r,c.g,c.b)).fillCircle(x-i*r*.014,y-i*r*.012,r-i*r*.022);
  }
  if(!moon) {
    for(let n=0;n<5;n++) {
      const a=n*2.25+.6, cx=x+Math.cos(a)*r*.48, cy=y+Math.sin(a)*r*.45;
      g.fillStyle(n%2?0x1f6574:0x276f7d,0.6).beginPath();
      for(let k=0;k<12;k++) {
        const ang=k*Math.PI/6, rr=r*(.14+.06*Math.sin(k*2.3+n));
        const px=cx+Math.cos(ang)*rr,py=cy+Math.sin(ang)*rr*.7;
        if(k===0)g.moveTo(px,py);else g.lineTo(px,py);
      }
      g.closePath().fillPath();
    }
    g.lineStyle(1,0xc0ffff,0.12).strokeEllipse(x-r*.1,y,r*1.6,r*.52);
  } else for(const [dx,dy,s] of [[-.3,-.3,.2],[.3,.1,.27],[-.2,.5,.12]]) {
    g.fillStyle(0x344762,.35).fillCircle(x+dx*r,y+dy*r,s*r);
    g.lineStyle(1,0xd9e4fa,.4).beginPath().arc(x+dx*r,y+dy*r,s*r,.7,3.6).strokePath();
  }
  g.lineStyle(2,moon?0xc3d5ea:0xa5ffef,.7).beginPath().arc(x,y,r,Math.PI*.9,Math.PI*1.8).strokePath();
  g.lineStyle(1,moon?0x8193b5:0x52b8ca,.55).strokeCircle(x,y,r);
}
export function drawShip(g: Phaser.GameObjects.Graphics, ship: Pick<Ship,'x'|'y'|'angle'|'id'|'thrusting'> & {hullAngle?:number}, seconds:number, paint?:number): void {
  const color=playerColor(ship.id),hull=paint??color,heading=ship.hullAngle??ship.angle;
  g.save().translateCanvas(ship.x,ship.y).rotateCanvas(heading);
  g.fillStyle(color,.055).fillCircle(0,0,33);
  if(ship.thrusting) {
    const f=15+Math.sin(seconds*46)*5;
    g.fillStyle(color,.22).fillTriangle(-13,-8,-13,8,-29-f,0);
    g.fillStyle(color,.9).fillTriangle(-15,-4,-15,4,-24-f*.7,0);
    g.fillStyle(0xf6ffff).fillTriangle(-15,-2,-15,2,-25,0);
  }
  g.fillStyle(0x020913,.65).fillEllipse(1,7,45,29);
  g.fillStyle(0x263f59).lineStyle(1.3,color,.7).beginPath().moveTo(12,0).lineTo(-13,-22).lineTo(-22,-17).lineTo(-16,0).lineTo(-22,17).lineTo(-13,22).closePath().fillPath().strokePath();
  g.fillStyle(0xb9ccdf).beginPath().moveTo(25,0).lineTo(-10,-11).lineTo(-17,-7).lineTo(-17,7).lineTo(-10,11).closePath().fillPath();
  g.fillStyle(0xeaf5fa).fillTriangle(25,0,-10,-11,-4,0);
  g.fillStyle(hull,.9).fillTriangle(15,0,-10,-7,-5,0);
  g.fillStyle(0x0c253c).lineStyle(1,0xc5fffc,.85).fillEllipse(0,0,14,9).strokeEllipse(0,0,14,9);
  g.fillStyle(color).fillRect(-18,-17,8,3).fillRect(-18,14,8,3);
  g.restore();
  g.save().translateCanvas(ship.x,ship.y).rotateCanvas(ship.angle);
  g.fillStyle(0x0a1c2c).lineStyle(1,0xa6c5d4,.8).fillRoundedRect(6,-3.5,23,7,2).strokeRoundedRect(6,-3.5,23,7,2);
  g.fillStyle(color).fillRect(25,-3,5,6);g.restore();
}
export function drawTrajectory(g:Phaser.GameObjects.Graphics,points:readonly Vec2[],id:PlayerId,alpha=.65):void {
  points.forEach((p,i)=>{
    if(i%2!==0)return;
    const opacity=alpha*(1-i/Math.max(1,points.length)*.8);
    if(id===1)g.fillStyle(playerColor(id),opacity).fillCircle(p.x,p.y,2);
    else {const n=points[i+1]??p,a=Math.atan2(n.y-p.y,n.x-p.x);g.lineStyle(1.5,playerColor(id),opacity*.65).lineBetween(p.x,p.y,p.x+Math.cos(a)*6,p.y+Math.sin(a)*6);}
  });
}
