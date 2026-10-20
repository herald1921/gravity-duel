import Phaser from 'phaser';
import type { GameMode } from '../game/Match.js';
import { MAPS } from '../maps/maps.js';
import { drawBackground,label } from '../rendering/draw.js';
import { drawCelestial,drawWormhole } from '../rendering/space.js';
import { bindMenuKeys,MenuCard } from '../ui/menu.js';
import { button } from '../ui/widgets.js';
import { device,pause,platform } from '../platform/runtime.js';
const tags=['GRAVITY SHOTS','DUAL GRAVITY','LETHAL STAR','BLACK HOLE','SIGNAL JAMMING','PORTAL SHOTS','ORBITAL WEAPONS','MOVING MOON','PORTAL + GRAVITY'];
export class MapSelectScene extends Phaser.Scene {
 private mode:GameMode='1p';private selected=0;private cards:MenuCard[]=[];
 constructor(){super('MapSelect');}
 init(data:{mode?:GameMode}):void{this.mode=data.mode==='2p'&&!device.touch?'2p':'1p';}
 create():void{
  this.cards=[];platform.setGameplay(false);drawBackground(this);
  label(this,52,36,this.mode==='1p'?'PRACTICE / ALL ARENAS':'LOCAL DUEL / CLASSIC CONTROLS',22,'#70e9d4');
  label(this,50,76,'CHOOSE YOUR ORBIT',38);
  button(this,1088,32,144,72,'BACK',()=>this.scene.start('Menu'));
  MAPS.forEach((map,i)=>{
   const card=new MenuCard(this,52+i%3*398,151+Math.floor(i/3)*166,380,148,i<3?0x69f4df:i<6?0xa6b5ff:0xffcb87,()=>this.select(i),()=>this.choose(i));
   const art=this.add.graphics();
   art.save().translateCanvas(71,77).scaleCanvas(.24,.24).translateCanvas(-640,-390);
   map.bodies.forEach(b=>{if(b.type==='pulsar'){art.lineStyle(12,0x6ae7ff,.6).lineBetween(b.x-140,b.y+100,b.x+140,b.y-100);art.fillStyle(0xd4f9ff).fillCircle(b.x,b.y,b.radius);}else drawCelestial(art,b);});(map.wormholes??[]).forEach(w=>drawWormhole(art,w,0));art.restore();
   card.container.add(art);card.text(this,146,24,map.name,23);card.text(this,146,66,'ARENA '+String(i+1).padStart(2,'0'),22,'#9fb8d0');
   card.container.add(label(this,146,102,tags[i],22,'#70e9d4').setWordWrapWidth(220));this.cards.push(card);
  });this.select(0);
  label(this,52,677,device.touch?'Tap an arena to start.':'Arrow keys to choose · Enter to play · Esc to return',22,'#a9bed2');
  bindMenuKeys(this,k=>{if(pause.paused)return;if(['ArrowLeft','KeyA'].includes(k))this.select((this.selected+8)%9);
   if(['ArrowRight','KeyD'].includes(k))this.select((this.selected+1)%9);if(['ArrowUp','KeyW'].includes(k))this.select((this.selected+6)%9);
   if(['ArrowDown','KeyS'].includes(k))this.select((this.selected+3)%9);if(k==='Enter'||k==='Space')this.choose(this.selected);if(k==='Escape')this.scene.start('Menu');});
 }
 private select(i:number):void{this.selected=i;this.cards.forEach((c,n)=>c.select(n===i));}
 private choose(i:number):void{if(!pause.paused)this.scene.start('Game',{mode:this.mode,mapId:MAPS[i].id});}
}
