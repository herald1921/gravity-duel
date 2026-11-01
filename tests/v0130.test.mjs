import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../.test-build/game/Match.js';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { createBody } from '../.test-build/entities/CelestialBody.js';
import { orbitalHosts, stepProjectile } from '../.test-build/physics/gravity.js';
import { PHYSICS_DT } from '../.test-build/config.js';

test('opening wins arrive after two rounds; later campaign retains its full rules',()=>{
 assert.equal(new Match(CAMPAIGN_MAPS[0]).targetScore,2);
 assert.equal(new Match(CAMPAIGN_MAPS[1]).targetScore,2);
 assert.equal(new Match(CAMPAIGN_MAPS[2]).targetScore,5);
 assert.equal(new Match(CAMPAIGN_MAPS[4]).targetScore,3);
});
test('boss locks aim and velocity before volley and remains still during recovery',()=>{
 const m=new Match(CAMPAIGN_MAPS[6]), b=m.boss, s=m.ships[1], t=m.ships[0];
 b.remaining=.7; b.angle=.25; s.vx=100; s.vy=40;
 const action=b.step(.1,s,t,m.map,2); assert.equal(b.angle,.25); assert.deepEqual(action.control.move,{x:0,y:0});assert.equal(s.vx,0);
 b.phase='recover';s.vx=30;b.step(.1,s,t,m.map,3);assert.equal(s.vx,0);
});
test('death events retain cause and owner, including self hits and hazards',()=>{
 const m=new Match(CAMPAIGN_MAPS[0]);m.drainEvents();m.resolveDeaths([{victim:1,owner:1,cause:'self'}]);
 assert.equal(m.drainEvents().find(e=>e.type==='death').cause,'self');
});
test('compact pair captures a continuous multi-body circuit and completes two revolutions',()=>{
 const bodies=[createBody('a','planet',580,375,{radius:30}),createBody('b','star',700,375,{radius:30})];
 const host=orbitalHosts(bodies).find(b=>b.id.startsWith('@system:'));assert.ok(host);
 const p={x:host.x+host.orbitCaptureRadius+1,y:host.y,vx:-360,vy:50,radius:5,age:0,ownerId:1,kind:'orbital'};
 for(let i=0;i<120&&!p.orbitState;i++)assert.equal(stepProjectile(p,bodies),null);
 assert.equal(p.orbitState.bodyId,host.id);const start={x:p.x,y:p.y};
 const period=2*Math.PI/p.orbitState.meanMotion;
 for(let i=0;i<Math.round(2*period/PHYSICS_DT);i++)assert.equal(stepProjectile(p,bodies),null);
 assert.ok(Math.hypot(p.x-start.x,p.y-start.y)<5);assert.ok(p.orbitState.sweptAngle>12);
});
test('generous capture accepts a sweep of non-tangent shots around every celestial type',()=>{
 for(const type of ['planet','moon','star','pulsar','blackHole']) for(const a of [-.4,-.2,0,.2,.4]){
  const b=createBody('host',type,640,375,{radius:40});
  const p={x:640+b.orbitCaptureRadius+1,y:375,vx:-360*Math.cos(a),vy:360*Math.sin(a),radius:5,age:0,ownerId:1,kind:'orbital'};
  for(let i=0;i<120&&!p.orbitState;i++)assert.equal(stepProjectile(p,[b]),null);
  assert.equal(p.orbitState.bodyId,'host');
 }
});

import { aimPreview } from '../.test-build/rendering/AimPreview.js';
test('guidance previews apply equally to all pilots and expire with the pickup',()=>{
 const m=new Match(CAMPAIGN_MAPS[4]);
 for(const ship of m.ships){assert.equal(aimPreview(ship,m.map,m.ships,0),null);ship.aimAssistFor=5;
 assert.ok(aimPreview(ship,m.map,m.ships,0).points.length>2);ship.aimAssistFor=0;assert.equal(aimPreview(ship,m.map,m.ships,0),null);}
});
test('laser pickup previews without guidance, stops at cover and persists through charge',()=>{
 const m=new Match({...CAMPAIGN_MAPS[0],bodies:[createBody('cover','planet',640,375,{radius:40})]});
 for(const ship of m.ships){ship.x=400;ship.y=375;ship.angle=0;ship.specialShot='laser';
 const p=aimPreview(ship,m.map,[],0);assert.equal(p.laser,true);assert.equal(p.points[0].y,p.points[1].y);assert.ok(p.points[1].x<640);
 ship.specialShot=null;ship.laserCharge={remaining:.2,angle:0};assert.equal(aimPreview(ship,m.map,[],0).laser,true);
 ship.laserCharge=null;assert.equal(aimPreview(ship,m.map,[],0),null);ship.alive=false;ship.specialShot='laser';assert.equal(aimPreview(ship,m.map,[],0),null);}
});

import { BossEncounter } from '../.test-build/game/BossEncounter.js';
import { Ship } from '../.test-build/entities/Ship.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { ARCADE } from '../.test-build/game/Arcade.js';
test('campaign entry actually uses the shortened opening score, not just Match defaults',()=>{
 assert.deepEqual(ARCADE.slice(0,3).map(a=>a.targetScore),[2,2,3]);
});
test('each boss leads lateral motion, then locks its announced volley',()=>{
 for(const unit of [0,1,2])for(const vy of [-60,60]){
  const boss=new BossEncounter(unit),self=new Ship(2,{x:950,y:340,angle:Math.PI}),target=new Ship(1,{x:400,y:350,angle:0});
  self.radius=34;target.vy=vy;const map={bodies:[],wormholes:[],shipGravity:'none'};
  boss.remaining=1;boss.step(.01,self,target,map,0);const angle=boss.angle;
  let miss=Infinity;
  for(const a of boss.shotAngles){const p=createProjectile({...self,muzzleOffset:44},a);
   for(let i=0;i<300;i++){const t=boss.remaining+i/120;miss=Math.min(miss,Math.hypot(p.x-target.x,p.y-target.y-vy*t));if(stepProjectile(p,[],[]))break;}}
  assert.ok(miss<target.radius+3,`unit ${unit} miss ${miss}`);
  boss.remaining=.7;target.y=600;target.vy=-vy;boss.step(.1,self,target,map,.3);assert.equal(boss.angle,angle);
 }
});
test('boss attack patterns have distinct lanes and re-open only on a new recovery',()=>{
 for(const unit of [0,1,2]){
  const b=new BossEncounter(unit),m=new Match(CAMPAIGN_MAPS[[6,16,29][unit]]);
  assert.equal(b.shotAngles.length,[4,6,7][unit]);b.cycle=1;assert.equal(b.shotAngles.length,unit===2?7:3);
  b.cycle=2;assert.equal(b.laser,unit>0);
  b.phase='recover';assert.equal(b.vulnerable,true);b.registerHit();assert.equal(b.vulnerable,false);
  b.phase='attack';b.remaining=0;b.step(.01,m.ships[1],m.ships[0],m.map,0);assert.equal(b.vulnerable,true);
 }
});

import { bossPreview } from '../.test-build/rendering/BossPreview.js';
import { SquadCoordinator } from '../.test-build/ai/SquadCoordinator.js';
test('boss curved warning uses the exact future launch position and physical path',()=>{
 const m=new Match(CAMPAIGN_MAPS[16]),s=m.ships[1],b=m.boss;b.remaining=.7;b.angle=2.5;
 const paths=bossPreview(b,s,m.map,3),p=createProjectile({...s,vx:0,vy:0,muzzleOffset:s.radius+10},b.shotAngles[0],'normal',3.7);
 assert.deepEqual(paths[0][0],{x:p.x,y:p.y});
 for(let i=0;i<8;i++)assert.equal(stepProjectile(p,m.map.bodies,[],{wormholes:m.map.wormholes}),null);
 assert.ok(Math.hypot(paths[0][1].x-p.x,paths[0][1].y-p.y)<1e-6);
 b.phase='recover';assert.deepEqual(bossPreview(b,s,m.map,3),[]);
});
test('squads give pressure to an unobstructed pilot and intercept a fast escaping target',()=>{
 const target=new Ship(1,{x:330,y:385,angle:0}),a=new Ship(2,{x:800,y:385,angle:Math.PI}),b=new Ship(3,{x:800,y:180,angle:Math.PI});
 const squad=new SquadCoordinator(26),body=createBody('cover','planet',550,385,{radius:75});
 squad.update(.01,[a,b],target,[body],0,[]);assert.equal(squad.orders.get(3).role,'PRESSURE');
 target.vy=100;squad.update(1,[a,b],target,[body],1,[]);
 assert.equal(squad.orders.get(2).role,'INTERCEPT');assert.equal(squad.orders.get(2).targetId,1);
 squad.recordShot(3,1);assert.equal(squad.orders.get(2).advance,true);
});
test('laser warning ignores an ally that the actual beam cannot hit',()=>{
 const a=new Ship(1,{x:100,y:300,angle:0}),ally=new Ship(2,{x:350,y:300,angle:0}),enemy=new Ship(3,{x:700,y:300,angle:0});
 a.specialShot='laser';const p=aimPreview(a,{bodies:[],teams:[1,1,2,2]},[a,ally,enemy],0);
 assert.ok(p.points[1].x>600&&p.points[1].x<700);
});
