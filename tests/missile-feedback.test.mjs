import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../.test-build/config.js';
import { createBody } from '../.test-build/entities/CelestialBody.js';
import { captureOrbit, stepProjectile, steerHoming } from '../.test-build/physics/gravity.js';
import { projectileIndicator, orbitalAlpha } from '../.test-build/rendering/projectileFeedback.js';
import { Match } from '../.test-build/game/Match.js';
import { MAPS } from '../.test-build/maps/maps.js';
import { IDLE_CONTROL } from '../.test-build/entities/Ship.js';
const shot=(kind='homing',o={})=>({x:300,y:500,vx:306,vy:0,radius:3,age:0,ownerId:1,kind,...o});

test('homing visibly bends and intercepts a crossing target that an unguided shot misses',()=>{
 const results=[];
 for(const kind of ['homing','normal']){
  const b=shot(kind),target={id:2,x:720,y:280,radius:20,alive:true};let event=null,min=Infinity;
  for(let i=0;i<540&&!event;i++){
   target.previous={x:target.x,y:target.y};target.y+=70*C.PHYSICS_DT;
   event=stepProjectile(b,[],[target]);min=Math.min(min,Math.hypot(b.x-target.x,b.y-target.y));
  }
  results.push({event,min});
 }
 assert.deepEqual(results[0].event,{type:'ship',shipId:2});assert.ok(results[1].min>100);
});
test('guided engine restores cruise speed and lock disappears when target dies or guidance expires',()=>{
 const target={id:2,x:1000,y:300,radius:20,alive:true},b=shot('homing',{vx:30,age:0.3});
 for(let i=0;i<240;i++)steerHoming(b,[target]);
 assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-C.HOMING_CRUISE_SPEED)<1e-8);assert.equal(b.homingTargetId,2);
 target.alive=false;steerHoming(b,[target]);assert.equal(b.homingTargetId,undefined);
 target.alive=true;b.age=C.HOMING_ARM_TIME+C.HOMING_TRACK_TIME;steerHoming(b,[target]);assert.equal(b.homingTargetId,undefined);
});
test('captured orbit crosses the old deletion boundary and returns intact, while free rounds still leave',()=>{
 const body=createBody('edge','planet',1250,350),b=shot('orbital',{x:1100,y:350,vx:0,vy:-300});
 captureOrbit(b,body,0);let outside=false,returned=false;
 for(let i=0;i<2400;i++){
  const event=stepProjectile(b,[body]);assert.equal(event,null);
  if(b.x>C.WORLD.width+C.OUT_OF_BOUNDS_MARGIN)outside=true;
  if(outside&&b.x<C.WORLD.width)returned=true;
 }
 assert.ok(outside&&returned);
 const free=shot('normal',{x:1450,y:300});assert.equal(stepProjectile(free,[]).type,'bounds');
});
test('orbit still expires outside the camera rather than persisting forever',()=>{
 const body=createBody('edge','planet',1390,350),b=shot('orbital',{x:1540,y:350,vx:0,vy:-300,age:24-C.PHYSICS_DT});
 captureOrbit(b,body,0);assert.equal(stepProjectile(b,[body]).type,'expired');
});
test('other-body orbital collision emits its cause and leaves the round playing',()=>{
 const base=createBody('host','planet',600,350),b=shot('orbital',{x:755,y:350,vx:0,vy:-300,trail:[]});captureOrbit(b,base,0);
 const obstacle=createBody('other','moon',b.x,b.y,{radius:10,gravityStrength:0});
 const m=new Match({...MAPS[0],bodies:[base,obstacle]});m.phase='playing';m.bullets=[b];
 m.step([IDLE_CONTROL,IDLE_CONTROL]);
 assert.equal(m.phase,'playing');assert.equal(m.bullets.length,0);
 const event=m.drainEvents().find(e=>e.type==='orbitalEnd');assert.equal(event.reason,'collision');assert.equal(event.bodyId,'other');
});
test('expiration and successful replacement have different notices; rejected shots do not remove old rounds',()=>{
 const m=new Match({...MAPS[0],bodies:[]});m.phase='playing';m.bullets=[{...shot('orbital',{x:600,y:300,age:24-C.PHYSICS_DT}),trail:[]}];
 m.step([IDLE_CONTROL,IDLE_CONTROL]);assert.equal(m.drainEvents().find(e=>e.type==='orbitalEnd').reason,'expired');
 m.ships[0].specialShot='orbital';assert.ok(m.fire(1));m.drainEvents();const old=m.bullets[0];
 m.ships[0].specialShot='orbital';assert.equal(m.fire(1),false);assert.equal(m.bullets[0],old);assert.deepEqual(m.drainEvents(),[]);
 m.ships[0].cooldown=0;assert.ok(m.fire(1));assert.equal(m.drainEvents().find(e=>e.type==='orbitalEnd').reason,'replaced');
});
test('edge indicators stay inside the arena and expiry blinking is restricted to the last three seconds',()=>{
 assert.equal(projectileIndicator({x:640,y:360}),null);
 for(const point of [{x:-500,y:350},{x:1800,y:350},{x:640,y:-200},{x:640,y:1200}]){
  const edge=projectileIndicator(point);assert.ok(edge.x>=44&&edge.x<=1236&&edge.y>=124&&edge.y<=650);
  assert.ok(Math.cos(edge.angle)*(point.x-edge.x)+Math.sin(edge.angle)*(point.y-edge.y)>0);
 }
 assert.equal(orbitalAlpha(20),1);assert.notEqual(orbitalAlpha(22),orbitalAlpha(22.0625));
 assert.ok(orbitalAlpha(23.9)>=0.45);
});
