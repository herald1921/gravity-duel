import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineClient} from '../.test-build/net/OnlineClient.js';
const channels=[];
class FakeChannel {readyState='open';bufferedAmount=0;sent=[];constructor(label){this.label=label;channels.push(this);}send(data){this.sent.push(JSON.parse(data));}}
class FakePeer {signalingState='stable';createDataChannel(label){return new FakeChannel(label);}async createOffer(){return {type:'offer',sdp:'test'};}async setLocalDescription(d){this.localDescription=d;}close(){this.closed=true;}}
class FakeSocket {static OPEN=1;readyState=1;send(){}close(){this.readyState=3;}}
class FakeWorker {postMessage(){}terminate(){}}
const doc=new EventTarget();doc.hidden=false;globalThis.document=doc;globalThis.WebSocket=FakeSocket;globalThis.RTCPeerConnection=FakePeer;globalThis.Worker=FakeWorker;
const room={type:'room',code:'TEST0001',mode:'ffa',mapId:'unit-1-5',started:true,owner:1,host:1,epoch:1,round:1,countdown:null,players:[1,2,3,4].map(id=>({id,connected:true,visible:true}))};
const input=(seq,move=1,round=1)=>({type:'input',seq,epoch:1,round,control:{turn:0,thrust:0,fire:false,move:{x:move,y:0},independentAim:true}});

test('platform room status follows connection and old closed sockets cannot clear a replacement room',()=>{
 const states=[];const client=new OnlineClient('ws://unit-test',{},r=>states.push(r?.code??null));
 client.updateRoom({...room,started:false});assert.deepEqual(states,['TEST0001']);
 client.close();assert.deepEqual(states,['TEST0001',null]);
 client.ws.onclose();assert.deepEqual(states,['TEST0001',null]);
});
test('player host ignores stale controls, keeps direct links on rematch, and restores a migration checkpoint',()=>{
 const client=new OnlineClient('ws://unit-test',{});client.connected=true;client.updateRoom(structuredClone(room));
 try{
  client.runtime.match.phase='playing';client.runtime.match.scores[1]=2;
  for(const id of [2,3,4])client.receive(id,input(2));client.receive(2,input(1,-1));client.tick(1/120);
  assert.ok(client.runtime.match.ships[1].vx>0,'old input must not reverse flight');assert.equal(client.snapshot.scores[1],2);
  const saved=structuredClone(client.snapshot),oldChannels=channels.length;
  client.updateRoom({...structuredClone(room),host:2,epoch:2});assert.equal(client.runtime,undefined);
  client.updateRoom({...structuredClone(room),epoch:3});assert.equal(client.runtime.match.scores[1],2);assert.equal(client.runtime.match.time,saved.time);
  const afterMigration=channels.length;assert.ok(afterMigration>oldChannels);
  client.updateRoom({...structuredClone(room),epoch:3,round:2});assert.equal(channels.length,afterMigration,'rematch should reuse existing peer channels');assert.equal(client.runtime.match.time,0);assert.equal(client.runtime.match.scores[1],0);
  client.runtime.match.phase='playing';client.receive(2,{...input(100,-1),epoch:3});
  for(const id of [2,3,4])client.receive(id,{...input(101,1,2),epoch:3});client.tick(1/120);assert.ok(client.runtime.match.ships[1].vx>0);
 }finally{client.close();}
});
test('host waits for connection readiness and background pilots become AI',()=>{
 const client=new OnlineClient('ws://unit-test',{});client.connected=true;client.updateRoom(structuredClone(room));
 try{client.tick(.05);assert.equal(client.runtime.match.time,0);assert.equal(client.waiting,true);
  const background={...structuredClone(room),players:room.players.map(p=>({...p,visible:p.id===1}))};client.updateRoom(background);
  assert.deepEqual([...client.runtime.humans],[1]);
 }finally{client.close();}
});

test('host without WebRTC can publish through the bounded relay fallback',()=>{
 const original=globalThis.RTCPeerConnection;globalThis.RTCPeerConnection=class {constructor(){throw Error('WebRTC unavailable');}};
 const client=new OnlineClient('ws://unit-test',{});client.connected=true;const sent=[];client.send=value=>sent.push(value);
 try {client.updateRoom(structuredClone(room));for(const id of [2,3,4])client.receive(id,input(1));client.tick(.05);
  assert.equal(client.links.size,0);
  const states=sent.filter(m=>m.type==='relay'&&m.payload.type==='state');assert.deepEqual(states.map(m=>m.to),[2,3,4]);
  assert.equal(client.waiting,false);assert.ok(states.every(m=>m.epoch===1&&m.round===1));
 }finally{client.close();globalThis.RTCPeerConnection=original;}
});

test('active direct matches keep the signaling socket alive without server echo traffic',()=>{
 const original=globalThis.setInterval,originalMedia=globalThis.matchMedia;let heartbeat;globalThis.setInterval=(fn,ms)=>{heartbeat=fn;return original(fn,ms);};globalThis.matchMedia=()=>({matches:false});
 const client=new OnlineClient('ws://unit-test',{}),sent=[];client.send=m=>sent.push(m);
 try{client.ws.onopen();client.room=structuredClone(room);heartbeat();assert.deepEqual(sent.at(-1),{type:'alive'});client.room=undefined;heartbeat();assert.equal(sent.at(-1).type,'ping');}
 finally{client.close();globalThis.setInterval=original;globalThis.matchMedia=originalMedia;}
});
