import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
const port=await new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{const m=String(chunk).match(/ready on (\d+)/);if(m)resolve(Number(m[1]));});child.once('exit',code=>reject(Error('server exited '+code)));});
const sockets=[];
async function peer(){const ws=new WebSocket('ws://127.0.0.1:'+port,{origin:'http://127.0.0.1:5176'}),messages=[];sockets.push(ws);
 ws.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 return {ws,messages,send:m=>ws.send(JSON.stringify(m)),wait:async(type,predicate=()=>true)=>{const start=Date.now();while(Date.now()-start<15000){const i=messages.findIndex(m=>m.type===type&&predicate(m));if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,20));}throw Error('timeout '+type);}};
}
try{
 const a=await peer(),b=await peer();a.send({type:'create',mode:'teams',mapId:'unit-1-6'});
 const joined=await a.wait('joined'),room=await a.wait('room');b.send({type:'join',code:room.code});await b.wait('joined');await b.wait('room');a.send({type:'start'});
 const [sa,sb]=await Promise.all([a.wait('snapshot',m=>m.state.phase==='playing'),b.wait('snapshot',m=>m.state.phase==='playing')]);
 assert.equal(sa.state.ships.length,4);assert.deepEqual(sa.state.scores,{1:0,2:0});assert.equal(sb.state.ships.length,4);
 a.send({type:'input',control:{move:{x:1,y:0},aim:0,fire:true,thrust:0,turn:0}});
 const moving=await a.wait('snapshot',m=>m.state.ships[0].vx>0);assert.ok(moving.state.ships[0].x>170);
 // Forged scores and a foreign player ID are never accepted as simulation state.
 b.send({type:'input',id:1,scores:{1:999},control:{move:{x:100000,y:0},fire:false}});
 const safe=await b.wait('snapshot',m=>m.state.time>moving.state.time+.4);assert.ok(safe.state.scores[1]<999);assert.ok(Math.abs(safe.state.ships[1].vx)<400);
 a.ws.close();const c=await peer();c.send({type:'resume',token:joined.token});assert.equal((await c.wait('joined')).id,1);await c.wait('snapshot');
 c.send({type:'leave'});b.send({type:'leave'});
 const d=await peer(),e=await peer();d.send({type:'random',mode:'ffa'});const dr=await d.wait('room');e.send({type:'random',mode:'ffa'});const er=await e.wait('room');assert.equal(er.code,dr.code);
 await Promise.all([d.wait('snapshot'),e.wait('snapshot')]);
 console.log('PASS: friend rooms, authoritative 2v2, input bounds, reconnect, random matchmaking and four-seat snapshots');
}finally{for(const ws of sockets)ws.close();child.kill('SIGTERM');}
