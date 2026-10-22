import Phaser from 'phaser';
import * as C from '../config.js';
import {createProjectile,type Bullet} from '../entities/Bullet.js';
import {Ship,IDLE_CONTROL} from '../entities/Ship.js';
import {MAPS} from '../maps/maps.js';
import {FixedClock} from '../physics/FixedClock.js';
import {simulateTrajectory,stepProjectile} from '../physics/gravity.js';
import {findAimSolution} from '../ai/SpaceAI.js';
import {pilotInput} from '../input/PilotInput.js';
import {device,pause,platform,profile,sound} from '../platform/runtime.js';
import {drawBackground,drawShip,drawTrajectory,label} from '../rendering/draw.js';
import {drawCelestial} from '../rendering/space.js';
import {TouchControls} from '../ui/TouchControls.js';
import {button} from '../ui/widgets.js';
import {bindMenuKeys} from '../ui/menu.js';
export class TutorialScene extends Phaser.Scene {
 private spawn={x:260,y:550};
 private target={id:2 as const,x:823,y:253,radius:32,alive:true};
 private stage=0;private seconds=0;private stageTime=0;private returnToMenu=false;private modern=false;private misses=0;private hintAngle=-.9;
 private clock=new FixedClock();private ship!:Ship;private bullets:Bullet[]=[];private touch?:TouchControls;
 private keys!:Record<'A'|'D'|'W'|'S'|'SPACE',Phaser.Input.Keyboard.Key>;
 private art!:Phaser.GameObjects.Graphics;private title!:Phaser.GameObjects.Text;private detail!:Phaser.GameObjects.Text;private targetLabel!:Phaser.GameObjects.Text;private hint!:Phaser.GameObjects.Text;
 private next!:Phaser.GameObjects.Container;private mouse?:{x:number;y:number};private firing=false;private pending=false;
 constructor(){super('Tutorial');}
 init(data:{returnToMenu?:boolean}):void{this.returnToMenu=data.returnToMenu===true;}
 create():void{
  this.stage=0;this.seconds=0;this.stageTime=0;this.misses=0;this.mouse=undefined;this.firing=false;this.pending=false;this.bullets=[];this.clock.reset();
  this.modern=profile.data.controls==='modern';this.target={id:2,x:823,y:253,radius:32,alive:true};
  pause.set('manual',false);platform.setGameplay(false);drawBackground(this);
  this.spawn=device.touch?{x:320,y:460}:{x:260,y:550};
  this.ship=new Ship(1,{...this.spawn,angle:-.9});this.art=this.add.graphics();
  label(this,42,28,'FLIGHT SCHOOL',28,'#70e9d4');label(this,42,68,'Movement, then two stationary aiming drills.',22,'#b4c9dc');
  button(this,1042,25,198,72,'SKIP',()=>this.finish());
  this.title=label(this,640,133,'',30).setOrigin(.5);this.detail=label(this,640,178,'',23,'#c2d6e7').setOrigin(.5).setWordWrapWidth(1150).setAlign('center');
  this.targetLabel=label(this,823,300,'TARGET',22,'#ffcf83').setOrigin(.5);
  this.hint=label(this,0,0,'AIM HERE',22,'#ffcf83').setOrigin(.5).setVisible(false);
  this.next=button(this,430,580,420,80,this.returnToMenu?'BACK TO MENU':'LET’S DUEL →',()=>this.finish()).setDepth(18).setVisible(false);
  this.keys=this.input.keyboard!.addKeys('A,D,W,S,SPACE') as typeof this.keys;
  this.touch=device.touch?new TouchControls(this,this.modern):undefined;
  const move=(p:Phaser.Input.Pointer)=>{if(!device.touch&&this.modern&&p.y>215)this.mouse={x:p.x,y:p.y};};
  const down=(p:Phaser.Input.Pointer,objects:Phaser.GameObjects.GameObject[])=>{if(!pause.paused&&objects.length===0&&p.y>215&&p.leftButtonDown()){move(p);this.firing=true;this.pending=true;sound.unlock();}};
  const up=()=>{this.firing=false;};
  this.input.on('pointermove',move);this.input.on('pointerdown',down);this.input.on('pointerup',up);this.input.on('pointerupoutside',up);this.input.on('gameout',up);
  bindMenuKeys(this,k=>{if(pause.paused)return;if(k==='Escape')this.finish();if(k==='Space'){if(this.stage===3)this.finish();else this.pending=true;}if(k==='Enter'&&this.stage===3)this.finish();});
  const unsub=pause.subscribe(()=>{this.clock.reset();this.input.keyboard?.resetKeys();this.touch?.state.clear();this.firing=false;this.pending=false;});
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{unsub();this.touch?.state.clear();platform.setGameplay(false);
   this.input.off('pointermove',move);this.input.off('pointerdown',down);this.input.off('pointerup',up);this.input.off('pointerupoutside',up);this.input.off('gameout',up);});
 }
 private finish():void{if(pause.paused)return;profile.finishTutorial();platform.setGameplay(false);if(this.returnToMenu)this.scene.start('Menu');else{profile.begin(0);this.scene.start('Game',{mode:'1p',arcadeIndex:0});}}
 private nextTarget():void{
  this.stage++;this.stageTime=0;this.misses=0;this.bullets=[];this.firing=false;this.pending=false;this.touch?.state.clear();
  this.ship.reset({...this.spawn,angle:-.5});
  if(this.stage===2){this.target.x=880;this.target.y=500;}
  if(this.stage<3)this.hintAngle=findAimSolution(this.ship,this.target,MAPS[0].bodies).angle;
  sound.play(this.stage===3?'celebrate':'pickup');
 }
 update(_t:number,delta:number):void{
  const bodies=MAPS[0].bodies;
  if(!pause.paused)this.clock.advance(delta/1000,()=>{
   this.seconds+=C.PHYSICS_DT;this.stageTime+=C.PHYSICS_DT;
   const k=this.keys,touch=this.touch?.state.control()??IDLE_CONTROL;
   const fire=k.SPACE.isDown||touch.fire||this.firing||this.pending;this.pending=false;this.touch?.state.consumeFire();
   const a=this.mouse?Math.atan2(this.mouse.y-this.ship.y,this.mouse.x-this.ship.x):undefined;
   const control=this.modern?(device.touch?touch:pilotInput(Number(k.D.isDown)-Number(k.A.isDown),Number(k.S.isDown)-Number(k.W.isDown),a,fire)):
    {...touch,turn:Number(k.D.isDown)-Number(k.A.isDown)+touch.turn,thrust:Number(k.W.isDown)-Number(k.S.isDown)+touch.thrust,fire};
   if(this.stage===0){
    this.ship.update(C.PHYSICS_DT,control,bodies,this.seconds);
    if(Math.hypot(this.ship.x-this.spawn.x,this.ship.y-this.spawn.y)>80)this.nextTarget();
   }else if(this.stage<3){
    // A stationary aiming drill: the player, never the tutorial, chooses the shot angle.
    const drill=!this.modern&&device.touch&&control.move
     ?{...control,independentAim:true,aim:Math.atan2(control.move.y,control.move.x)}:control;
    this.ship.update(C.PHYSICS_DT,{...drill,move:undefined,thrust:0,fire:false},bodies,this.seconds);
    if(fire&&this.ship.cooldown<=0){this.bullets.push({...createProjectile(this.ship),trail:[]});this.ship.cooldown=C.FIRE_COOLDOWN;sound.play('shot');}
    const survivors:Bullet[]=[];let hit=false;
    for(const b of this.bullets){
     b.trail.push({x:b.x,y:b.y});if(b.trail.length>70)b.trail.shift();
     const e=stepProjectile(b,bodies,[this.target]);
     if(e){if(e.type==='ship')hit=true;else this.misses++;}else survivors.push(b);
    }
    this.bullets=survivors;if(hit)this.nextTarget();
   }
  });else this.clock.reset();
  platform.setGameplay(this.stage<3&&!pause.paused);
  this.touch?.update(!pause.paused&&this.stage<3,this.stage===0?'thrust':'fire');this.touch?.setReload(this.ship.cooldown/C.FIRE_COOLDOWN);
  const title=['01 / MOVE YOUR SHIP','02 / BEND YOUR FIRST SHOT','03 / FIND A NEW ANGLE','YOU’VE GOT THE ANGLE.'][this.stage];
  const moveText=this.modern?(device.touch?'Push the left stick. Your weapon aims separately.':'Use WASD to move. Your weapon aims separately.'):(device.touch?'Push the left stick to move.':'Hold W to thrust. A / D turns your ship.');
  const aimText=this.modern?(device.touch?'Hold the right stick toward the planet’s edge to aim and fire.':'Aim beside the planet with your mouse. Hold left click to fire.'):(device.touch?'Point the left stick beside the planet. Hold FIRE.':'Hold A / D to aim beside the planet. Hold SPACE to fire.');
  this.title.setText(pause.paused?'PAUSED':title);
  this.detail.setText(pause.paused?'Return to this window to continue.':this.stage===0?moveText:this.stage===3?'Now dodge, reposition, and use gravity to outplay your rival.':aimText);
  this.next.setVisible(this.stage===3&&!pause.paused);
  const g=this.art.clear();bodies.forEach(b=>drawCelestial(g,b,this.seconds));
  if(this.stage===0){g.lineStyle(2,0x69f4df,.3).strokeCircle(this.spawn.x,this.spawn.y,82);this.targetLabel.setVisible(false);}
  else{
   const done=this.stage===3;
   g.fillStyle(done?0x69f4df:0xffcf83,.08).fillCircle(this.target.x,this.target.y,45);
   g.lineStyle(2.5,done?0x69f4df:0xffcf83,.9).strokeCircle(this.target.x,this.target.y,this.target.radius);
   g.lineBetween(this.target.x-12,this.target.y,this.target.x+12,this.target.y).lineBetween(this.target.x,this.target.y-12,this.target.x,this.target.y+12);
   this.targetLabel.setPosition(this.target.x,this.target.y+48).setText(done?'NICE SHOT':'TARGET').setVisible(true);
   if(!done)drawTrajectory(g,simulateTrajectory(createProjectile(this.ship),bodies,[this.target],this.stageTime>12?2:1.35).points,1,.85);
  }
  const help=this.stage>0&&this.stage<3&&(this.stageTime>10||this.misses>=3);
  this.hint.setVisible(help&&!pause.paused);
  if(help){const x=this.ship.x+Math.cos(this.hintAngle)*220,y=this.ship.y+Math.sin(this.hintAngle)*220;
   g.lineStyle(2,0xffcf83,.7).strokeCircle(x,y,18);this.hint.setPosition(x,y-31).setText(this.modern&&!device.touch?'AIM HERE':'TRY THIS ANGLE');}
  drawShip(g,this.ship,this.seconds,profile.paintColor);
  for(const b of this.bullets){b.trail.forEach((p,i)=>{if(i%3===0)g.fillStyle(0x69f4df,i/b.trail.length*.6).fillCircle(p.x,p.y,2.5);});g.fillStyle(0x69f4df,.2).fillCircle(b.x,b.y,11).fillStyle(0xf0ffff).fillCircle(b.x,b.y,4);}
 }
}
