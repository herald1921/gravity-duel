// Release-only composition tool. Uses the shipping game's art, physics and AI.
// No gameplay state or code is changed; all pilots in the capture are AI-driven.
import Phaser from 'phaser';
import { drawShip, playerColor } from '../src/rendering/draw';
import { drawCelestial,drawOrbit,drawWormhole,drawPickup } from '../src/rendering/space';
import { createBody } from '../src/entities/CelestialBody';
import { OnlineRuntime } from '../src/game/OnlineRuntime';
import { GameEffects } from '../src/rendering/GameEffects';
import { PHYSICS_DT } from '../src/config';
import { POWERUP_COLORS } from '../src/entities/PowerUp';

const out=document.querySelector<HTMLCanvasElement>('#output')!;
const ctx=out.getContext('2d')!;
const format=document.querySelector<HTMLSelectElement>('#format')!;
const status=document.querySelector<HTMLElement>('#status')!;
const sizes={landscape:[1920,1080],portrait:[800,1200],square:[800,800]} as const;
let scene:Studio, recording=false, recordStart=0, recorder:MediaRecorder|undefined;
let mode:'cover'|'game'='cover', segment=-1, accumulator=0;

function backdrop(w:number,h:number){
 const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#081624');grad.addColorStop(.6,'#142a43');grad.addColorStop(1,'#071222');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w*.7,h*.58,0,w*.7,h*.58,w*.7);glow.addColorStop(0,'#19777938');glow.addColorStop(1,'#0b1e3000');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 for(let i=0;i<210;i++){const x=((i*347+71)%997)/997*w,y=((i*193+37)%991)/991*h;ctx.fillStyle=i%6?'#9dbad653':'#eaffff99';ctx.fillRect(x,y,i%11?1:2,i%11?1:2);}
}
function title(w:number,h:number,video=false){
 const wide=w>h;const x=wide?w*.068:w*.085,y=wide?h*.23:h*.09;
 const size=wide?w*.085:w*.147;
 ctx.save();ctx.translate(x,y);ctx.transform(1,0,-.07,1,0,0);ctx.font=`900 ${size}px Arial`;ctx.textBaseline='top';ctx.lineJoin='round';ctx.strokeStyle='#06101a';ctx.lineWidth=size*.055;
 for(const [text,dy] of [['GRAVITY',0],['DUEL',size*.88]] as const){ctx.strokeText(text,0,dy);const grad=ctx.createLinearGradient(0,dy,0,dy+size);grad.addColorStop(0,'#f4ffff');grad.addColorStop(1,'#8ce9df');ctx.fillStyle=grad;ctx.fillText(text,0,dy);}
 ctx.font=`700 ${size*.205}px Arial`;ctx.fillStyle='#d4f5f4';ctx.letterSpacing=`${size*.035}px`;ctx.fillText('ORBITAL COMBAT',3,size*1.92);ctx.restore();
}
function download(blob:Blob,name:string){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
function cover(){
 const key=format.value as keyof typeof sizes;[out.width,out.height]=sizes[key];mode='cover';scene.cover();compose();status.textContent='Cover ready — current game artwork, no old-mode imagery.';
}
function compose(){
 const w=out.width,h=out.height;backdrop(w,h);
 if(mode==='cover'){
  const wide=w>h;const bw=wide?w*.62:w*1.15,bh=bw*720/1280;
  ctx.drawImage(game.canvas,wide?w*.38:-w*.07,wide?h*.15:h*.40,bw,bh);title(w,h);
 }else{
  if(w>h)ctx.drawImage(game.canvas,0,0,w,h);
  else{title(w,h,true);ctx.drawImage(game.canvas,0,h*.40,w,w*720/1280);}
 }
}
class Studio extends Phaser.Scene{
 g!:Phaser.GameObjects.Graphics;effects!:GameEffects;runtime?:OnlineRuntime;
 create(){scene=this;this.g=this.add.graphics();this.effects=new GameEffects(this);cover();}
 cover(){
  this.effects.clear();const g=this.g;g.clear();
  g.lineStyle(2,0x72cad3,.18).strokeEllipse(670,390,920,430);
  drawCelestial(g,createBody('cover','planet',685,380,{radius:175}),1);
  drawCelestial(g,createBody('moon','moon',970,200,{radius:50}),1);
  drawWormhole(g,{id:'cover-a',exitId:'cover-b',x:1020,y:560,radius:53,orientation:-.45},1);
  g.lineStyle(12,0x69f4df,.08).beginPath().arc(685,380,245,.3,4.9).strokePath();
  g.lineStyle(3,0x99ffec,.85).beginPath().arc(685,380,245,.3,4.9).strokePath();
  g.fillStyle(0xffffff).fillCircle(685+Math.cos(.3)*245,380+Math.sin(.3)*245,7);
  g.save().translateCanvas(300,560).scaleCanvas(3.1,3.1);drawShip(g,{x:0,y:0,angle:-.4,hullAngle:-.4,id:1,thrusting:true},1);g.restore();
  g.save().translateCanvas(1030,255).scaleCanvas(2.3,2.3);drawShip(g,{x:0,y:0,angle:2.65,hullAngle:2.65,id:2,thrusting:true},1);g.restore();
 }
 arena(index:number){
  this.effects.clear();this.runtime=new OnlineRuntime(['unit-1-4','unit-2-6','unit-3-8'][index],'ffa');
  // Start each clip after countdown; physics continues at its normal 120 Hz.
  for(let i=0;i<220;i++)this.runtime.step();
 }
 update(_time:number,delta:number){
  if(recording){
   const elapsed=(performance.now()-recordStart)/1000;
   if(elapsed>=18.5){recording=false;recorder?.stop();status.textContent='Encoding finished. Download will begin.';return;}
   if(elapsed>=.5){mode='game';const next=Math.min(2,Math.floor((elapsed-.5)/6));if(next!==segment){segment=next;this.arena(next);accumulator=0;}
    accumulator+=Math.min(delta/1000,.1);while(accumulator>=PHYSICS_DT){this.runtime!.step();accumulator-=PHYSICS_DT;}
    this.renderMatch(Math.min(delta/1000,.1));
   }
   status.textContent=`Recording ${elapsed.toFixed(1)} / 18.5 seconds · normal game speed · no audio`;
  }
 }
 renderMatch(dt:number){
  const m=this.runtime!.match,g=this.g;g.clear();
  g.fillStyle(0x0c1c31).fillRect(0,0,1280,720);
  for(let i=0;i<130;i++)g.fillStyle(0xa8c8e4,.28).fillCircle((i*347)%1280,(i*193)%720,i%11?.65:1.3);
  for(const b of m.map.bodies)drawOrbit(g,b,m.time);for(const b of m.map.bodies)drawCelestial(g,b,m.time);
  for(const hole of m.map.wormholes??[])drawWormhole(g,hole,m.time);for(const p of m.pickups)drawPickup(g,p,m.time);
  for(const b of m.bullets){const color=b.kind==='orbital'?POWERUP_COLORS.orbital:b.kind==='heavy'?POWERUP_COLORS.heavy:b.kind==='homing'?POWERUP_COLORS.homing:playerColor(b.ownerId);b.trail.forEach((p,i)=>g.fillStyle(color,i/b.trail.length*.4).fillCircle(p.x,p.y,2.5));g.fillStyle(color,.23).fillCircle(b.x,b.y,10);g.fillStyle(color).fillCircle(b.x,b.y,Math.max(4.5,b.radius));g.fillStyle(0xffffff).fillCircle(b.x,b.y,2);}
  for(const beam of m.laserBeams){g.lineStyle(10,0xffcf70,.2).lineBetween(beam.start.x,beam.start.y,beam.end.x,beam.end.y);g.lineStyle(3,0xfff7d7).lineBetween(beam.start.x,beam.start.y,beam.end.x,beam.end.y);}
  for(const s of m.ships)if(s.alive){drawShip(g,s,m.time);if(s.shield)g.lineStyle(2,0x80e5ff,.75).strokeCircle(s.x,s.y,33);}
  for(const e of m.drainEvents())if(e.type==='death')this.effects.flash(e.position,0xffb576,true);else if(e.type==='shot')this.effects.flash(e.position,playerColor(e.owner));
  this.effects.update(dt,m.ships,m.phase==='playing');
 }
}
const game=new Phaser.Game({type:Phaser.CANVAS,parent:'source',width:1920,height:1080,transparent:true,antialias:true,audio:{noAudio:true},scene:Studio,banner:false,callbacks:{postBoot:g=>{g.scene.scenes[0].cameras.main.setZoom(1.5).centerOn(640,360);g.events.on('postrender',()=>compose());}}});
document.querySelector<HTMLButtonElement>('#cover')!.onclick=()=>{cover();requestAnimationFrame(()=>requestAnimationFrame(()=>out.toBlob(b=>b&&download(b,`cover-${format.value}.png`))));};
format.onchange=()=>{if(!recording)cover();};
document.querySelector<HTMLButtonElement>('#record')!.onclick=async()=>{
 if(recording)return;cover();if(format.value==='portrait'){out.width=1080;out.height=1620;}
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));compose();
 const mime=['video/mp4;codecs=avc1.42001E','video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))!;
 const chunks:Blob[]=[];const stream=out.captureStream(30);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10000000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{download(new Blob(chunks,{type:mime}),`preview-${format.value}.${mime.includes('mp4')?'mp4':'webm'}`);stream.getTracks().forEach(t=>t.stop());status.textContent='Preview downloaded. '+mime;};
 segment=-1;recordStart=performance.now();recording=true;recorder.start();
};
