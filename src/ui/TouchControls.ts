import Phaser from 'phaser';
import { TouchState, type TouchAction } from '../input/TouchState.js';
import { label } from '../rendering/draw.js';
export class TouchControls {
  readonly state:TouchState; private enabled=false; private container:Phaser.GameObjects.Container;
  private art:Phaser.GameObjects.Graphics; private cooldown=0;
  constructor(scene:Phaser.Scene,private dual=true) {
    this.state=new TouchState(dual);this.container=scene.add.container(0,0).setDepth(14);this.art=scene.add.graphics();
    const zone=(cx:number,aim:boolean)=>{
      const z=scene.add.zone(cx,562,230,230).setInteractive(new Phaser.Geom.Circle(115,115,115),Phaser.Geom.Circle.Contains);
      z.on('pointerdown',(p:Phaser.Input.Pointer)=>{
        if(!this.enabled)return;
        if(aim) {if(this.dual)this.state.beginAim(p.id,(p.x-1118)/70,(p.y-562)/70);else this.state.press(p.id,'fire');}
        else this.state.beginStick(p.id,(p.x-162)/70,(p.y-562)/70);
      });return z;
    };
    this.container.add([this.art,zone(162,false),zone(1118,true),
      label(scene,162,689,'MOVE',22,'#9ddacf').setOrigin(.5),
      label(scene,1118,689,dual?'AIM + FIRE':'FIRE',22,'#ffc7a9').setOrigin(.5)]);
    const move=(p:Phaser.Input.Pointer)=>{if(!this.enabled||!p.isDown)return;this.state.moveStick(p.id,(p.x-162)/70,(p.y-562)/70);this.state.moveAim(p.id,(p.x-1118)/70,(p.y-562)/70);};
    const release=(p:Phaser.Input.Pointer)=>this.state.release(p.id),clear=()=>this.state.clear();
    scene.input.on('pointermove',move);scene.input.on('pointerup',release);scene.input.on('pointerupoutside',release);scene.input.on('gameout',clear);
    scene.game.canvas.addEventListener('pointercancel',clear);scene.game.canvas.addEventListener('touchcancel',clear);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      scene.input.off('pointermove',move);scene.input.off('pointerup',release);scene.input.off('pointerupoutside',release);scene.input.off('gameout',clear);
      scene.game.canvas.removeEventListener('pointercancel',clear);scene.game.canvas.removeEventListener('touchcancel',clear);clear();
    });
  }
  setReload(fraction:number):void {this.cooldown=Math.max(0,Math.min(1,fraction));}
  update(enabled:boolean,highlight?:TouchAction):void {
    this.enabled=enabled;this.container.setVisible(enabled);if(!enabled)this.state.clear();
    const g=this.art.clear();
    for(const [cx,aim] of [[162,false],[1118,true]] as const) {
      const p=aim?this.state.aimPosition:this.state.stickPosition,c=aim?0xffc78e:0x69f4df,active=aim?(this.dual?p.held:this.state.down('fire')):p.held;
      g.fillStyle(0x071529,.5).fillCircle(cx,562,96).lineStyle(2,c,active?.85:.35).strokeCircle(cx,562,96);
      g.lineStyle(1,c,.16).lineBetween(cx-74,562,cx+74,562).lineBetween(cx,488,cx,636);
      if(aim)g.lineStyle(4,c,.8).beginPath().arc(cx,562,103,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-this.cooldown)).strokePath();
      if(this.dual||!aim) {
        g.lineStyle(6,c,.2).lineBetween(cx,562,cx+p.x*70,562+p.y*70);
        g.fillStyle(active?c:0x365168,active?.65:.7).fillCircle(cx+p.x*70,562+p.y*70,27).lineStyle(2,c,.8).strokeCircle(cx+p.x*70,562+p.y*70,27);
      }else g.fillStyle(c,.75).fillTriangle(cx+18,562,cx-10,547,cx-10,577);
      if(highlight&&(aim?highlight==='fire':highlight!=='fire'))g.lineStyle(3,c,.75).strokeCircle(cx,562,111);
    }
  }
}
