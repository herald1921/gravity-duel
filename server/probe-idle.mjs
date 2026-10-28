import {WebSocket} from 'ws';
import {writeFile} from 'node:fs/promises';
const endpoint=process.argv[2]||'wss://gravity-duel-online.onrender.com';
const duration=360000,started=Date.now(),records=[],sockets=[],timers=[];let stopping=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const mode of ['control-only','app-alive','control-only','app-alive']){
  const ws=new WebSocket(endpoint,{origin:'https://herald1921.github.io',handshakeTimeout:15000});sockets.push(ws);
  const record={mode,openedAt:null,closedAt:null,code:null,reason:null};records.push(record);
  ws.on('error',e=>{record.error=e.message;});ws.on('close',(code,reason)=>{if(!stopping){record.closedAt=(Date.now()-started)/1000;record.code=code;record.reason=String(reason);console.log(JSON.stringify(record));}});
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});record.openedAt=(Date.now()-started)/1000;
  if(mode==='app-alive')timers.push(setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'alive'}));},20000));
 }
 while(Date.now()-started<duration){await sleep(30000);console.log(JSON.stringify({elapsedSeconds:(Date.now()-started)/1000,open:records.map((r,i)=>({mode:r.mode,open:sockets[i].readyState===1}))}));}
 await writeFile('qa/public-idle-probe.json',JSON.stringify({purpose:'Compare protocol pong only with application alive every 20 seconds; no gameplay',durationSeconds:(Date.now()-started)/1000,records},null,2));
}finally{stopping=true;for(const t of timers)clearInterval(t);for(const ws of sockets)ws.close();}
