import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {writeFile} from 'node:fs/promises';
const count=Number(process.argv[2]||1000),seconds=Number(process.argv[3]||180),endpoint=process.argv[4];
const child=endpoint?null:spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',MAX_ROOMS:String(count),MAX_RELAY_ROOMS:'0'},stdio:['ignore','pipe','inherit']});
const port=child?await new Promise((resolve,reject)=>{child.stdout.on('data',c=>{const m=String(c).match(/ready on (\d+)/);if(m)resolve(+m[1]);});child.on('error',reject);}):0;
const url=endpoint||'ws://127.0.0.1:'+port,healthURL=url.replace(/^ws/,'http')+'/health';
const peers=[],rooms=[],latencies=[];let failures=0,signals=0,unexpectedHostChanges=0,closing=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function peer(){const ws=new WebSocket(url,{origin:'https://herald1921.github.io'}),messages=[];const p={ws,messages,send:m=>ws.readyState===1&&ws.send(JSON.stringify(m)),wait:async(type,predicate=()=>true)=>{for(let i=0;i<1500;i++){const ix=messages.findIndex(m=>m.type===type&&predicate(m));if(ix>=0)return messages.splice(ix,1)[0];await sleep(10);}throw Error('timeout '+type);}};
 peers.push(p);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='pong'){latencies.push(Date.now()-m.time);return;}if(m.type==='signal'){signals++;return;}if(m.type==='error'){failures++;return;}if(m.type==='room'&&m.started){if(p.host&&p.host!==m.host)unexpectedHostChanges++;p.host=m.host;p.epoch=m.epoch;p.round=m.round;}messages.push(m);});ws.on('close',()=>{if(!closing)failures++;});ws.on('error',()=>{if(!closing)failures++;});await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});return p;}
try{
 for(let batch=0;batch<count;batch+=10){await Promise.all(Array.from({length:Math.min(10,count-batch)},async()=>{
  const a=await peer();a.send({type:'create',mode:'teams'});const r=await a.wait('room');const guests=[];for(let i=0;i<3;i++){const p=await peer();p.send({type:'join',code:r.code});await p.wait('joined');guests.push(p);}a.send({type:'start'});const started=await a.wait('room',r=>r.started);await Promise.all(guests.map(p=>p.wait('room',r=>r.started)));a.send({type:'hostPulse'});
  // SDP-sized signaling exchange; gameplay is deliberately absent from this broker-only test.
  for(const [i,p] of guests.entries()){a.send({type:'signal',to:i+2,epoch:started.epoch,round:1,data:{description:{type:'offer',sdp:'x'.repeat(1800)}}});p.send({type:'signal',to:1,epoch:started.epoch,round:1,data:{description:{type:'answer',sdp:'x'.repeat(1800)}}});}
  rooms.push({a,guests});
 }));for(const {a} of rooms)a.send({type:'hostPulse'});if((batch+10)%100===0)console.log('Prepared '+(batch+10)+' rooms / '+peers.length+' sockets');}
 await sleep(1000);const before=await(await fetch(healthURL)).json(),start=Date.now();let ticks=0;
 while(Date.now()-start<seconds*1000){for(const {a} of rooms)a.send({type:'hostPulse'});if(ticks%3===0)for(const p of peers.filter((_,i)=>i%40===0))p.send({type:'ping',time:Date.now()});await sleep(3000);ticks++;if(ticks%10===0)console.log('Holding '+rooms.length+' active rooms: '+Math.round((Date.now()-start)/1000)+' s');}
 const after=await(await fetch(healthURL)).json(),duration=(Date.now()-start)/1000;latencies.sort((a,b)=>a-b);const percentile=q=>latencies[Math.min(latencies.length-1,Math.floor(latencies.length*q))];
 const result={kind:'SIGNALING_ONLY_NOT_1000_REAL_MATCHES',location:endpoint?'public service':'local workstation',rooms:count,playersPerRoom:4,durationSeconds:duration,activeAtEnd:after.active,connectionsAtEnd:after.peers,failures,unexpectedHostChanges,signalPackets:signals,pingSamples:latencies.length,pingMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:latencies.at(-1)},cpuCores:(after.cpuSeconds-before.cpuSeconds)/duration,rssMB:after.rssMB,brokerOutboundMBPerHour:(after.outboundBytes-before.outboundBytes)/duration*3600/1e6,health:after};
 await writeFile('qa/signaling-'+count+(endpoint?'-public':'-local')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failures||unexpectedHostChanges||after.active<count)process.exitCode=1;
}finally{closing=true;for(const p of peers){p.send({type:'leave'});p.ws.close();}child?.kill('SIGTERM');}
