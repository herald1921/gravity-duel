import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',MAX_ROOMS:'6'},stdio:['ignore','pipe','inherit']});
const port=await new Promise((resolve,reject)=>{child.stdout.on('data',c=>{const m=String(c).match(/ready on (\d+)/);if(m)resolve(+m[1]);});child.on('error',reject);});
const sockets=[],tokens=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function peer(){const ws=new WebSocket('ws://127.0.0.1:'+port,{origin:'http://127.0.0.1:5176',handshakeTimeout:3000}),messages=[];sockets.push(ws);ws.on('error',()=>{});ws.on('message',r=>messages.push(JSON.parse(r)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});return {ws,send:m=>ws.send(JSON.stringify(m)),wait:async(type,p=()=>true)=>{for(let i=0;i<200;i++){const ix=messages.findIndex(m=>m.type===type&&p(m));if(ix>=0)return messages.splice(ix,1)[0];await sleep(10);}throw Error('timeout '+type);}};}
try{
 for(let i=0;i<6;i++){const host=await peer();host.send({type:'create',mode:'teams'});tokens.push((await host.wait('joined')).token);const room=await host.wait('room');for(let j=0;j<3;j++){const p=await peer();p.send({type:'join',code:room.code});tokens.push((await p.wait('joined')).token);}host.send({type:'start'});await host.wait('room',r=>r.started);}
 await Promise.all(sockets.map(ws=>new Promise(resolve=>{ws.once('close',resolve);ws.close();})));
 // Reopen all sockets before any resume packet: retained seats must not consume live-connection capacity.
 const result=await Promise.allSettled(tokens.map(()=>peer()));assert.equal(result.filter(r=>r.status==='rejected').length,0,'all returning players must be admitted while their old seats are reserved');
 const resumed=result.map(r=>r.value);await Promise.all(resumed.map(async(p,i)=>{p.send({type:'resume',token:tokens[i]});await p.wait('joined');}));
 const health=await(await fetch('http://127.0.0.1:'+port+'/health')).json();assert.equal(health.active,6);assert.equal(health.peers,24);
 console.log('PASS: all 24 players reconnect simultaneously into 6 full rooms without waiting for seat expiry');
}finally{for(const ws of sockets)ws.close();child.kill('SIGTERM');}
