import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {writeFile} from 'node:fs/promises';
const count=Number(process.argv[2]||1000),seconds=Number(process.argv[3]||180),endpoint=process.argv[4];
if(!Number.isInteger(count)||count<1||count>1000||!Number.isFinite(seconds)||seconds<1||seconds>1800)throw Error('Use 1-1000 rooms and 1-1800 seconds.');
const rampStarted=Date.now();const samples=[];
const child=endpoint?null:spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',MAX_ROOMS:String(count),MAX_RELAY_ROOMS:'0'},stdio:['ignore','pipe','inherit']});
const port=child?await new Promise((resolve,reject)=>{child.stdout.on('data',c=>{const m=String(c).match(/ready on (\d+)/);if(m)resolve(+m[1]);});child.on('error',reject);}):0;
const url=endpoint||'ws://127.0.0.1:'+port,healthURL=url.replace(/^ws/,'http')+'/health';
const peers=[],rooms=[],latencies=[];let failures=0,signals=0,unexpectedHostChanges=0,closing=false,connectRetries=0;
const interrupt=()=>{closing=true;for(const p of peers){p.send({type:'leave'});p.ws.close();}child?.kill('SIGTERM');setTimeout(()=>process.exit(130),1000).unref();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function connectOnce(){const ws=new WebSocket(url,{origin:'https://herald1921.github.io',handshakeTimeout:15000}),messages=[];const p={ws,messages,opened:false,send:m=>ws.readyState===1&&ws.send(JSON.stringify(m)),wait:async(type,predicate=()=>true)=>{for(let i=0;i<1500;i++){const ix=messages.findIndex(m=>m.type===type&&predicate(m));if(ix>=0)return messages.splice(ix,1)[0];await sleep(10);}throw Error('timeout '+type);}};
 peers.push(p);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='pong'){latencies.push(Date.now()-m.time);return;}if(m.type==='signal'){signals++;return;}if(m.type==='error'){failures++;return;}if(m.type==='room'&&m.started){if(p.host&&p.host!==m.host)unexpectedHostChanges++;p.host=m.host;p.epoch=m.epoch;p.round=m.round;}messages.push(m);});ws.on('close',()=>{if(!closing&&p.opened)failures++;});ws.on('error',()=>{});await new Promise((r,j)=>{ws.once('open',()=>{p.opened=true;r();});ws.once('error',j);});return p;}
async function peer(){for(let attempt=0;attempt<5;attempt++){try{return await connectOnce();}catch(error){connectRetries++;if(attempt===4)throw error;await sleep(1000*2**attempt+Math.random()*500);}}}
const pulse=setInterval(()=>{for(const {a} of rooms)a.send({type:'hostPulse'});},3000);
const health=()=>fetch(healthURL,{signal:AbortSignal.timeout(15000)}).then(r=>r.json());
const batchSize=endpoint?5:10;
try{
 for(let batch=0;batch<count;batch+=batchSize){const outcomes=await Promise.allSettled(Array.from({length:Math.min(batchSize,count-batch)},async()=>{
  const a=await peer();a.send({type:'create',mode:'teams'});const r=await a.wait('room');const guestResults=await Promise.allSettled(Array.from({length:3},()=>peer()));const rejected=guestResults.find(g=>g.status==='rejected');if(rejected)throw rejected.reason;const guests=guestResults.map(g=>g.value);for(const p of guests){p.send({type:'join',code:r.code});await p.wait('joined');}a.send({type:'start'});const started=await a.wait('room',r=>r.started);await Promise.all(guests.map(p=>p.wait('room',r=>r.started)));a.send({type:'hostPulse'});
  // SDP-sized signaling exchange; gameplay is deliberately absent from this broker-only test.
  for(const [i,p] of guests.entries()){a.send({type:'signal',to:i+2,epoch:started.epoch,round:1,data:{description:{type:'offer',sdp:'x'.repeat(1800)}}});p.send({type:'signal',to:1,epoch:started.epoch,round:1,data:{description:{type:'answer',sdp:'x'.repeat(1800)}}});}
  rooms.push({a,guests});
 }));const failed=outcomes.find(r=>r.status==='rejected');if(failed)throw failed.reason;if((batch+batchSize)%100===0){const sample=await health();samples.push({elapsedSeconds:(Date.now()-rampStarted)/1000,...sample});console.log('Prepared '+rooms.length+' rooms / '+peers.filter(p=>p.ws.readyState===1).length+' sockets; retries='+connectRetries+'; failures='+failures+'; rss='+sample.rssMB+' MB');}}
 await sleep(1000);const before=await health(),start=Date.now();let ticks=0;
 while(Date.now()-start<seconds*1000){if(ticks%3===0)for(const p of peers.filter((_,i)=>i%40===0))p.send({type:'ping',time:Date.now()});await sleep(3000);ticks++;if(ticks%10===0)console.log('Holding '+rooms.length+' active rooms: '+Math.round((Date.now()-start)/1000)+' s');}
 const after=await health(),duration=(Date.now()-start)/1000;latencies.sort((a,b)=>a-b);const percentile=q=>latencies[Math.min(latencies.length-1,Math.floor(latencies.length*q))];
 const result={kind:'SIGNALING_ONLY_NOT_1000_REAL_MATCHES',trafficScope:'JSON application bytes only; excludes WebSocket framing, heartbeat control frames, TLS, HTTP and handshake overhead',location:endpoint?'public service':'local workstation',rooms:count,playersPerRoom:4,rampSeconds:(start-rampStarted)/1000,rampSamples:samples,durationSeconds:duration,activeAtEnd:after.active,connectionsAtEnd:after.peers,connectRetries,failures,unexpectedHostChanges,signalPackets:signals,pingSamples:latencies.length,pingMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:latencies.at(-1)},cpuCores:(after.cpuSeconds-before.cpuSeconds)/duration,rssMB:after.rssMB,brokerOutboundMBPerHour:(after.outboundBytes-before.outboundBytes)/duration*3600/1e6,health:after};
 await writeFile('qa/signaling-'+count+(endpoint?'-public':'-local')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failures||unexpectedHostChanges||after.active<count||after.peers<count*4||signals!==count*6)process.exitCode=1;
}catch(error){await writeFile('qa/signaling-'+count+(endpoint?'-public':'-local')+'-failed.json',JSON.stringify({kind:'SIGNALING_ONLY_NOT_1000_REAL_MATCHES',status:'FAILED',preparedRooms:rooms.length,rampSamples:samples,connectRetries,failures,error:String(error)},null,2));throw error;}finally{closing=true;clearInterval(pulse);for(const p of peers){p.send({type:'leave'});p.ws.close();}child?.kill('SIGTERM');}
