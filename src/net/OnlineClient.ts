import type { ShipControl, PlayerId } from '../entities/Ship.js';
import type { OnlineMode, Snapshot } from '../game/OnlineRuntime.js';
export interface Room {type:'room';code:string;mode:OnlineMode;mapId:string;started:boolean;owner:PlayerId;players:{id:PlayerId;connected:boolean}[];countdown:number|null}
export class OnlineClient {
  id:PlayerId=1;token='';room?:Room;snapshot?:Snapshot;latency=0;status='Connecting…';connected=false;
  private ws?:WebSocket;private stopped=false;private attempts=0;private ping?:ReturnType<typeof setInterval>;
  private retry?:ReturnType<typeof setTimeout>;private listeners=new Set<()=>void>();private receivedAt=0;private previous?:Snapshot;private trails=new Map<string,{x:number;y:number}[]>();private interval=50;
  constructor(private endpoint:string,private initial:Record<string,unknown>){this.connect();}
  subscribe(fn:()=>void):()=>void {this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  private notify():void{this.listeners.forEach(fn=>fn());}
  get healthy():boolean{return this.connected&&(!this.room?.started||performance.now()-this.receivedAt<1500);}
  private connect():void {
    if(this.stopped)return;
    const ws=this.ws=new WebSocket(this.endpoint);
    ws.onopen=()=>{this.connected=true;this.attempts=0;this.status='Connected';this.send(this.token?{type:'resume',token:this.token}:this.initial);
      clearInterval(this.ping);this.ping=setInterval(()=>this.send({type:'ping',time:Date.now()}),3000);this.notify();};
    ws.onmessage=event=>{try{const msg=JSON.parse(event.data);
      if(msg.type==='joined'){this.id=msg.id;this.token=msg.token;}
      if(msg.type==='room'){this.room=msg;this.status=msg.started?'Connected':msg.countdown!==null?'Starting in '+msg.countdown+'…':'Waiting for another player…';}
      if(msg.type==='snapshot'){
        const alive=new Set<string>();for(const b of msg.state.bullets){const id=b.netId;alive.add(id);let trail=this.trails.get(id)??[];const last=trail.at(-1);if(last&&Math.hypot(last.x-b.x,last.y-b.y)>150)trail=[];trail.push({x:b.x,y:b.y});if(trail.length>(b.kind==='normal'?8:24))trail.shift();this.trails.set(id,trail);b.trail=[...trail];}for(const id of this.trails.keys())if(!alive.has(id))this.trails.delete(id);
        this.previous=this.snapshot;this.snapshot=msg.state;const now=performance.now();this.interval=Math.max(16,Math.min(150,now-this.receivedAt));this.receivedAt=now;}
      if(msg.type==='pong')this.latency=Math.max(0,Date.now()-msg.time);
      if(msg.type==='error')this.status=msg.message;
      this.notify();
    }catch{this.status='Invalid server response';this.notify();}};
    ws.onerror=()=>{this.status='Connection failed. The free server may be waking up.';this.notify();};
    ws.onclose=()=>{this.connected=false;clearInterval(this.ping);if(this.stopped)return;
      this.status='Connection lost · retrying…';this.notify();
      if(++this.attempts<=10)this.retry=setTimeout(()=>this.connect(),Math.min(5000,1000*this.attempts));
      else{this.status='Unable to connect. Return to the lobby and retry.';this.notify();}
    };
  }
  renderState():Snapshot|undefined {
    const s=this.snapshot,p=this.previous;if(!s||!p||s.phase!==p.phase)return s;
    const t=Math.max(0,Math.min(1,(performance.now()-this.receivedAt)/this.interval));
    const point=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)>150?{x:b.x,y:b.y}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    const angle=(a:number,b:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
    return {...s,time:p.time+(s.time-p.time)*t,ships:s.ships.map((b,i)=>{const a=p.ships[i];return !a||a.alive!==b.alive?b:{...b,...point(a,b),angle:angle(a.angle,b.angle),hullAngle:angle(a.hullAngle,b.hullAngle)};}),
      bullets:s.bullets.map(b=>{const a=p.bullets.find(a=>a.netId===b.netId);return a?{...b,...point(a,b)}:b;})};
  }
  send(value:unknown):void {if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(value));}
  input(control:ShipControl):void{this.send({type:'input',control});}
  close():void{this.stopped=true;clearTimeout(this.retry);clearInterval(this.ping);this.send({type:'leave'});this.ws?.close();this.listeners.clear();}
}
export async function onlineEndpoint():Promise<string|null>{
  if(import.meta.env.DEV && ['127.0.0.1','localhost'].includes(location.hostname))return 'ws://'+location.hostname+':8787';
  try {const config=await(await fetch('./online.json',{cache:'no-store'})).json();
    if(typeof config.endpoint==='string'&&/^wss:\/\//.test(config.endpoint))return config.endpoint;
  }catch{}return null;
}
