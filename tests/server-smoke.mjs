import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',MAX_RELAY_ROOMS:'1'},stdio:['ignore','pipe','inherit']});
const port=await new Promise((resolve,reject)=>{child.stdout.on('data',c=>{const m=String(c).match(/ready on (\d+)/);if(m)resolve(+m[1]);});child.on('error',reject);});
const sockets=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function peer(){const ws=new WebSocket('ws://127.0.0.1:'+port,{origin:'http://127.0.0.1:5176'}),messages=[];sockets.push(ws);ws.on('message',r=>messages.push(JSON.parse(r)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});return {ws,messages,send:m=>ws.send(JSON.stringify(m)),wait:async(type,p=()=>true)=>{for(let i=0;i<300;i++){const ix=messages.findIndex(m=>m.type===type&&p(m));if(ix>=0)return messages.splice(ix,1)[0];await sleep(20);}throw Error('timeout '+type);}};}
try{
 const a=await peer(),b=await peer();a.send({type:'create',mode:'teams'});const ja=await a.wait('joined'),r=await a.wait('room');b.send({type:'join',code:r.code});await b.wait('joined');a.send({type:'start'});
 const room=await a.wait('room',r=>r.started);await b.wait('room',r=>r.started);assert.equal(room.host,1);assert.equal(room.round,1);
 const route=(to,extra={})=>({to,epoch:room.epoch,round:room.round,...extra});
 a.send(route(2,{type:'signal',data:{description:{type:'offer',sdp:'test-only'}}}));assert.equal((await b.wait('signal')).from,1);
 b.send(route(1,{type:'relay',payload:{type:'input',control:{fire:true}}}));assert.equal((await a.wait('relay')).payload.control.fire,true);
 b.send(route(1,{type:'relay',payload:{type:'state',state:{scores:{1:999}}}}));await sleep(80);assert.equal(a.messages.filter(m=>m.type==='relay').length,0);
 a.send(route(2,{type:'signal',epoch:0,data:{bad:true}}));await sleep(80);assert.equal(b.messages.filter(m=>m.type==='signal').length,0);
 const outsider=await peer();outsider.send({type:'create'});const other=await outsider.wait('room');outsider.send(route(2,{type:'signal',data:{bad:true}}));await sleep(80);assert.equal(b.messages.filter(m=>m.type==='signal').length,0);
 const d=await peer();d.send({type:'join',code:other.code});await d.wait('joined');outsider.send({type:'start'});const otherStarted=await outsider.wait('room',r=>r.started);
 outsider.send({type:'relay',to:2,epoch:otherStarted.epoch,round:otherStarted.round,payload:{type:'state'}});await outsider.wait('relayBusy');
 a.send({type:'visibility',visible:false});const moved=await b.wait('room',r=>r.host===2);assert.ok(moved.epoch>room.epoch);
 a.ws.close();await sleep(100);const resumed=await peer();resumed.send({type:'resume',token:ja.token});assert.equal((await resumed.wait('joined')).id,1);const rr=await resumed.wait('room');assert.equal(rr.host,2);
 b.ws.close();const takeover=await resumed.wait('room',r=>r.host===1);assert.ok(takeover.epoch>moved.epoch);
 const e=await peer(),f=await peer();e.send({type:'random'});const er=await e.wait('room');f.send({type:'random'});assert.equal((await f.wait('room')).code,er.code);await e.wait('room',r=>r.started);
 const health=await(await fetch('http://127.0.0.1:'+port+'/health')).json();assert.equal(health.architecture,'peer-hosted');assert.ok(health.active>=3);
 console.log('PASS: friend/random rooms, signal isolation, stale epoch rejection, host-only state, bounded relay, visibility takeover, resume and host disconnect');
}finally{for(const ws of sockets)ws.close();child.kill('SIGTERM');}
