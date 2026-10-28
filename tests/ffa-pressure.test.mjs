import test from 'node:test';
import assert from 'node:assert/strict';
import { RivalSelector } from '../.test-build/ai/RivalSelector.js';
import { RivalPressure } from '../.test-build/ai/RivalPressure.js';
import { Ship } from '../.test-build/entities/Ship.js';
import { OnlineRuntime, snapshot, applySnapshot } from '../.test-build/game/OnlineRuntime.js';

const pilots = () => [[150,550],[850,220],[1000,220],[1050,380]].map(([x,y],i)=>new Ship(i+1,{x,y,angle:0}));
test('a distant unattended pilot receives attention without all AI forming a pile-on',()=>{
 const ships=pilots(),pressure=new RivalPressure(),selectors=ships.map(()=>new RivalSelector());
 const firstTargetAt=new Map();let largestPile=0;
 for(let frame=0;frame<1200;frame++){
  pressure.update(1/120,ships,[]);const targets=[];
  for(const s of ships.slice(1)){
   const target=selectors[s.id-1].select(1/120,s,ships,[],frame/120,pressure);
   targets.push(target.id);if(!firstTargetAt.has(target.id))firstTargetAt.set(target.id,frame/120);
  }
  largestPile=Math.max(largestPile,...ships.map(s=>targets.filter(id=>id===s.id).length));
 }
 assert.ok(firstTargetAt.get(1)<=8,JSON.stringify([...firstTargetAt]));
 assert.ok(firstTargetAt.size>=3);assert.ok(largestPile<=2);
});
test('pressure policy treats a distant AI exactly like a distant human',()=>{
 const run=ids=>{
  const positions=pilots();const ships=positions.map((s,i)=>new Ship(ids[i],{x:s.x,y:s.y,angle:0}));
  const pressure=new RivalPressure(),selectors=ships.map(()=>new RivalSelector()),times=[];
  for(let frame=0;frame<1200;frame++){
   pressure.update(1/120,ships,[]);
   ships.slice(1).forEach((s,i)=>{const t=selectors[i+1].select(1/120,s,ships,[],frame/120,pressure);if(t.id===ids[0])times.push(frame);});
  }
  return times;
 };
 assert.deepEqual(run([1,2,3,4]),run([4,2,3,1]));
});
test('long target fixation ends, while dead or protected pilots are never targeted',()=>{
 const ships=pilots().slice(0,3),pressure=new RivalPressure(),selector=new RivalSelector();
 ships[0].x=1100;ships[0].y=220;
 const chosen=new Set();
 for(let i=0;i<2400;i++){
  pressure.update(1/120,ships,[]);
  chosen.add(selector.select(1/120,ships[1],ships,[],i/120,pressure).id);
 }
 assert.deepEqual([...chosen].sort(),[1,3]);
 ships[2].alive=false;assert.equal(selector.select(.01,ships[1],ships,[],20,pressure).id,1);
 ships[0].invulnerableFor=1;assert.equal(selector.select(.01,ships[1],ships,[],20,pressure),undefined);
 pressure.update(.01,ships,[]);assert.equal(pressure.attackers(3,1),0);
 pressure.reset();assert.equal(pressure.neglect(1),0);
});
test('host takeover preserves eliminated pilots and no-respawn survival scoring',()=>{
 const a=new OnlineRuntime('unit-1-5','ffa');a.match.phase='playing';
 a.match.resolveDeaths([{victim:1,owner:2,cause:'shot'},{victim:3,owner:4,cause:'shot'}]);
 const b=new OnlineRuntime('unit-1-5','ffa');applySnapshot(b.match,structuredClone(snapshot(a.match)));
 assert.equal(b.match.ships[0].alive,false);assert.equal(b.match.ships[2].alive,false);
 b.match.resolveDeaths([{victim:2,owner:4,cause:'shot'}]);
 assert.equal(b.match.roundWinner,4);assert.deepEqual(b.match.scores,{1:0,2:0,3:0,4:1});
});
