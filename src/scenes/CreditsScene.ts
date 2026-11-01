import Phaser from 'phaser';
import { drawBackground, label } from '../rendering/draw.js';
import { button } from '../ui/widgets.js';
import { bindMenuKeys } from '../ui/menu.js';
export class CreditsScene extends Phaser.Scene {
  constructor(){super('Credits');}
  create():void{
    drawBackground(this);
    label(this,90,65,'ART & AUDIO',40);
    label(this,90,160,'PLANET TEXTURES · SOLAR SYSTEM SCOPE / INOVE',27,'#70e9d4');
    label(this,90,210,'Earth, Moon and Mars — original 2K maps\nwww.solarsystemscope.com/textures/\nCreative Commons Attribution 4.0 International\ncreativecommons.org/licenses/by/4.0/\nAdapted with illustrated palettes, spherical projection and lighting.',24,'#b4c9dc').setLineSpacing(10);
    label(this,90,435,'MUSIC · OUTER SPACE LOOP BY WIPICS',27,'#70e9d4');
    label(this,90,482,'opengameart.org/content/outer-space-loop\nCC0 1.0 / Public Domain',24,'#b4c9dc').setLineSpacing(10);
    button(this,90,595,320,70,'BACK TO MENU',()=>this.scene.start('Menu'));
    bindMenuKeys(this,key=>{if(key==='Escape')this.scene.start('Menu');});
  }
}
