import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineRuntime,snapshot,applySnapshot} from '../.test-build/game/OnlineRuntime.js';
for(const mode of ['teams','ffa'])test('host migration preserves '+mode+' physics, pickup timers, weapons and score',()=>{
 const a=new OnlineRuntime('unit-3-8',mode);for(const id of [1,2,3,4])a.humans.add(id);
 for(let i=0;i<1200;i++){for(const id of a.humans)a.input(id,{turn:0,thrust:0,fire:i%90===0,aim:id,independentAim:true});a.step();}
 a.match.ships[0].specialShot='orbital';a.match.ships[1].laserCharge={remaining:.4,angle:1};
 const checkpoint=structuredClone(snapshot(a.match));const b=new OnlineRuntime('unit-3-8',mode);for(const id of a.humans)b.humans.add(id);applySnapshot(b.match,structuredClone(checkpoint));
 assert.deepEqual(snapshot(b.match),{...checkpoint,events:[]});
 for(let i=0;i<400;i++){for(const id of a.humans){const input={turn:0,thrust:0,fire:i%120===0,aim:id,independentAim:true};a.input(id,input);b.input(id,input);}a.step();b.step();}
 assert.deepEqual(snapshot(b.match),snapshot(a.match));
});
