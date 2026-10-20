import Phaser from 'phaser';
import {pause,sound} from '../platform/runtime.js';
import {label} from '../rendering/draw.js';
export function button(scene:Phaser.Scene,x:number,y:number,width:number,height:number,text:string,action:()=>void,color=0x77eee3):Phaser.GameObjects.Container {
 const primary=color===0x77eee3,g=scene.add.graphics();
 const paint=(hover:boolean)=>{g.clear().fillStyle(primary?(hover?0x9dffe9:0x69e6cd):(hover?0x223d54:0x13283e),.98).fillRoundedRect(0,0,width,height,12)
  .lineStyle(1.5,primary?0xb3fff0:color,hover?.9:.45).strokeRoundedRect(0,0,width,height,12);
  if(primary)g.fillStyle(0xffffff,.16).fillRoundedRect(2,2,width-4,3,2);};
 paint(false);
 const zone=scene.add.zone(0,0,width,height).setOrigin(0).setInteractive({useHandCursor:true});
 zone.on('pointerover',()=>paint(true));zone.on('pointerout',()=>paint(false));
 zone.on('pointerdown',()=>{if(!pause.has('ad')){sound.unlock();sound.play('click');action();}});
 return scene.add.container(x,y,[g,zone,label(scene,width/2,height/2,text,primary&&height>=80?28:23,primary?'#0b2834':'#e6f2fc').setOrigin(.5)]);
}
export function soundButton(scene:Phaser.Scene,x:number,y:number,width=320,height=64):Phaser.GameObjects.Container {
 const group=scene.add.container(x,y),w=(width-12)/2;
 const make=(music:boolean,left:number)=>{
  const value=()=>music?sound.musicEnabled:sound.enabled;
  const text=label(scene,w/2,height/2,'',22).setOrigin(.5);
  const refresh=()=>text.setText((music?'MUSIC ':'SFX ')+(value()?'ON':'OFF'));
  const b=button(scene,left,0,w,height,'',()=>{if(music)sound.setMusicEnabled(!value());else sound.setEnabled(!value());refresh();},0x97a8c8);
  refresh();b.add(text);group.add(b);
 };make(true,0);make(false,w+12);return group;
}
