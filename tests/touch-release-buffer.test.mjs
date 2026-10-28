import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchState } from '../.test-build/input/TouchState.js';
import { Match } from '../.test-build/game/Match.js';
import { OnlineRuntime } from '../.test-build/game/OnlineRuntime.js';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { boundedInput } from '../.test-build/net/input.js';
import { IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { PHYSICS_DT } from '../.test-build/config.js';

test('release during reload survives until a shot succeeds, then fires only once',()=>{
 const t=new TouchState(true),m=new Match({...CAMPAIGN_MAPS[0],bodies:[],powerUps:[]});
 m.phase='playing';m.ships[0].cooldown=.62;t.beginStick(1,0,-.5);t.beginAim(2,0,-1);t.release(2);
 let shots=0,firstAt=0;
 for(let i=0;i<180;i++){
  m.step([t.control(),IDLE_CONTROL]);
  for(const e of m.drainEvents())if(e.type==='shot'&&e.owner===1){shots++;firstAt=i*PHYSICS_DT;t.consumeFire();}
  if(i<60)assert.equal(t.shotQueued,true);
 }
 assert.equal(shots,1);assert.ok(firstAt>=.6);assert.equal(t.control().fire,false);assert.equal(t.stickPosition.held,true);
});

test('new aiming, center cancel and pause clear a queued release without canceling the left finger',()=>{
 const t=new TouchState(true);t.beginStick(1,1,0);t.beginAim(2,0,-1);t.release(2);assert.equal(t.shotQueued,true);
 t.beginAim(3,1,0);assert.equal(t.shotQueued,false);assert.equal(t.control().cancelBufferedFire,true);
 t.moveAim(3,0,0);t.release(3);assert.equal(t.control().fire,false);assert.equal(t.stickPosition.held,true);
 t.beginAim(3,1,0);t.release(3);t.clear();assert.equal(t.control().fire,false);assert.equal(t.aimPosition.held,false);
});

function onlineFixture(){const r=new OnlineRuntime('unit-1-5','ffa');for(const s of r.match.ships)r.humans.add(s.id);r.match.phase='playing';r.match.ships[0].cooldown=.65;return r;}
test('online release is buffered by the host despite subsequent non-firing input packets',()=>{
 const r=onlineFixture(),t=new TouchState(true);t.beginAim(1,0,-1);t.release(1);r.input(1,boundedInput(t.control()));t.consumeFire();
 let shots=0;
 for(let i=0;i<180;i++){
  // Guest continues sending movement and aim while its release awaits the host reload.
  r.input(1,{...IDLE_CONTROL,aim:0,independentAim:true});r.step();
  for(const e of r.match.drainEvents())if(e.type==='shot'&&e.owner===1){shots++;assert.equal(r.match.ships[0].angle,-Math.PI/2);}
 }
 assert.equal(shots,1);
});

for(const reason of ['pause','stale','elimination'])test('online queued release is canceled by '+reason,()=>{
 const r=onlineFixture();r.input(1,{...IDLE_CONTROL,fire:true,bufferedFire:true,aim:-Math.PI/2,independentAim:true});r.step();
 if(reason==='elimination')r.match.ships[0].alive=false;
 if(reason==='pause')r.input(1,{...IDLE_CONTROL,cancelBufferedFire:true});
 let shots=0;
 for(let i=0;i<150;i++){if(reason!=='stale')r.input(1,IDLE_CONTROL);r.step();shots+=r.match.drainEvents().filter(e=>e.type==='shot'&&e.owner===1).length;}
 assert.equal(shots,0);
});
