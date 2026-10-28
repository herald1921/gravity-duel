import test from 'node:test';
import assert from 'node:assert/strict';
import {CrazyMultiplayer,inviteRoom} from '../.test-build/platform/CrazyMultiplayer.js';
function setup(options={}){
 const events=[],listeners=new Set();
 const api={...options,updateRoom:r=>events.push(r),leftRoom:()=>events.push('left'),inviteLink:p=>'https://www.crazygames.com/game/test?room='+p.room,addJoinRoomListener:l=>listeners.add(l),removeJoinRoomListener:l=>listeners.delete(l)};
 const bridge=new CrazyMultiplayer();bridge.attach(api);return {bridge,events,listeners};
}
test('platform invitation takes precedence over instant room creation and is consumed once',()=>{
 const {bridge}=setup({inviteParams:{room:'abcd1234'},isInstantMultiplayer:true});
 assert.deepEqual(bridge.takeLaunch(),{joinCode:'ABCD1234'});assert.equal(bridge.takeLaunch(),undefined);
 assert.deepEqual(setup({isInstantMultiplayer:true}).bridge.takeLaunch(),{autoCreate:true});
 assert.equal(setup().bridge.takeLaunch(),undefined);
 for(const value of [null,{},'abc','http://x','<script>'])assert.equal(inviteRoom(value),undefined);
});
test('room reporting closes invites when full or started, retains match identity and clears on leave',()=>{
 const {bridge,events}=setup();const room={code:'ABCD1234',started:false,players:[{},{}]};
 bridge.update(room);bridge.update(room);assert.equal(events.length,1);assert.equal(events[0].isJoinable,true);
 bridge.update({...room,players:[{},{},{},{}]});assert.equal(events.at(-1).isJoinable,false);
 bridge.update(room);bridge.update({...room,started:true});assert.equal(events.at(-1).isJoinable,false);
 assert.equal(events.at(-1).roomId,room.code);assert.ok(bridge.invite(room.code).startsWith('https://www.crazygames.com/'));
 bridge.update(null);assert.equal(events.at(-1),'left');bridge.update(null);assert.equal(events.length,5);
});
test('live invitations ignore current room, route valid new rooms and clean up listeners',()=>{
 const {bridge,listeners}=setup();const joined=[];const unsubscribe=bridge.onJoin(c=>joined.push(c));
 bridge.update({code:'ABCD1234',started:false,players:[]});
 for(const listener of listeners){listener({room:'ABCD1234'});listener({room:'WXYZ5678'});listener({room:'invalid'});}
 assert.deepEqual(joined,['WXYZ5678']);unsubscribe();
 for(const listener of listeners)listener({room:'TEST1234'});
 assert.deepEqual(bridge.takeLaunch(),{joinCode:'TEST1234'});bridge.destroy();assert.equal(listeners.size,0);
});
test('unavailable optional SDK methods do not block solo play or return a CDN invitation',()=>{
 const bridge=new CrazyMultiplayer();bridge.attach({inviteLink(){throw Error('offline')},updateRoom(){throw Error('offline')}});
 assert.doesNotThrow(()=>bridge.update({code:'ABCD1234',started:false,players:[]}));assert.equal(bridge.invite('ABCD1234'),undefined);bridge.destroy();
});
