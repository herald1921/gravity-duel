import test from 'node:test';
import assert from 'node:assert/strict';
import {Ship,IDLE_CONTROL} from '../.test-build/entities/Ship.js';
import {Match} from '../.test-build/game/Match.js';
import {pilotInput} from '../.test-build/input/PilotInput.js';
import {TouchState} from '../.test-build/input/TouchState.js';
import {Profile,SAVE_KEY} from '../.test-build/platform/Profile.js';
import {portalPair,teleportShip} from '../.test-build/entities/Wormhole.js';
import {PHYSICS_DT,ROUND_START_TIME,RESPAWN_DELAY} from '../.test-build/config.js';
const spawn={x:300,y:400,angle:0};
const advance=(s,c,n=120)=>{for(let i=0;i<n;i++)s.update(PHYSICS_DT,c,[]);};
test('modern pilot can strafe vertically while keeping the cannon horizontal',()=>{
 const s=new Ship(1,spawn);advance(s,pilotInput(0,-1,0,false),40);
 assert.equal(s.angle,0);assert.ok(s.y<spawn.y);assert.ok(Math.abs(s.x-spawn.x)<1e-8);assert.ok(s.hullAngle<-.8);
});
test('moving without an aim input never rotates a modern cannon; classic heading still follows movement',()=>{
 const modern=new Ship(1,spawn),classic=new Ship(1,spawn);
 advance(modern,pilotInput(0,1,undefined,false),40);advance(classic,{...IDLE_CONTROL,move:{x:0,y:1}},40);
 assert.equal(modern.angle,0);assert.ok(classic.angle>1);
});
test('modern diagonal speed is bounded and released movement brakes without snapping',()=>{
 const a=new Ship(1,spawn),b=new Ship(1,spawn);advance(a,pilotInput(1,0,0,false),15);advance(b,pilotInput(1,1,0,false),15);
 assert.ok(Math.abs(Math.hypot(a.vx,a.vy)-Math.hypot(b.vx,b.vy))<1e-7);
 const initial=a.vx;advance(a,pilotInput(0,0,0,false),30);assert.ok(a.vx>0&&a.vx<initial*.5);
});
test('actual match projectile follows independent cannon direction while hull faces elsewhere',()=>{
 const m=new Match({id:'probe',name:'probe',description:'',hint:'',bodies:[],player1Spawn:spawn,player2Spawn:{x:1100,y:500,angle:Math.PI}});
 m.phase='playing';for(let i=0;i<40;i++)m.step([pilotInput(0,-1,0,false),IDLE_CONTROL]);
 m.fire(1);assert.ok(m.ships[0].hullAngle<-.8);assert.ok(m.bullets[0].vx>350);assert.ok(m.bullets[0].x>m.ships[0].x);
});
test('two touch sticks retain distinct pointers and releasing fire preserves movement',()=>{
 const s=new TouchState(true);assert.ok(s.beginStick(1,-1,0));assert.ok(s.beginAim(2,0,-1));
 assert.equal(s.beginAim(3,1,0),false);assert.equal(s.beginStick(2,1,0),false);
 assert.equal(s.control().aim,-Math.PI/2);assert.equal(s.control().fire,false);assert.equal(s.control().move.x,-1);
 s.release(2);assert.equal(s.control().fire,true);s.consumeFire();assert.equal(s.control().fire,false);assert.equal(s.control().aim,-Math.PI/2);assert.equal(s.control().move.x,-1);
});
test('touch deadzone does not fire and pause cancellation cannot leave a stuck shot',()=>{
 const s=new TouchState(true);s.beginAim(2,.1,.1);assert.equal(s.control().fire,false);
 s.moveAim(2,1,0);assert.equal(s.control().fire,false);s.clear();s.moveAim(2,1,0);
 assert.equal(s.control().fire,false);assert.equal(s.control().aim,undefined);assert.equal(s.aimPosition.held,false);
});
test('portal rotates hull and cannon by the same angle preserving their relative orientation',()=>{
 const s=new Ship(1,spawn);s.hullAngle=-1;const [a,b]=portalPair([300,400,0],[900,300,Math.PI/2]);teleportShip(s,a,b);
 assert.ok(Math.abs((s.angle-s.hullAngle)-1)<1e-8);
});
test('playtest controls persist under a separate key without touching the original save',()=>{
 const values=new Map([['gravity-tanks-profile-v1','original data']]);const store={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const p=new Profile(()=>store);assert.equal(p.data.controls,'modern');p.setControls('classic');p.begin(2);
 assert.equal(new Profile(()=>store).data.controls,'modern');assert.notEqual(SAVE_KEY,'gravity-tanks-profile-v1');assert.equal(values.get('gravity-tanks-profile-v1'),'original data');
});
test('inter-round wait is shorter without removing readable death feedback',()=>{
 assert.ok(ROUND_START_TIME+RESPAWN_DELAY<=1.4);assert.ok(RESPAWN_DELAY>=.6);
});
