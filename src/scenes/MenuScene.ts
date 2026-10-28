import Phaser from 'phaser';
import { MAPS } from '../maps/maps.js';
import { drawBackground,drawBody,drawShip,label } from '../rendering/draw.js';
import { bindMenuKeys } from '../ui/menu.js';
import { button,soundButton } from '../ui/widgets.js';
import { device,pause,platform,profile,sound } from '../platform/runtime.js';
export class MenuScene extends Phaser.Scene {
  private art!:Phaser.GameObjects.Graphics; private seconds=0;
  constructor(){super('Menu');}
  create():void {
    platform.setGameplay(false);drawBackground(this);this.seconds=0;
    label(this,64,44,'ORBITAL COMBAT  / 0.12.5',22,'#70e9d4');
    this.add.text(60,102,'GRAVITY\nDUEL',{resolution:2,fontFamily:'Arial',fontSize:'82px',fontStyle:'bold',color:'#f0f6ff',lineSpacing:-13});
    label(this,65,294,'A little gravity. A perfect shot.',26,'#b8cbdf');
    const saved=profile.data.runIndex;
    button(this,64,365,saved===null?474:320,86,saved===null?'PLAY  →':'CONTINUE →',()=>this.startRun(saved??0));
    if(saved!==null)button(this,402,365,136,86,'NEW RUN',()=>this.startRun(0),0xa9c1d9);
    button(this,64,469,474,66,device.touch?'CONTROLS: DUAL STICK':'CONTROLS: MOVE + MOUSE',()=>this.scene.start('Tutorial',{returnToMenu:true}),0x9db6df);
    button(this,64,553,228,66,'CAMPAIGN',()=>this.scene.start('MapSelect',{mode:'1p'}),0xa9c1d9);
    button(this,310,553,228,66,'HANGAR',()=>this.scene.start('Hangar'),0xa9c1d9);
    button(this,64,636,228,58,'FLIGHT SCHOOL',()=>this.scene.start('Tutorial',{returnToMenu:true}),0x8aacca);
    button(this,310,636,228,58,'ONLINE',()=>this.scene.start('OnlineLobby'),0x8aacca);
    soundButton(this,868,35,350,62);
    this.art=this.add.graphics();
    label(this,932,554,'MAKE SPACE YOUR WEAPON',28,'#e8f4ff').setOrigin(.5);
    label(this,932,598,device.touch?'Left: move · Right: aim, release to fire':'WASD to move · Mouse to aim + fire',22,'#a9c6d8').setOrigin(.5);
    label(this,932,644,profile.data.cleared.length+' / 30 CLEARED · 3 UNITS',22,'#70e9d4').setOrigin(.5);
    if(!profile.persistent)label(this,932,687,'Progress lasts only this visit.',22,'#ffce83').setOrigin(.5);
    bindMenuKeys(this,key=>{if(pause.paused)return;if(key==='Enter'||key==='Space')this.startRun(saved??0);});
    platform.markGameReady();
    if(new URLSearchParams(location.search).has('room')){history.replaceState(null,'',location.pathname+location.search);this.scene.start('OnlineLobby');}
  }
  update(_t:number,dt:number):void {
    if(pause.paused)return;this.seconds+=Math.min(dt,50)/1000;
    const g=this.art.clear(),t=this.seconds;
    g.lineStyle(1,0x6fbcce,.18).strokeCircle(935,326,188).strokeCircle(935,326,222);
    drawBody(g,{...MAPS[0].bodies[0],x:936,y:326,radius:119,collisionRadius:119},t);
    const curve=new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(693,451),new Phaser.Math.Vector2(716,125),new Phaser.Math.Vector2(1114,112),new Phaser.Math.Vector2(1171,307));
    const points=curve.getPoints(75);
    for(let i=1;i<points.length;i++)g.lineStyle(2,0x69f4df,.12+i/points.length*.55).lineBetween(points[i-1].x,points[i-1].y,points[i].x,points[i].y);
    const p=curve.getPoint((t*.18)%1);g.fillStyle(0x69f4df,.14).fillCircle(p.x,p.y,13).fillStyle(0xf5ffff).fillCircle(p.x,p.y,4);
    g.save().translateCanvas(690,455).scaleCanvas(1.9,1.9);drawShip(g,{x:0,y:0,angle:-1.3,id:1,thrusting:true},t,profile.paintColor);g.restore();
    g.save().translateCanvas(1170,315).scaleCanvas(1.45,1.45);drawShip(g,{x:0,y:0,angle:2.8,id:2,thrusting:false},t);g.restore();
  }
  private startRun(index:number):void {
    if(pause.paused)return;sound.unlock();profile.begin(index);
    this.scene.start(index===0&&!profile.data.tutorialDone?'Tutorial':'Game',{mode:'1p',arcadeIndex:index});
  }
}
