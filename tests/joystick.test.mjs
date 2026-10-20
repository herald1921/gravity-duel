import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchState, STICK_DEAD_ZONE } from '../.test-build/input/TouchState.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { PHYSICS_DT } from '../.test-build/config.js';
const idle={turn:0,thrust:0,fire:false};
test('joystick dead zone suppresses drift; axes have proportional strength and correct signs',()=>{
 const s=new TouchState();s.beginStick(1,0,0);assert.deepEqual(s.control(),idle);
 s.moveStick(1,STICK_DEAD_ZONE*.9,0);assert.deepEqual(s.control(),idle);
 s.moveStick(1,.59,0);assert.ok(Math.abs(s.control().move.x-.5)<1e-8);
 s.moveStick(1,0,-1);assert.equal(s.control().move.y,-1);
 s.moveStick(1,0,1);assert.equal(s.control().move.y,1);
 s.moveStick(1,-1,0);assert.equal(s.control().move.x,-1);
});
test('diagonal movement is a normalized screen-space direction; overdrag remains bounded',()=>{
 const s=new TouchState();s.beginStick(1,20,-20);
 assert.ok(Math.abs(s.control().move.x-Math.SQRT1_2)<1e-8);
 assert.ok(Math.abs(s.control().move.y+Math.SQRT1_2)<1e-8);
 assert.ok(Math.hypot(s.stickPosition.x,s.stickPosition.y)<=1.000001);
 s.moveStick(1,Infinity,NaN);assert.ok(Number.isFinite(s.control().move.x));
});
test('two thumbs keep independent ownership; additional finger cannot steal joystick',()=>{
 const s=new TouchState();s.beginStick(1,1,-1);s.press(2,'fire');
 assert.equal(s.beginStick(3,-1,1),false);s.moveStick(3,-1,1);assert.ok(s.control().move.x>0);
 s.press(1,'fire');s.release(2);s.consumeFire();assert.equal(s.control().fire,false);assert.ok(s.control().move.y<0);
 s.press(2,'fire');s.release(1);assert.equal(s.control().move,undefined);assert.equal(s.control().fire,true);
 assert.equal(s.beginStick(2,1,0),false);s.release(2);s.consumeFire();assert.deepEqual(s.control(),idle);
});
test('cancellation clears movement and pending shot; stale pointer moves do not reactivate',()=>{
 const s=new TouchState();s.beginStick(1,1,-1);s.press(2,'fire');s.clear();s.moveStick(1,1,-1);
 assert.deepEqual(s.control(),idle);assert.equal(s.stickPosition.held,false);
});
test('partial direction stick produces proportional acceleration, while neutral preserves inertia',()=>{
 const a=new Ship(1,{x:600,y:400,angle:0}),b=new Ship(1,{x:600,y:400,angle:0});
 a.update(PHYSICS_DT,{...idle,move:{x:.5,y:0}},[]);b.update(PHYSICS_DT,{...idle,move:{x:1,y:0}},[]);
 assert.ok(Math.abs(a.vx*2-b.vx)<1e-8);const speed=b.vx;b.update(PHYSICS_DT,IDLE_CONTROL,[]);
 assert.ok(b.vx>0&&b.vx<speed);
});
test('keyboard braking and reverse still work',()=>{
 const a=new Ship(1,{x:600,y:400,angle:0}),b=new Ship(1,{x:600,y:400,angle:0});a.vx=b.vx=150;
 a.update(PHYSICS_DT,{...idle,thrust:-.25},[]);b.update(PHYSICS_DT,{...idle,thrust:-1},[]);
 assert.ok(a.vx>b.vx&&a.vx<150);
 for(let i=0;i<360;i++)b.update(PHYSICS_DT,{...idle,thrust:-1},[]);
 assert.ok(b.vx<0);
});
test('all eight stick directions accelerate in screen space regardless of initial heading',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
  const state=new TouchState();state.beginStick(1,x,y);
  const ship=new Ship(1,{x:600,y:400,angle});ship.update(PHYSICS_DT,state.control(),[]);
  const length=Math.hypot(ship.vx,ship.vy),direction=Math.hypot(x,y);
  assert.ok(Math.abs(ship.vx/length-x/direction)<1e-8);assert.ok(Math.abs(ship.vy/length-y/direction)<1e-8);
 }
});
test('diagonal speed matches cardinal speed and facing settles toward stick aim',()=>{
 const a=new Ship(1,{x:600,y:400,angle:Math.PI}),b=new Ship(1,{x:600,y:400,angle:Math.PI});
 a.update(PHYSICS_DT,{...idle,move:{x:1,y:0}},[]);b.update(PHYSICS_DT,{...idle,move:{x:1,y:1}},[]);
 assert.ok(Math.abs(Math.hypot(a.vx,a.vy)-Math.hypot(b.vx,b.vy))<1e-8);
 for(let i=0;i<150;i++)a.update(PHYSICS_DT,{...idle,move:{x:1,y:0}},[]);
 assert.ok(Math.abs(a.angle)<1e-8);const facing=a.angle;a.update(PHYSICS_DT,idle,[]);assert.equal(a.angle,facing);
});
test('opposing stick counters velocity and then accelerates the opposite way',()=>{
 const ship=new Ship(1,{x:600,y:400,angle:0});ship.vx=100;
 const control={...idle,move:{x:-1,y:0}};ship.update(PHYSICS_DT,control,[]);assert.ok(ship.vx<100);
 for(let i=0;i<90;i++)ship.update(PHYSICS_DT,control,[]);
 assert.ok(ship.vx<0);assert.ok(Math.abs(ship.vy)<1e-8);
});
test('pulsar interference still reduces directional acceleration and turning',()=>{
 const normal=new Ship(1,{x:600,y:400,angle:Math.PI/2}),jammed=new Ship(1,{x:600,y:400,angle:Math.PI/2});
 jammed.jammedFor=1;const control={...idle,move:{x:1,y:0}};
 normal.update(PHYSICS_DT,control,[]);jammed.update(PHYSICS_DT,control,[]);
 assert.ok(jammed.vx>0&&jammed.vx<normal.vx);assert.ok(jammed.angle>normal.angle);
});
