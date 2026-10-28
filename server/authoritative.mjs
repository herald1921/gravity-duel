import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { OnlineRuntime, snapshot } from '../.server-build/game/OnlineRuntime.js';
const rooms=new Map(), peers=new Set(), maxRooms=Number(process.env.MAX_ROOMS||1);
const origins=(process.env.ALLOWED_ORIGINS||'https://herald1921.github.io,http://127.0.0.1:5176,http://localhost:5176').split(',');
const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,version:'0.12.0',rooms:rooms.size}));});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
  if(!origins.includes(req.headers.origin)||peers.size>=32){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
function send(p,v){if(p.ws.readyState===1&&p.ws.bufferedAmount<512000)p.ws.send(JSON.stringify(v,(_key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value));}
function broadcast(r,v){for(const p of r.peers)send(p,v);}
function state(r){return {type:'room',code:r.code,mode:r.mode,mapId:r.mapId,started:!!r.runtime,owner:r.peers[0]?.id,
  players:r.peers.map(p=>({id:p.id,connected:p.ws.readyState===1})),countdown:r.startAt?Math.max(0,Math.ceil((r.startAt-Date.now())/1000)):null};}
function leave(p){const r=p.room;if(!r)return;r.runtime?.humans.delete(p.id);r.peers=r.peers.filter(q=>q!==p);p.room=null;
  if(!r.peers.length)rooms.delete(r.code);else broadcast(r,state(r));}
function start(r){if(r.peers.length<2)return;r.runtime=new OnlineRuntime(r.mapId,r.mode);for(const p of r.peers)r.runtime.humans.add(p.id);r.startAt=0;broadcast(r,state(r));}
function join(p,r){if(r.runtime||r.peers.length>=4)throw Error('Room full or match already started.');
  p.id=[1,2,3,4].find(id=>!r.peers.some(q=>q.id===id));p.room=r;r.peers.push(p);send(p,{type:'joined',id:p.id,token:p.token});
  if(r.random&&r.peers.length>=2&&!r.startAt)r.startAt=Date.now()+4000;broadcast(r,state(r));}
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):0;
wss.on('connection',ws=>{
  const p={ws,token:randomBytes(24).toString('hex'),id:0,room:null,lastSeen:Date.now(),window:Date.now(),messages:0};peers.add(p);
  ws.on('pong',()=>p.lastSeen=Date.now());
  ws.on('message',raw=>{try{
    if(Date.now()-p.window>1000){p.window=Date.now();p.messages=0;}if(++p.messages>90){ws.close(1008,'Rate limit');return;}
    const msg=JSON.parse(raw);if(!msg||typeof msg!=='object')return;p.lastSeen=Date.now();
    if(msg.type==='ping'){send(p,{type:'pong',time:msg.time});return;}
    if(msg.type==='resume'){
      const old=[...peers].find(q=>q!==p&&q.token===msg.token&&q.room&&q.ws.readyState!==1);
      if(!old)throw Error('Previous room expired. Please join again.');
      const r=old.room;p.token=old.token;p.id=old.id;p.room=r;r.peers=r.peers.map(q=>q===old?p:q);peers.delete(old);r.runtime?.humans.add(p.id);
      send(p,{type:'joined',id:p.id,token:p.token});send(p,state(r));return;
    }
    if(msg.type==='input'){
      const c=msg.control;if(!p.room?.runtime||!c||typeof c!=='object')return;
      const input={turn:finite(c.turn,-1,1),thrust:finite(c.thrust,-1,1),fire:c.fire===true,independentAim:true};
      if(typeof c.aim==='number'&&Number.isFinite(c.aim))input.aim=finite(c.aim,-Math.PI,Math.PI);
      if(c.move&&typeof c.move==='object')input.move={x:finite(c.move.x,-1,1),y:finite(c.move.y,-1,1)};
      p.room.runtime.input(p.id,input);return;
    }
    if(msg.type==='leave'){leave(p);return;}
    if(msg.type==='start'||msg.type==='rematch'){
      if(p.room?.peers[0]!==p)throw Error('Only the room creator can start.');
      if(msg.type==='rematch'&&p.room.runtime?.match.phase!=='matchOver')return;
      if(msg.type==='start'&&p.room.runtime)return;
      if(p.room.peers.filter(q=>q.ws.readyState===1).length<2)throw Error('Invite a second player first.');start(p.room);return;
    }
    if(!['create','join','random'].includes(msg.type))return;if(p.room)throw Error('Leave the current room first.');
    const mode=msg.mode==='teams'?'teams':'ffa';
    if(msg.type==='join'){const r=rooms.get(String(msg.code).toUpperCase());if(!r)throw Error('Room not found.');join(p,r);return;}
    if(msg.type==='random'){const r=[...rooms.values()].find(r=>r.random&&r.mode===mode&&!r.runtime&&r.peers.length<4);if(r){join(p,r);return;}}
    if(rooms.size>=maxRooms)throw Error('Server is full. Please try again shortly.');
    let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
    const r={code,mode,mapId:typeof msg.mapId==='string'?msg.mapId:'unit-1-5',random:msg.type==='random',peers:[],runtime:null,startAt:0};rooms.set(code,r);join(p,r);
  }catch(e){send(p,{type:'error',message:e instanceof SyntaxError?'Invalid message':e.message});}});
  ws.on('close',()=>{p.lastSeen=Date.now();p.room?.runtime?.humans.delete(p.id);if(!p.room?.runtime){leave(p);peers.delete(p);}else broadcast(p.room,state(p.room));});
  ws.on('error',()=>ws.close());
});
let previous=performance.now(),acc=0,frame=0;
const ticker=setInterval(()=>{
 const now=performance.now();acc+=Math.min(.1,(now-previous)/1000);previous=now;
 for(const r of rooms.values())if(r.startAt&&r.startAt<=Date.now())start(r);
 while(acc>=1/120){for(const r of rooms.values())r.runtime?.step();acc-=1/120;frame++;
  if(frame%6===0)for(const r of rooms.values())if(r.runtime)broadcast(r,{type:'snapshot',state:snapshot(r.runtime.match)});
 }
},8);
const cleanup=setInterval(()=>{for(const p of peers){if(p.ws.readyState===1){if(Date.now()-p.lastSeen>45000)p.ws.terminate();else p.ws.ping();}else if(Date.now()-p.lastSeen>30000){leave(p);peers.delete(p);}}
 for(const r of rooms.values())if(r.startAt)broadcast(r,state(r));},1000);
server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Gravity Duel server ready on '+server.address().port));
function close(){clearInterval(ticker);clearInterval(cleanup);for(const p of peers){send(p,{type:'error',message:'Server restarting. Please reconnect shortly.'});p.ws.close(1012,'Restart');}server.close();setTimeout(()=>process.exit(),1000).unref();}
process.on('SIGTERM',close);process.on('SIGINT',close);
