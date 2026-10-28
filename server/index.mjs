import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
// This service never imports, simulates or renders game physics. Each room has a browser host.
const rooms=new Map(),peers=new Set(),maxRooms=Number(process.env.MAX_ROOMS||1000),maxRelayRooms=Number(process.env.MAX_RELAY_ROOMS||2);
const origins=(process.env.ALLOWED_ORIGINS||'https://herald1921.github.io,http://127.0.0.1:5176,http://localhost:5176').split(',');
let outbound=0,inbound=0,relayed=0;
const server=http.createServer((req,res)=>{const cpu=process.cpuUsage();res.writeHead(req.url==='/health'?200:404,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,version:'0.12.1',architecture:'peer-hosted',rooms:rooms.size,active:[...rooms.values()].filter(r=>r.started).length,peers:peers.size,cpuSeconds:(cpu.user+cpu.system)/1e6,uptime:process.uptime(),rssMB:Math.round(process.memoryUsage().rss/1048576),outboundBytes:outbound,inboundBytes:inbound,relayBytes:relayed}));});
const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{if(!origins.includes(req.headers.origin)||peers.size>=maxRooms*4+20){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));});
function send(p,value){if(p.ws.readyState===1&&p.ws.bufferedAmount<256000){const data=JSON.stringify(value);outbound+=Buffer.byteLength(data);p.ws.send(data);}}
function broadcast(r,value){for(const p of r.peers)send(p,value);}
function state(r){return {type:'room',code:r.code,mode:r.mode,mapId:r.mapId,started:r.started,owner:r.peers.find(p=>p.ws.readyState===1)?.id,host:r.host,epoch:r.epoch,round:r.round,
 players:r.peers.map(p=>({id:p.id,connected:p.ws.readyState===1,visible:p.visible})),countdown:r.startAt?Math.max(0,Math.ceil((r.startAt-Date.now())/1000)):null};}
function elect(r,exclude){const candidates=r.peers.filter(p=>p.ws.readyState===1&&p!==exclude);candidates.sort((a,b)=>Number(b.visible)-Number(a.visible)||Number(b.desktop)-Number(a.desktop)||a.id-b.id);
 const host=candidates[0]?.id??0;if(host!==r.host){r.host=host;r.epoch++;r.hostPulse=Date.now();}return host;}
function leave(p){const r=p.room;if(!r)return;r.peers=r.peers.filter(q=>q!==p);p.room=null;if(!r.peers.length)rooms.delete(r.code);else{if(r.host===p.id)elect(r);broadcast(r,state(r));}}
function start(r){if(r.peers.filter(p=>p.ws.readyState===1).length<2)return;r.started=true;r.startAt=0;r.round++;elect(r);broadcast(r,state(r));}
function join(p,r){if(r.started||r.peers.length>=4)throw Error('Room full or match already started.');p.id=[1,2,3,4].find(id=>!r.peers.some(q=>q.id===id));p.room=r;r.peers.push(p);send(p,{type:'joined',id:p.id,token:p.token});if(r.random&&r.peers.length>=2&&!r.startAt)r.startAt=Date.now()+4000;broadcast(r,state(r));}
wss.on('connection',ws=>{
 const p={ws,token:randomBytes(24).toString('hex'),id:0,room:null,lastSeen:Date.now(),window:Date.now(),messages:0,bytes:0,visible:true,desktop:true,nextRelayError:0};peers.add(p);
 ws.on('pong',()=>p.lastSeen=Date.now());
 ws.on('message',raw=>{try{
  inbound+=raw.length;if(Date.now()-p.window>1000){p.window=Date.now();p.messages=0;p.bytes=0;}p.bytes+=raw.length;
  if(++p.messages>160||p.bytes>1600000){ws.close(1008,'Rate limit');return;}
  const msg=JSON.parse(raw);if(!msg||typeof msg!=='object')return;p.lastSeen=Date.now();const r=p.room;
  if(msg.type==='ping'){send(p,{type:'pong',time:msg.time});return;}
  if(msg.type==='visibility'){p.visible=msg.visible===true;if(r?.started){const host=r.peers.find(q=>q.id===r.host);if(!host?.visible)elect(r);broadcast(r,state(r));}return;}
  if(msg.type==='hostPulse'){if(r&&r.host===p.id)r.hostPulse=Date.now();return;}
  if(msg.type==='resume'){
   const old=[...peers].find(q=>q!==p&&q.token===msg.token&&q.room&&q.ws.readyState!==1);if(!old)throw Error('Previous room expired. Please join again.');
   const room=old.room;p.token=old.token;p.id=old.id;p.room=room;p.desktop=old.desktop;room.peers=room.peers.map(q=>q===old?p:q);peers.delete(old);if(!room.host)elect(room);send(p,{type:'joined',id:p.id,token:p.token});broadcast(room,state(room));return;
  }
  if(msg.type==='signal'||msg.type==='relay'){
   if(!r?.started||msg.epoch!==r.epoch||msg.round!==r.round)return;
   const target=r.peers.find(q=>q.id===msg.to&&q!==p&&q.ws.readyState===1);if(!target)return;
   if(p.id!==r.host&&target.id!==r.host)return;
   if(msg.type==='relay'){
    if(!msg.payload||!['state','input','echo','echoReply'].includes(msg.payload.type))return;
    if(msg.payload.type==='state'&&p.id!==r.host)return;
    const now=Date.now();if(r.relayUntil<now&&[...rooms.values()].filter(q=>q.relayUntil>now).length>=maxRelayRooms){if(now>p.nextRelayError){send(p,{type:'relayBusy',message:'Connecting directly — fallback relay is busy.'});p.nextRelayError=now+5000;}return;}
    r.relayUntil=now+5000;relayed+=raw.length;
   }
   send(target,{type:msg.type,from:p.id,epoch:r.epoch,round:r.round,...(msg.type==='signal'?{data:msg.data}:{payload:msg.payload})});return;
  }
  if(msg.type==='leave'){leave(p);return;}
  if(msg.type==='start'||msg.type==='rematch'){
   if(!r||r.peers.find(q=>q.ws.readyState===1)!==p)throw Error('Only the room creator can start.');
   if(msg.type==='start'&&r.started)return;if(r.peers.filter(q=>q.ws.readyState===1).length<2)throw Error('Invite a second player first.');start(r);return;
  }
  if(!['create','join','random'].includes(msg.type))return;if(r)throw Error('Leave the current room first.');p.desktop=msg.desktop!==false;
  const mode=msg.mode==='teams'?'teams':'ffa';if(msg.type==='join'){const room=rooms.get(String(msg.code).toUpperCase());if(!room)throw Error('Room not found.');join(p,room);return;}
  if(msg.type==='random'){const room=[...rooms.values()].find(q=>q.random&&q.mode===mode&&!q.started&&q.peers.length<4);if(room){join(p,room);return;}}
  if(rooms.size>=maxRooms)throw Error('Server is full. Please try again shortly.');let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
  const room={code,mode,mapId:typeof msg.mapId==='string'&&msg.mapId.length<32?msg.mapId:'unit-1-5',random:msg.type==='random',peers:[],started:false,startAt:0,host:0,epoch:0,round:0,hostPulse:0,relayUntil:0};rooms.set(code,room);join(p,room);
 }catch(e){send(p,{type:'error',message:e instanceof SyntaxError?'Invalid message':e.message});}});
 ws.on('close',()=>{p.lastSeen=Date.now();const r=p.room;if(!r?.started){leave(p);peers.delete(p);}else{if(r.host===p.id)elect(r,p);broadcast(r,state(r));}});ws.on('error',()=>ws.close());
});
let heartbeats=0;
const timer=setInterval(()=>{
 for(const p of peers){if(p.ws.readyState===1){if(Date.now()-p.lastSeen>65000)p.ws.terminate();else if(heartbeats%20===0)p.ws.ping();}else if(Date.now()-p.lastSeen>30000){leave(p);peers.delete(p);}}
 for(const r of rooms.values()){
  if(r.startAt){if(r.startAt<=Date.now())start(r);else broadcast(r,state(r));}
  if(r.started&&r.host&&Date.now()-r.hostPulse>9000){const host=r.peers.find(p=>p.id===r.host);if(r.peers.some(p=>p!==host&&p.ws.readyState===1&&p.visible)){elect(r,host);broadcast(r,state(r));}else r.hostPulse=Date.now();}
 }heartbeats++;
},1000);
server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Gravity Duel signaling ready on '+server.address().port));
function close(){clearInterval(timer);for(const p of peers){send(p,{type:'error',message:'Room service restarting. Please reconnect shortly.'});p.ws.close(1012,'Restart');}server.close();setTimeout(()=>process.exit(),1000).unref();}process.on('SIGTERM',close);process.on('SIGINT',close);
