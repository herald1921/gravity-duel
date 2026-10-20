import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../.test-build/config.js';
import { createBody, bodyPosition, bodyVelocity } from '../.test-build/entities/CelestialBody.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { portalPair, teleportShip } from '../.test-build/entities/Wormhole.js';
import { captureOrbit, stepProjectile, simulateTrajectory } from '../.test-build/physics/gravity.js';
import { Match } from '../.test-build/game/Match.js';
import { MAPS } from '../.test-build/maps/maps.js';
const close=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,a+' != '+b);
const initial=(o={})=>({x:790,y:375,vx:-50,vy:-250,radius:3,age:0,ownerId:1,kind:'orbital',...o});
test('a ship touching a solid planet can thrust away in every radial direction',()=>{
 const body=createBody('solid','planet',640,375);
 for(const angle of [0,0.6,1.2,2,Math.PI,-1,-2]){
  const r=body.radius+C.SHIP_RADIUS,s=new Ship(1,{x:body.x+r*Math.cos(angle),y:body.y+r*Math.sin(angle),angle});
  for(let i=0;i<80;i++)s.update(C.PHYSICS_DT,{turn:0,thrust:1,fire:false},[body]);
  assert.ok(Math.hypot(s.x-body.x,s.y-body.y)>r+25);
 }
});
test('solid collision still stops inward motion without preventing subsequent departure',()=>{
 const b=createBody('solid','moon',500,350),s=new Ship(1,{x:430,y:350,angle:0});
 s.vx=150;for(let i=0;i<40;i++)s.update(C.PHYSICS_DT,IDLE_CONTROL,[b]);
 assert.ok(s.x<=b.x-b.radius-s.radius+1e-7);
 s.angle=Math.PI;const x=s.x;
 for(let i=0;i<80;i++)s.update(C.PHYSICS_DT,{turn:0,thrust:1,fire:false},[b]);
 assert.ok(s.x<x-25);
});
test('ship portal transport rotates heading and velocity and keeps loadout',()=>{
 const [a,b]=portalPair([250,300,0],[900,400,-Math.PI/2]),s=new Ship(1,{x:250,y:300,angle:0.2});
 s.vx=100;s.vy=20;s.specialShot='homing';s.shield=true;
 teleportShip(s,a,b);close(s.vx,20);close(s.vy,-100);close(s.angle,0.2-Math.PI/2);
 assert.equal(s.specialShot,'homing');assert.equal(s.shield,true);
 close(Math.hypot(s.x-b.x,s.y-b.y),b.radius+s.radius+2);
 assert.equal(s.portalCooldown,C.WORMHOLE_REENTRY_COOLDOWN);
});
test('ships can repeatedly use both portal directions after cooldown; gap is not a bullet collision',()=>{
 const gates=portalPair([250,300,0],[900,300,0]);
 const m=new Match({...MAPS[0],bodies:[],wormholes:gates,player1Spawn:{x:205,y:300,angle:0},player2Spawn:{x:1150,y:200,angle:0}});
 m.phase='playing';m.bullets.push({x:600,y:300,vx:0,vy:0,radius:3,age:1,ownerId:2,kind:'normal',trail:[]});
 m.step([IDLE_CONTROL,IDLE_CONTROL]);assert.equal(m.ships[0].x,950);assert.equal(m.ships[0].alive,true);
 const s=m.ships[0];s.x=900;
 m.step([IDLE_CONTROL,IDLE_CONTROL]);assert.equal(s.x,900);
 for(let i=0;i<Math.ceil(C.WORMHOLE_REENTRY_COOLDOWN/C.PHYSICS_DT)+1;i++)m.step([IDLE_CONTROL,IDLE_CONTROL]);
 assert.equal(s.x,300);
 s.x=250;for(let i=0;i<Math.ceil(C.WORMHOLE_REENTRY_COOLDOWN/C.PHYSICS_DT)+1;i++)m.step([IDLE_CONTROL,IDLE_CONTROL]);
 assert.equal(s.x,950);assert.ok(m.drainEvents().filter(e=>e.sound==='teleport').length>=3);
});
test('safe elliptical input is retained exactly, including radial velocity and position',()=>{
 const body=createBody('host','planet',640,375),r=150,mu=body.gravityStrength*C.ORBIT_SPEED_MULTIPLIER**2;
 const b=initial({vx:-25,vy:-Math.sqrt(mu/r)}),before=structuredClone(b);
 captureOrbit(b,body,0);close(b.x,before.x);close(b.y,before.y);close(b.vx,before.vx);close(b.vy,before.vy);
 assert.ok(b.orbitState.eccentricity>0.05);assert.ok(b.orbitState.periapsis>107);
});
test('ellipses preserve focus equation, energy and angular momentum over several revolutions',()=>{
 const body=createBody('host','planet',640,375),b=initial({vx:-120,vy:-200});
 captureOrbit(b,body,0);const o={...b.orbitState};let low=Infinity,high=0;
 const h=(b.x-body.x)*(-b.vy)+(b.y-body.y)*b.vx;
 for(let i=0;i<2500;i++){
  assert.equal(stepProjectile(b,[body]),null);
  const dx=b.x-body.x,dy=-(b.y-body.y),c=Math.cos(o.argumentOfPeriapsis),s=Math.sin(o.argumentOfPeriapsis);
  const x=c*dx+s*dy+o.semiMajorAxis*o.eccentricity,y=-s*dx+c*dy;
  close(x*x/o.semiMajorAxis**2+y*y/(o.semiMajorAxis**2*(1-o.eccentricity**2)),1);
  const r=Math.hypot(dx,dy);low=Math.min(low,r);high=Math.max(high,r);
  close((b.vx*b.vx+b.vy*b.vy)/2-o.gravitationalParameter/r,-o.gravitationalParameter/(2*o.semiMajorAxis),1e-6);
  close(dx*(-b.vy)-dy*b.vx,h,1e-6);
 }
 assert.ok(high-low>35);assert.ok(low>=o.periapsis-1e-6);assert.ok(high<=o.apoapsis+1e-6);
});
test('capture guarantees non-intersecting bound ellipses for extreme incoming directions and speeds',()=>{
 const body=createBody('host','planet',640,375);
 for(const speed of [0,20,300,1500,5000])for(let k=0;k<24;k++){
  const b=initial({vx:speed*Math.cos(k*Math.PI/12),vy:speed*Math.sin(k*Math.PI/12)});
  captureOrbit(b,body,0);const o=b.orbitState;
  assert.ok(Number.isFinite(o.semiMajorAxis));assert.ok(o.eccentricity<=C.ORBIT_MAX_ECCENTRICITY+1e-8);
  assert.ok(o.periapsis>=107-1e-7);assert.ok(o.apoapsis<=310+1e-7);
 }
});
test('elliptical preview and moving-center live simulation remain identical',()=>{
 const body=createBody('host','moon',600,375,{motion:{radius:80,period:26,phase:0}}),t=3;
 const p=bodyPosition(body,t),v=bodyVelocity(body,t);
 const b=initial({x:p.x+80,y:p.y,vx:v.x-40,vy:v.y-210,time:t});captureOrbit(b,body,t);
 const predicted=simulateTrajectory(b,[body],[],3,1),actual=structuredClone(b);
 for(let i=0;i<Math.round(predicted.elapsed/C.PHYSICS_DT);i++)stepProjectile(actual,[body]);
 assert.deepEqual(actual,predicted.end);
});
