import Phaser from 'phaser';
import { preparePlanetArt } from '../src/rendering/PlanetArt.js';
import { drawBackground,drawShip,label } from '../src/rendering/draw.js';
import { drawCelestial,drawWormhole } from '../src/rendering/space.js';
import { drawBoss } from '../src/rendering/BossArt.js';
import { createBody } from '../src/entities/CelestialBody.js';
import { Ship } from '../src/entities/Ship.js';
import { BossEncounter } from '../src/game/BossEncounter.js';
import { portalPair } from '../src/entities/Wormhole.js';
await preparePlanetArt();
class Gallery extends Phaser.Scene {
 create(){
  drawBackground(this);label(this,46,30,'GRAVITY DUEL / ORBITAL COMBAT',33);label(this,46,74,'ILLUSTRATED SPACE · TERRAIN / HULLS / CORES / WORMHOLES',22,'#8ab9c8');
  const g=this.add.graphics();
  ['planet','moon','star','pulsar','blackHole'].forEach((type,i)=>{
   const x=155+i*240,y=245;
   const art=type==='pulsar'?this.add.graphics():g;
   if(type==='pulsar'){const mask=this.add.graphics().fillStyle(0xffffff).fillRect(x-110,y-90,220,180).setVisible(false);art.setMask(mask.createGeometryMask());}
   drawCelestial(art,createBody(type,type as any,x,y,{radius:type==='blackHole'||type==='pulsar'?25:56}),1);
   label(this,x,330,['OCEAN WORLD','MOON','STAR','NEUTRON STAR','BLACK HOLE'][i],22,'#bed7e5').setOrigin(.5);
  });
  for(let i=0;i<4;i++){drawShip(g,{x:85+i*95,y:455,angle:-.4,id:(i+1) as any,thrusting:true},2);}
  label(this,230,520,'PILOTS / SHARED HULL LANGUAGE',22,'#bed7e5').setOrigin(.5);
  for(let i=0;i<3;i++){
   const ship=new Ship(2,{x:580+i*200,y:455,angle:0});ship.radius=34;
   const b=new BossEncounter(i as any);b.phase=i===1?'recover':'warning';b.angle=.3;
   drawBoss(g,ship,b,1);label(this,ship.x,520,['WARDEN','DREADNOUGHT','SOVEREIGN'][i],22,'#bed7e5').setOrigin(.5);
  }
  const gates=portalPair([600,625,0],[820,625,0]);gates.forEach(w=>drawWormhole(g,w,1));
  label(this,47,614,'WORMHOLE LENSES',22,'#bed7e5');
  label(this,47,674,'Planet terrain adapted from Solar System Scope · CC BY 4.0',22,'#8ab9c8');
 }
}
new Phaser.Game({type:Phaser.AUTO,width:2560,height:1440,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true},scene:[Gallery],callbacks:{postBoot:game=>game.events.on(Phaser.Core.Events.PRE_RENDER,()=>game.scene.getScenes(true).forEach(s=>s.cameras.main.setZoom(2).centerOn(640,360)))},banner:false});
