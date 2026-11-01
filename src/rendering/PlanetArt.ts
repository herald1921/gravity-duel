import type Phaser from 'phaser';
import earthURL from '../../assets/art/earth.jpg';
import moonURL from '../../assets/art/moon.jpg';
import marsURL from '../../assets/art/mars.jpg';
import type { CelestialBody } from '../entities/CelestialBody.js';

// Project licensed equirectangular maps once; gameplay only moves cached sprites.
// The original source files are unchanged. No per-frame pixel processing.
const surfaces = new Map<string, HTMLCanvasElement>();
const sprites = new WeakMap<Phaser.GameObjects.Graphics, Map<string, Phaser.GameObjects.Image>>();
export async function preparePlanetArt(): Promise<void> {
  await Promise.all(Object.entries({earth:earthURL,moon:moonURL,mars:marsURL}).map(async ([name,url]) => {
    try {
      const image = new Image(); image.src = url; await image.decode();
      const source = document.createElement('canvas'); source.width=1024; source.height=512;
      const input=source.getContext('2d',{willReadFrequently:true})!;
      input.filter='blur(4px)'; input.drawImage(image,0,0,1024,512); const pixels=input.getImageData(0,0,1024,512).data;
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d')!, output=ctx.createImageData(512,512);
      for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
        const nx=(x-255.5)/255,ny=(y-255.5)/255, rr=nx*nx+ny*ny;
        if(rr>=1)continue;
        const nz=Math.sqrt(1-rr),u=((Math.atan2(nx,nz)/(Math.PI*2)+.52)*1024)|0;
        const v=Math.min(511,Math.max(0,((Math.asin(ny)/Math.PI+.5)*512)|0));
        const p=(v*1024+u)*4,q=(y*512+x)*4;
        // Terrain is an illustration mask, never photographic RGB. Limited palettes
        // and three broad light planes match the ships' painted armor facets.
        const luminance=(pixels[p]+pixels[p+1]+pixels[p+2])/3;
        const sea=pixels[p+2]>pixels[p]*1.2&&pixels[p+2]>pixels[p+1]*1.04;
        const color=name==='earth'?(sea?[39,99,143]:luminance>155?[155,219,203]:[72,159,154])
          :name==='moon'?(luminance>155?[172,190,210]:luminance>95?[118,145,174]:[73,101,133])
          :pixels[p]>155?[218,157,116]:pixels[p]>110?[180,116,92]:[121,82,86];
        const diffuse=-nx*.52-ny*.4+nz*.75;
        const light=diffuse<.05?.24:diffuse<.45?.62:diffuse<.78?.86:1.08;
        const rim=Math.pow(1-nz,5)*25;
        output.data[q]=Math.min(255,color[0]*light+rim*.4);
        output.data[q+1]=Math.min(255,color[1]*light+rim*.8);
        output.data[q+2]=Math.min(255,color[2]*light+rim);
        output.data[q+3]=Math.min(255,(1-Math.sqrt(rr))*255*255);
      }
      ctx.putImageData(output,0,0); surfaces.set(name,canvas);
    } catch { /* Procedural bodies remain available if a texture fails to load. */ }
  }));
}
export function drawPlanetSurface(g: Phaser.GameObjects.Graphics, body: CelestialBody): boolean {
  if(body.type!=='planet'&&body.type!=='moon')return false;
  const hash=Array.from(body.id).reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0);
  const kind=body.type==='moon'?'moon':hash%3===0?'mars':'earth';
  const canvas=surfaces.get(kind);if(!canvas)return false;
  const key='planet-surface-'+kind;
  if(!g.scene.textures.exists(key))g.scene.textures.addCanvas(key,canvas);
  let group=sprites.get(g);if(!group){group=new Map();sprites.set(g,group);}
  let sprite=group.get(body.id);
  if(!sprite){sprite=g.scene.add.image(body.x,body.y,key);group.set(body.id,sprite);
    g.once('destroy',()=>sprite?.destroy());}
  sprite.setPosition(body.x,body.y).setDisplaySize(body.radius*2,body.radius*2).setDepth(g.depth-.01);
  return true;
}
