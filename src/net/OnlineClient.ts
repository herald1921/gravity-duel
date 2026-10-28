import type { ShipControl, PlayerId } from '../entities/Ship.js';
import { OnlineRuntime, snapshot, applySnapshot, type OnlineMode, type Snapshot } from '../game/OnlineRuntime.js';
import { TrajectoryPlanner } from '../ai/TrajectoryPlanner.js';
import { PHYSICS_DT } from '../config.js';
import { PeerLink } from './PeerLink.js';
import { boundedInput } from './input.js';
export interface Room {type:'room';code:string;mode:OnlineMode;mapId:string;started:boolean;owner:PlayerId;host:PlayerId;epoch:number;round:number;players:{id:PlayerId;connected:boolean;visible:boolean}[];countdown:number|null}
type Packet = {epoch:number;round:number;seq:number;type:string;state?:Snapshot;control?:ShipControl;time?:number;waiting?:boolean};
export class OnlineClient {
  id:PlayerId=1;token='';room?:Room;snapshot?:Snapshot;latency=0;status='Connecting…';connected=false;waiting=true;
  private ws?:WebSocket;private stopped=false;private attempts=0;private ping?:ReturnType<typeof setInterval>;
  private retry?:ReturnType<typeof setTimeout>;private listeners=new Set<()=>void>();private receivedAt=0;private previous?:Snapshot;private trails=new Map<string,{x:number;y:number}[]>();private interval=50;
  private links=new Map<PlayerId,PeerLink>();private runtime?:OnlineRuntime;private planner?:TrajectoryPlanner;
  private accumulator=0;private publishIn=0;private pulseIn=0;private echoIn=0;private seq=0;private lastState=-1;
  private lastInput=new Map<PlayerId,number>();private inputAt=new Map<PlayerId,number>();private round=0;private epoch=0;
  private visible=()=>this.send({type:'visibility',visible:!document.hidden});
  constructor(private endpoint:string,private initial:Record<string,unknown>){document.addEventListener('visibilitychange',this.visible);this.connect();}
  subscribe(fn:()=>void):()=>void {this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  private notify():void{this.listeners.forEach(fn=>fn());}
  get healthy():boolean{return this.connected&&(!this.room?.started||performance.now()-this.receivedAt<1500);}
  get transport():string {return this.room?.host===this.id?'HOST':this.links.get(this.room?.host??1)?.direct?'DIRECT':'RELAY';}
  private connect():void {
    if(this.stopped)return;
    const ws=this.ws=new WebSocket(this.endpoint);
    ws.onopen=()=>{this.connected=true;this.attempts=0;this.status='Connected';this.send(this.token?{type:'resume',token:this.token}:{...this.initial,desktop:!matchMedia('(pointer:coarse)').matches});this.visible();
      clearInterval(this.ping);this.ping=setInterval(()=>{if(!this.room?.started)this.send({type:'ping',time:Date.now()});},20000);this.notify();};
    ws.onmessage=event=>{try{const msg=JSON.parse(event.data);
      if(msg.type==='joined'){this.id=msg.id;this.token=msg.token;}
      if(msg.type==='room')this.updateRoom(msg);
      if((msg.type==='signal'||msg.type==='relay')&&msg.epoch===this.room?.epoch&&msg.round===this.room?.round){
        if(msg.type==='signal')void this.links.get(msg.from)?.accept(msg.data);
        else this.receive(msg.from,msg.payload);
      }
      if(msg.type==='pong'&&!this.room?.started)this.latency=Math.max(0,Date.now()-msg.time);
      if(msg.type==='error'||msg.type==='relayBusy')this.status=msg.message;
      this.notify();
    }catch{this.status='Invalid server response';this.notify();}};
    ws.onerror=()=>{this.status='Connection failed. The free server may be waking up.';this.notify();};
    ws.onclose=()=>{this.connected=false;clearInterval(this.ping);this.stopHost();this.closeLinks();this.epoch=0;if(this.stopped)return;
      this.status='Connection lost · retrying…';this.notify();
      if(++this.attempts<=10)this.retry=setTimeout(()=>this.connect(),Math.min(5000,1000*this.attempts));
      else{this.status='Unable to connect. Return to the lobby and retry.';this.notify();}
    };
  }
  private closeLinks():void {for(const link of this.links.values())link.close();this.links.clear();}
  private stopHost():void {this.runtime=undefined;this.planner?.destroy();this.planner=undefined;this.accumulator=0;}
  private updateRoom(room:Room):void {
    this.room=room;
    if(!room.started){this.status=room.countdown!==null?'Starting in '+room.countdown+'…':'Waiting for another player…';return;}
    if(room.epoch!==this.epoch||room.round!==this.round){
      const sameRound=room.round===this.round;this.stopHost();if(room.epoch!==this.epoch)this.closeLinks();this.lastInput.clear();this.inputAt.clear();this.lastState=-1;
      this.epoch=room.epoch;this.round=room.round;this.publishIn=0;this.pulseIn=0;
      if(!sameRound){this.snapshot=undefined;this.previous=undefined;this.trails.clear();}
      if(room.host===this.id){
        this.planner=new TrajectoryPlanner();this.runtime=new OnlineRuntime(room.mapId,room.mode,this.planner.request);
        if(sameRound&&this.snapshot)applySnapshot(this.runtime.match,structuredClone(this.snapshot));
        this.status=sameRound?'Taking over hosting…':'Connecting players…';
      }else this.status=sameRound?'Switching host…':'Connecting to host…';
    }
    const wanted=room.players.filter(p=>p.connected&&p.id!==this.id&&(this.id===room.host||p.id===room.host)).map(p=>p.id);
    for(const [id,link] of this.links)if(!wanted.includes(id)){link.close();this.links.delete(id);}
    for(const id of wanted)if(!this.links.has(id)){
      try {this.links.set(id,new PeerLink(this.id===room.host,data=>this.send({type:'signal',to:id,epoch:this.epoch,round:this.round,data}),data=>this.receive(id,data)));}
      catch {this.status='Direct connection unavailable · trying limited relay';}
    }
    if(this.runtime){this.runtime.humans.clear();for(const p of room.players)if(p.connected&&p.visible)this.runtime.humans.add(p.id);}
  }
  private packet(type:string,extra:Partial<Packet>={}):Packet{return {type,seq:++this.seq,epoch:this.epoch,round:this.round,...extra};}
  private transmit(to:PlayerId,packet:Packet):void {
    const link=this.links.get(to);if(link?.send(packet,packet.type==='state'))return;
    // Allow ICE three seconds before consuming the very small fallback relay pool.
    if(!link||performance.now()-link.createdAt>3000)this.send({type:'relay',to,epoch:this.epoch,round:this.round,payload:packet});
  }
  private receive(from:PlayerId,value:unknown):void {
    const p=value as Packet;if(!p||p.epoch!==this.epoch||p.round!==this.round||!Number.isSafeInteger(p.seq))return;
    if(p.type==='state'&&from===this.room?.host&&this.id!==from&&p.state&&p.seq>this.lastState){
      if(!Array.isArray(p.state.ships)||p.state.ships.length!==4||!Array.isArray(p.state.bullets))return;
      this.lastState=p.seq;this.waiting=p.waiting===true;this.acceptSnapshot(p.state);this.status=this.waiting?'Waiting for player connection…':this.transport==='DIRECT'?'Direct connection':'Using limited relay';
    }
    if(p.type==='input'&&this.runtime&&this.room?.players.some(q=>q.id===from&&q.connected)&&p.seq>(this.lastInput.get(from)??-1)){
      this.lastInput.set(from,p.seq);this.inputAt.set(from,performance.now());this.runtime.input(from,boundedInput(p.control));
    }
    if(p.type==='echo')this.transmit(from,this.packet('echoReply',{time:p.time}));
    if(p.type==='echoReply'&&typeof p.time==='number')this.latency=Math.max(0,Math.round(performance.now()-p.time));
  }
  private acceptSnapshot(state:Snapshot):void {
    const alive=new Set<string>();for(const b of state.bullets){const id=b.netId;alive.add(id);let trail=this.trails.get(id)??[];const last=trail.at(-1);if(last&&Math.hypot(last.x-b.x,last.y-b.y)>150)trail=[];trail.push({x:b.x,y:b.y});if(trail.length>(b.kind==='normal'?8:24))trail.shift();this.trails.set(id,trail);b.trail=[...trail];}for(const id of this.trails.keys())if(!alive.has(id))this.trails.delete(id);
    this.previous=this.snapshot;this.snapshot=state;const now=performance.now();this.interval=Math.max(16,Math.min(150,now-this.receivedAt));this.receivedAt=now;
  }
  /** Called even while the player's controls are paused; world simulation belongs to the room. */
  tick(dt:number):void {
    if(!this.connected||!this.room?.started||document.hidden)return;
    this.echoIn-=dt;if(this.echoIn<=0){this.echoIn=3;for(const id of this.links.keys())this.transmit(id,this.packet('echo',{time:performance.now()}));}
    if(!this.runtime)return;
    this.pulseIn-=dt;if(this.pulseIn<=0){this.pulseIn=3;this.send({type:'hostPulse'});}
    // A match waits for all connected humans to reach its host. No AI kills during negotiation.
    const ready=this.room.players.every(p=>!p.connected||!p.visible||p.id===this.id||performance.now()-(this.inputAt.get(p.id)??-Infinity)<2000);
    this.waiting=!ready;
    if(ready){this.accumulator+=Math.min(.1,dt);while(this.accumulator>=PHYSICS_DT){this.runtime.step();this.accumulator-=PHYSICS_DT;}this.status='Hosting on this device';}
    else {this.accumulator=0;this.status='Waiting for player connection…';}
    this.publishIn-=dt;if(this.publishIn<=0){this.publishIn=.05;
      const state=structuredClone(snapshot(this.runtime.match));const packet=this.packet('state',{state,waiting:this.waiting});
      for(const id of this.links.keys())this.transmit(id,packet);this.acceptSnapshot(state);
    }
  }
  renderState():Snapshot|undefined {
    const s=this.snapshot,p=this.previous;if(!s||!p||s.phase!==p.phase)return s;
    const t=Math.max(0,Math.min(1,(performance.now()-this.receivedAt)/this.interval));
    const point=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)>150?{x:b.x,y:b.y}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    const angle=(a:number,b:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
    return {...s,time:p.time+(s.time-p.time)*t,ships:s.ships.map((b,i)=>{const a=p.ships[i];return !a||a.alive!==b.alive?b:{...b,...point(a,b),angle:angle(a.angle,b.angle),hullAngle:angle(a.hullAngle,b.hullAngle)};}),
      bullets:s.bullets.map(b=>{const a=p.bullets.find(a=>a.netId===b.netId);return a?{...b,...point(a,b)}:b;})};
  }
  send(value:unknown):void {if(this.ws?.readyState===WebSocket.OPEN&&this.ws.bufferedAmount<256000)this.ws.send(JSON.stringify(value));}
  input(control:ShipControl):void{if(!this.connected||!this.room?.started)return;const input=boundedInput(control);if(this.runtime)this.runtime.input(this.id,input);else this.transmit(this.room.host,this.packet('input',{control:input}));}
  close():void{this.stopped=true;clearTimeout(this.retry);clearInterval(this.ping);document.removeEventListener('visibilitychange',this.visible);this.send({type:'leave'});this.ws?.close();this.stopHost();this.closeLinks();this.listeners.clear();}
}
export async function onlineEndpoint():Promise<string|null>{
  if(import.meta.env.DEV && ['127.0.0.1','localhost'].includes(location.hostname))return 'ws://'+location.hostname+':8787';
  try {const config=await(await fetch('./online.json',{cache:'no-store'})).json();
    if(typeof config.endpoint==='string'&&/^wss:\/\//.test(config.endpoint))return config.endpoint;
  }catch{}return null;
}
