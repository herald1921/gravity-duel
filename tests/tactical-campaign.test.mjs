import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { bodyPosition, createBody } from '../.test-build/entities/CelestialBody.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { Match } from '../.test-build/game/Match.js';
import { OpeningFireGate } from '../.test-build/game/OpeningFireGate.js';
import { SquadCoordinator } from '../.test-build/ai/SquadCoordinator.js';
import { RivalSelector } from '../.test-build/ai/RivalSelector.js';
import { SpaceAI } from '../.test-build/ai/SpaceAI.js';
import { difficultyFor } from '../.test-build/ai/Difficulty.js';
import { steerHoming, segmentCircleContact } from '../.test-build/physics/gravity.js';
import * as C from '../.test-build/config.js';
import { Profile, SAVE_KEY } from '../.test-build/platform/Profile.js';
const dt=C.PHYSICS_DT, idle=[IDLE_CONTROL,IDLE_CONTROL,IDLE_CONTROL];
const ffa=()=>new Match({...CAMPAIGN_MAPS[4],scoreMode:undefined,bodies:[],wormholes:[],powerUps:[],
  player1Spawn:{x:150,y:550,angle:0},player2Spawn:{x:700,y:300,angle:0},extraEnemySpawns:[{x:940,y:300,angle:Math.PI}]},3);

test('all 30 arenas have distinct physical layouts, with no renamed copies',()=>{
  const signatures=CAMPAIGN_MAPS.map(m=>JSON.stringify(m.bodies.map(b=>({type:b.type,x:b.x,y:b.y,radius:b.radius,motion:b.motion})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
  assert.equal(new Set(signatures).size,30);
  for(let unit=0;unit<3;unit++){
    const maps=CAMPAIGN_MAPS.filter(m=>m.unitIndex===unit), count=[7,10,13][unit];
    assert.equal(maps.length,count);assert.equal(new Set(maps.map(m=>m.description)).size,count);
    assert.equal(maps.at(-3).combat,'freeForAll'); assert.equal(maps.at(-2).combat,'squad');
    assert.equal(maps.at(-3).extraEnemySpawns.length,2);assert.equal(maps.at(-2).extraEnemySpawns.length,1);assert.equal(maps.at(-1).boss,unit);assert.equal(maps.at(-1).extraEnemySpawns.length,0);
  }
  for(const map of CAMPAIGN_MAPS.slice(0,18))assert.equal(map.wormholes,undefined,map.id);
  for(const map of CAMPAIGN_MAPS.slice(18))assert.equal(map.wormholes.length,map.id==='unit-3-10'?4:2);
});

test('wormhole mouths remain clear of moving cores and each map offers accessible pickup sites',()=>{
  for(const map of CAMPAIGN_MAPS){
    const m=new Match(map);
    for(let t=0;t<120;t+=.5){
      for(const body of map.bodies){const p=bodyPosition(body,t);assert.ok(Math.hypot(235-p.x,400-p.y)>body.collisionRadius+C.SHIP_RADIUS+10,map.id+' unsafe touch spawn');}
      assert.ok(map.powerUpSpawnPoints.some(p=>m.isPickupSafe(p,t)&&m.isPickupSafe(p,t+1)),map.id+' no safe pickup at '+t);
      for(const gate of map.wormholes??[])for(const body of map.bodies){const p=bodyPosition(body,t);assert.ok(Math.hypot(gate.x-p.x,gate.y-p.y)>gate.radius+body.collisionRadius+C.SHIP_RADIUS*2+12,map.id+' blocked wormhole exit');}
    }
  }
});

test('a pilot waiting on its own firing interval cannot monopolize squad selection',()=>{
  const squad=new SquadCoordinator(26), team=[new Ship(2,{x:700,y:300,angle:0}),new Ship(3,{x:900,y:300,angle:0})];
  const gates=team.map(()=>new OpeningFireGate(null,{interval:3,windup:.3}));
  gates[1].prepare(3.1,false,true);
  let selected=null;
  for(let t=0;t<.8;t+=dt){const controls=team.map(()=>({turn:0,thrust:0,fire:true}));squad.coordinateFire(dt,team,controls,gates,[true,true],t);if(controls.some(c=>c.fire)){selected=team[controls.findIndex(c=>c.fire)].id;break;}}
  assert.equal(selected,3,'ready partner must fire while lower-id pilot is still preparing');
});

test('squad waits preserve completed preparation and still enforce shared shot spacing',()=>{
  const squad=new SquadCoordinator(26),team=[new Ship(2,{x:700,y:300,angle:0}),new Ship(3,{x:900,y:300,angle:0})];
  const gates=team.map(()=>new OpeningFireGate(null,{interval:0,windup:.1}));
  const shots=[];
  for(let t=0;t<1.5;t+=dt){const controls=team.map(()=>({turn:0,thrust:0,fire:true}));squad.coordinateFire(dt,team,controls,gates,[true,true],t);controls.forEach((c,i)=>{if(c.fire){shots.push({id:team[i].id,t});squad.recordShot(team[i].id,t);}});}
  assert.ok(shots.length>=3);assert.equal(new Set(shots.map(s=>s.id)).size,2);
  for(let i=1;i<shots.length;i++)assert.ok(shots[i].t-shots[i-1].t>=.4-1e-8);
});

test('pressure chooses a clear lane and leaves a blocked position instead of waiting forever',()=>{
  const player=new Ship(1,{x:330,y:385,angle:0}), team=[new Ship(2,{x:800,y:385,angle:Math.PI}),new Ship(3,{x:1050,y:550,angle:Math.PI})];
  const body=createBody('cover','planet',550,385,{radius:75}),squad=new SquadCoordinator(26);squad.update(dt,team,player,[body],0,[]);
  const order=squad.orders.get(2);assert.equal(order.role,'PRESSURE');assert.equal(segmentCircleContact(order.waypoint,player,{...body,radius:body.radius+12}),null);
  const ai=new SpaceAI(()=>.5,(_r,done)=>done({angle:Math.PI,distance:300,trajectory:{points:[]}}),difficultyFor(26));
  let c;for(let i=0;i<125;i++)c=ai.update(dt,team[0],player,[body],{},[],[],team,order);
  assert.ok(Math.hypot(c.move.x,c.move.y)>.9);
});

test('FFA normal, heavy, orbital, homing and laser fire can kill another AI without ending a three-way round',()=>{
  for(const kind of ['normal','heavy','orbital','homing','laser']){
    const m=ffa();m.phase='playing';m.ships[1].specialShot=kind==='normal'?null:kind;m.fire(2);
    for(let frame=0;frame<300&&m.ships[2].alive;frame++)m.step(idle);
    assert.equal(m.ships[2].alive,false,kind);assert.equal(m.ships[0].alive,true);assert.equal(m.phase,'playing');
    assert.deepEqual(m.scores,{1:0,2:0,3:0});assert.equal(m.drainEvents().find(e=>e.type==='death')?.owner,2);
  }
});

test('three independent scores, player-first elimination, AI victory, simultaneous draw and rematch are correct',()=>{
  const m=ffa();m.phase='playing';m.resolveDeaths([{victim:1,cause:'shot',owner:2}]);
  assert.equal(m.phase,'playing');assert.deepEqual(m.scores,{1:0,2:0,3:0});
  m.resolveDeaths([{victim:2,cause:'shot',owner:3}]);assert.equal(m.roundWinner,3);assert.equal(m.scores[3],1);assert.equal(m.phase,'roundOver');
  m.respawn();m.phase='playing';m.scores[3]=2;m.resolveDeaths([{victim:1,cause:'hazard'},{victim:2,cause:'shot',owner:3}]);
  assert.equal(m.winner,3);assert.equal(m.phase,'matchOver');
  m.rematch();assert.deepEqual(m.scores,{1:0,2:0,3:0});assert.equal(m.roundWinner,null);assert.ok(m.ships.every(s=>s.alive));
  m.phase='playing';m.resolveDeaths(m.ships.map(s=>({victim:s.id,cause:'hazard'})));assert.equal(m.draw,true);assert.deepEqual(m.scores,{1:0,2:0,3:0});
});

test('FFA selector and homing missiles prefer nearby AI rather than always choosing the human',()=>{
  const m=ffa(),selector=new RivalSelector(),[human,a,b]=m.ships;
  assert.equal(selector.select(dt,a,m.ships,[],0).id,3);
  const bullet=createProjectile(a,0,'homing');bullet.age=C.HOMING_ARM_TIME;steerHoming(bullet,m.ships);assert.equal(bullet.homingTargetId,3);
  b.alive=false;assert.equal(selector.select(dt,a,m.ships,[],0).id,1);steerHoming(bullet,m.ships);assert.equal(bullet.homingTargetId,1);
  human.alive=false;assert.equal(selector.select(dt,a,m.ships,[],0),undefined);
});

test('FFA AI pilots actually fight each other and continue after the human is eliminated',()=>{
  const m=ffa(),team=m.ships.slice(1),selectors=team.map(()=>new RivalSelector()),ais=team.map(()=>new SpaceAI(()=>.5,undefined,difficultyFor(26))),gates=team.map(()=>new OpeningFireGate(null,difficultyFor(26)));
  m.phase='playing';m.resolveDeaths([{victim:1,cause:'hazard'}]);const fired=new Set();
  for(let frame=0;frame<20/dt&&m.phase==='playing';frame++){
    const controls=team.map((s,i)=>{const target=selectors[i].select(dt,s,m.ships,[],m.time);assert.ok(target&&target.id!==1);const c=ais[i].update(dt,s,target,[],{time:m.time},[],m.bullets,[]);c.fire=gates[i].step(dt,c.fire,s.cooldown<=1e-9&&!s.laserCharge);return c;});
    m.step([IDLE_CONTROL,...controls]);for(const e of m.drainEvents())if(e.type==='shot')fired.add(e.owner);
  }
  assert.ok(fired.size>0);assert.notEqual(m.phase,'playing');assert.ok([2,3].includes(m.roundWinner)||m.draw);
});

test('switching FFA targets invalidates an older asynchronous aim request',()=>{
  const m=ffa(),requests=[],ai=new SpaceAI(()=>.5,(r,done)=>requests.push({r,done}),difficultyFor(26));
  ai.update(dt,m.ships[1],m.ships[0],[]);ai.update(dt,m.ships[1],m.ships[2],[]);
  requests[0].done({angle:0,distance:0,trajectory:{points:[]}});assert.equal(ai.solution,null);
  requests[1].done({angle:1,distance:0,trajectory:{points:[]}});assert.equal(ai.solution.angle,1);
});

test('6/9/12 campaign migration preserves completed identities and cosmetics without clearing new combinations',()=>{
  const old=JSON.stringify({version:1,runIndex:26,cleared:Array.from({length:27},(_,i)=>i),tutorialDone:true,music:false,sfx:true,badges:['portal'],paint:'amber',controls:'classic'});
  const values=new Map([['gravity-duel-campaign-v0100',old]]),store={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const p=new Profile(()=>store);assert.equal(p.data.cleared.length,24);assert.equal(p.data.runIndex,6);
  for(const i of [6,16,24,25,26,29])assert.ok(!p.data.cleared.includes(i));
  assert.equal(p.data.paint,'amber');assert.equal(p.data.music,false);assert.equal(p.data.controls,'modern');
  p.clearArena(6);assert.equal(values.get('gravity-duel-campaign-v0100'),old);assert.ok(values.has(SAVE_KEY));assert.equal(new Profile(()=>store).data.cleared.length,25);
});

test('each paired introductory lesson spawns both new powers before cycling older abilities',()=>{
  for(const map of CAMPAIGN_MAPS.slice(0,3)){
    const m=new Match(map);m.phase='playing';const introduced=[];
    for(let frame=0;frame<16/dt&&introduced.length<2;frame++){m.step(idle);if(m.pickups.length){introduced.push(...m.pickups.map(p=>p.type));m.pickups=[];}}
    assert.deepEqual(introduced.slice(0,2),map.lessons,map.id);
  }
});
