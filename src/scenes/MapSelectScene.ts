import Phaser from 'phaser';
import type { GameMode } from '../game/Match.js';
import { MAPS, type GameMap } from '../maps/maps.js';
import { CAMPAIGN_MAPS, UNITS } from '../maps/campaign.js';
import { bodyPosition } from '../entities/CelestialBody.js';
import { drawBackground,label } from '../rendering/draw.js';
import { drawCelestial,drawWormhole } from '../rendering/space.js';
import { bindMenuKeys,MenuCard } from '../ui/menu.js';
import { button } from '../ui/widgets.js';
import { device,pause,platform,profile } from '../platform/runtime.js';
export class MapSelectScene extends Phaser.Scene {
 private mode:GameMode='1p';private selected=0;private cards:MenuCard[]=[];
 private unit=0;private practice=false;private maps:readonly GameMap[]=[];private footer!:Phaser.GameObjects.Text;
 constructor(){super('MapSelect');}
 init(data:{mode?:GameMode;unit?:number;practice?:boolean}):void{
  this.mode=data.mode==='2p'&&!device.touch?'2p':'1p';this.unit=Math.max(0,Math.min(2,data.unit??Math.floor((profile.data.runIndex??0)/9)));this.practice=data.practice===true;
 }
 create():void{
  this.cards=[];platform.setGameplay(false);drawBackground(this);
  label(this,52,30,this.mode==='2p'?'LOCAL DUEL':this.practice?'PRACTICE · ALL LEVELS OPEN':'CAMPAIGN · THREE UNITS',30,'#70e9d4');
  label(this,52,72,this.mode==='2p'?'One keyboard. Nine classic arenas.':this.unit===1?'Stars + neutron stars · Rotating beams jam ships · Portals from 2-6':this.practice?'Try any level. Practice does not change campaign progress.':this.unit===2?'Ship gravity ON · Clear each squad to advance.':'Ship gravity OFF · Learn the skies, then face a squad.',20,'#afc6d9');
  button(this,1095,24,137,60,'BACK',()=>this.scene.start('Menu'));
  if(this.mode==='1p'){
   UNITS.forEach((_name,i)=>button(this,52+i*294,110,280,58,['1 · PLANETS','2 · STARS','3 · BLACK HOLES'][i],()=>this.scene.restart({mode:this.mode,unit:i,practice:this.practice}),i===this.unit?0x69f4df:0x96acc3));
   button(this,940,110,292,58,this.practice?'CAMPAIGN MODE':'PRACTICE ALL',()=>this.scene.restart({mode:this.mode,unit:this.unit,practice:!this.practice}),0xffcb87);
  }
  this.maps=this.mode==='2p'?MAPS:CAMPAIGN_MAPS.slice(this.unit*9,this.unit*9+9);
  this.maps.forEach((map,i)=>{
   const locked=this.locked(i), cleared=profile.data.cleared.includes(this.unit*9+i);
   const card=new MenuCard(this,52+i%3*398,190+Math.floor(i/3)*150,380,136,locked?0x53677b:this.unit===0?0x69f4df:this.unit===1?0xa6b5ff:0xffcb87,()=>this.select(i),()=>this.choose(i));
   const art=this.add.graphics();
   art.save().translateCanvas(65,68).scaleCanvas(.18,.18).translateCanvas(-640,-390);
   map.bodies.forEach(b=>{if(b.type==='pulsar'){const p=bodyPosition(b,0);art.lineStyle(12,0x6ae7ff,.6).lineBetween(p.x-100,p.y+70,p.x+100,p.y-70);art.fillStyle(0xd4f9ff).fillCircle(p.x,p.y,b.radius);}else drawCelestial(art,b);});(map.wormholes??[]).forEach(w=>drawWormhole(art,w,0));art.restore();
   card.container.add(art);card.text(this,137,20,map.name,22);card.text(this,137,54,this.mode==='2p'?'ARENA '+(i+1):'LEVEL '+(this.unit+1)+'-'+(i+1)+' · '+(locked?'LOCKED':cleared?'CLEARED':'READY'),18,'#9fb8d0');
   const enemies=1+(map.extraEnemySpawns?.length??0), moving=map.bodies.some(b=>b.motion);
   card.container.add(label(this,137,87,(map.bodies.some(b=>b.type==='pulsar')?'NEUTRON':moving?'ORBITING':'STATIC')+' · '+enemies+' RIVAL'+(enemies>1?'S':''),18,locked?'#6d8298':'#70e9d4').setWordWrapWidth(230));this.cards.push(card);
  });this.select(0);
  this.footer=label(this,52,661,device.touch?'Tap a level to start.':'Arrow keys to choose · Enter to play · Esc to return',21,'#a9bed2').setWordWrapWidth(1170);
  bindMenuKeys(this,k=>{if(pause.paused)return;if(['ArrowLeft','KeyA'].includes(k))this.select((this.selected+8)%9);
   if(['ArrowRight','KeyD'].includes(k))this.select((this.selected+1)%9);if(['ArrowUp','KeyW'].includes(k))this.select((this.selected+6)%9);
   if(['ArrowDown','KeyS'].includes(k))this.select((this.selected+3)%9);if(k==='Enter'||k==='Space')this.choose(this.selected);if(k==='Escape')this.scene.start('Menu');});
 }
 private select(i:number):void{this.selected=i;this.cards.forEach((c,n)=>c.select(n===i));}
 private locked(i:number):boolean{return this.mode==='1p'&&!this.practice&&this.unit*9+i>0&&!profile.data.cleared.includes(this.unit*9+i-1)&&!profile.data.cleared.includes(this.unit*9+i);}
 private choose(i:number):void{
  if(pause.paused)return;
  if(this.locked(i)){this.footer.setText('Clear the previous level first, or choose PRACTICE ALL to try any level.');return;}
  if(this.mode==='1p'&&!this.practice){const index=this.unit*9+i;this.scene.start(index===0&&!profile.data.tutorialDone?'Tutorial':'Game',{mode:'1p',arcadeIndex:index});}
  else this.scene.start('Game',{mode:this.mode,mapId:this.maps[i].id});
 }
}
