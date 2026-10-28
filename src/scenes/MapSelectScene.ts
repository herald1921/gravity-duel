import Phaser from 'phaser';
import type { GameMode } from '../game/Match.js';
import { MAPS, type GameMap } from '../maps/maps.js';
import { CAMPAIGN_MAPS, UNITS, UNIT_COUNTS, unitForIndex } from '../maps/campaign.js';
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
  this.mode='1p';this.unit=Math.max(0,Math.min(2,data.unit??unitForIndex(profile.data.runIndex??0)));this.practice=data.practice===true;
 }
 create():void{
  this.cards=[];platform.setGameplay(false);drawBackground(this);
  label(this,52,30,this.mode==='2p'?'LOCAL DUEL':this.practice?'PRACTICE · ALL LEVELS OPEN':'CAMPAIGN · THREE UNITS',30,'#70e9d4');
  label(this,52,72,this.mode==='2p'?'One keyboard. Nine classic arenas.':this.unit===1?'Stars + neutron stars · Rotating beams jam ships · Ship gravity OFF':this.unit===2?'Black holes + wormholes · Ships feel gravity · Wormholes from 3-2':'Planets + moons only · Ship gravity OFF · Learn the skies, then challenge the boss.',20,'#afc6d9');
  button(this,1095,24,137,60,'BACK',()=>this.scene.start('Menu'));
  if(this.mode==='1p'){
   UNITS.forEach((_name,i)=>button(this,52+i*294,110,280,58,['1 · PLANETS','2 · STARS','3 · BLACK HOLES'][i]+' ('+UNIT_COUNTS[i]+')',()=>this.scene.restart({mode:this.mode,unit:i,practice:this.practice}),i===this.unit?0x69f4df:0x96acc3));
   button(this,940,110,292,58,this.practice?'CAMPAIGN MODE':'PRACTICE ALL',()=>this.scene.restart({mode:this.mode,unit:this.unit,practice:!this.practice}),0xffcb87);
  }
  this.maps=this.mode==='2p'?MAPS:CAMPAIGN_MAPS.filter(m=>m.unitIndex===this.unit);
  const compact=this.maps.length>9, rowHeight=this.maps.length>12?89:compact?112:150, cardHeight=this.maps.length>12?83:compact?104:136;
  this.maps.forEach((map,i)=>{
   const locked=this.locked(i), cleared=profile.data.cleared.includes(map.campaignIndex??-1);
   const card=new MenuCard(this,52+i%3*398,190+Math.floor(i/3)*rowHeight,380,cardHeight,locked?0x53677b:this.unit===0?0x69f4df:this.unit===1?0xa6b5ff:0xffcb87,()=>this.select(i),()=>this.choose(i));
   const art=this.add.graphics();
   art.save().translateCanvas(65,cardHeight/2).scaleCanvas(.155,.155).translateCanvas(-640,-390);
   map.bodies.forEach(b=>{if(b.type==='pulsar'){const p=bodyPosition(b,0);art.lineStyle(12,0x6ae7ff,.6).lineBetween(p.x-100,p.y+70,p.x+100,p.y-70);art.fillStyle(0xd4f9ff).fillCircle(p.x,p.y,b.radius);}else drawCelestial(art,b);});(map.wormholes??[]).forEach(w=>drawWormhole(art,w,0));art.restore();
   card.container.add(art);card.text(this,137,compact?6:20,map.name,22);card.text(this,137,compact?31:54,this.mode==='2p'?'ARENA '+(i+1):'LEVEL '+(this.unit+1)+'-'+(i+1)+' · '+(locked?'LOCKED':cleared?'CLEARED':'READY'),18,'#9fb8d0');
   const enemies=1+(map.extraEnemySpawns?.length??0), moving=map.bodies.some(b=>b.motion);
   card.container.add(label(this,137,compact?56:87,map.boss!==undefined?'BOSS ENCOUNTER':map.combat==='freeForAll'?'4-WAY · SURVIVAL':enemies>1?'2-AI SQUAD':(map.bodies.some(b=>b.type==='pulsar')?'NEUTRON':moving?'ORBITING':'STATIC')+' · 1 RIVAL',18,locked?'#6d8298':'#70e9d4').setWordWrapWidth(230));this.cards.push(card);
  });
  this.footer=label(this,52,647,'',18,'#a9bed2').setWordWrapWidth(1170);this.select(0);
  bindMenuKeys(this,k=>{if(pause.paused)return;const n=this.maps.length;if(['ArrowLeft','KeyA'].includes(k))this.select((this.selected+n-1)%n);
   if(['ArrowRight','KeyD'].includes(k))this.select((this.selected+1)%n);if(['ArrowUp','KeyW'].includes(k))this.select((this.selected+n-3)%n);
   if(['ArrowDown','KeyS'].includes(k))this.select((this.selected+3)%n);if(k==='Enter'||k==='Space')this.choose(this.selected);if(k==='Escape')this.scene.start('Menu');});
 }
 private select(i:number):void{this.selected=i;this.cards.forEach((c,n)=>c.select(n===i));this.footer?.setText(this.maps[i].description+'\n'+(device.touch?'Tap a level to start.':'Arrow keys to choose · Enter to play · Esc to return'));}
 private locked(i:number):boolean{const index=this.maps[i].campaignIndex??0;return this.mode==='1p'&&!this.practice&&index>0&&!profile.data.cleared.includes(index-1)&&!profile.data.cleared.includes(index);}
 private choose(i:number):void{
  if(pause.paused)return;
  if(this.locked(i)){this.footer.setText('Clear the previous level first, or choose PRACTICE ALL to try any level.');return;}
  if(this.mode==='1p'&&!this.practice){const index=this.maps[i].campaignIndex!;this.scene.start(index===0&&!profile.data.tutorialDone?'Tutorial':'Game',{mode:'1p',arcadeIndex:index});}
  else this.scene.start('Game',{mode:this.mode,mapId:this.maps[i].id});
 }
}
