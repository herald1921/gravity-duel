import Phaser from 'phaser';
import { OnlineClient, onlineEndpoint } from '../net/OnlineClient.js';
import { drawBackground, label } from '../rendering/draw.js';
import { platform } from '../platform/runtime.js';
import { CAMPAIGN_MAPS } from '../maps/campaign.js';
export class OnlineLobbyScene extends Phaser.Scene {
  private client?:OnlineClient;private handedOff=false;
  constructor(){super('OnlineLobby');}
  create():void {
    platform.setGameplay(false);drawBackground(this);label(this,640,70,'ONLINE FLIGHT DECK',42,'#70e9d4').setOrigin(.5);this.handedOff=false;
    const panel=document.createElement('div');panel.className='online-panel';
    panel.innerHTML=`<p>Computer + phone · One pilot per device</p><label>Battle <select id="battle"><option value="ffa">Four-way free-for-all</option><option value="teams">2 vs 2 teams</option></select></label><label>Arena <select id="arena"></select></label><div class="online-actions"><button id="random" disabled>Find a match</button><button id="create" disabled>Create friend room</button></div><label>Room code <input id="code" maxlength="8" autocomplete="off" spellcheck="false" placeholder="8-character code"></label><button id="join" disabled>Join friend room</button><p id="net-status" role="status">Checking server…</p><div id="room"></div><div class="online-actions"><button id="start" hidden>Start match</button><button id="copy" hidden>Copy invite</button><button id="back">Back</button></div>`;
    document.body.append(panel);
    const el=<T extends HTMLElement>(id:string)=>panel.querySelector<T>('#'+id)!;
    const select=el<HTMLSelectElement>('arena');for(const map of CAMPAIGN_MAPS.filter(m=>m.boss===undefined)){
      const option=document.createElement('option');option.value=map.id;option.textContent=`${map.unitIndex!+1}-${map.stageIndex!+1} · ${map.name}`;select.append(option);
    }select.value='unit-1-5';
    const code=el<HTMLInputElement>('code');code.value=new URLSearchParams(location.search).get('room')??'';if(code.value){const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url.pathname+url.search+url.hash);}
    let endpoint:string|null=null,active=true;
    void onlineEndpoint().then(value=>{if(!active)return;endpoint=value;el('net-status').textContent=value?'Ready. Empty seats become AI; at least 2 people are required.':'Public server is not deployed yet. Solo campaign is available.';for(const id of ['random','create','join'])el<HTMLButtonElement>(id).disabled=!value;});
    const update=()=>{
      const client=this.client!;el('net-status').textContent=client.status;const room=client.room;
      if(room){el('room').textContent=`ROOM ${room.code} · ${room.players.length}/4 pilots · You are P${client.id} · `+room.players.map(p=>'P'+p.id+(p.connected?' online':' reconnecting')).join(' / ');
        el<HTMLButtonElement>('start').hidden=room.owner!==client.id;el<HTMLButtonElement>('start').disabled=room.players.length<2;
        el<HTMLButtonElement>('copy').hidden=false;
      }
      if(room?.started){this.handedOff=true;this.scene.start('Game',{online:client});}
    };
    let unsubscribe=()=>{};
    for(const type of ['random','create','join'])el(type).onclick=()=>{if(!endpoint)return;unsubscribe();this.client?.close();
      this.client=new OnlineClient(endpoint,{type,mode:el<HTMLSelectElement>('battle').value,mapId:select.value,code:code.value.trim().toUpperCase()});unsubscribe=this.client.subscribe(update);update();};
    el('start').onclick=()=>this.client?.send({type:'start'});
    el('copy').onclick=()=>{if(!this.client?.room)return;const url=new URL(location.href);url.search='';url.searchParams.set('room',this.client.room.code);
      void navigator.clipboard.writeText(url.href).then(()=>{el('net-status').textContent='Invite copied. Open it on another device.';},()=>{el('net-status').textContent='Share room code: '+this.client!.room!.code;});};
    el('back').onclick=()=>this.scene.start('Menu');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{active=false;unsubscribe();panel.remove();if(!this.handedOff)this.client?.close();});
  }
}
