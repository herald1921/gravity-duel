import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../.test-build/config.js';
import { createProjectile } from '../.test-build/entities/Bullet.js';
import { Ship, IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { createBody } from '../.test-build/entities/CelestialBody.js';
import { portalPair } from '../.test-build/entities/Wormhole.js';
import { steerHoming, stepProjectile, simulateTrajectory } from '../.test-build/physics/gravity.js';
import { findAimSolution } from '../.test-build/ai/SpaceAI.js';
import { Match } from '../.test-build/game/Match.js';
import { shotHighlight } from '../.test-build/game/Highlights.js';
import { Profile, SAVE_KEY } from '../.test-build/platform/Profile.js';
import { MAPS } from '../.test-build/maps/maps.js';
const target = { id: 2, x: 700, y: 500, radius: 20, alive: true };
const shot = (overrides = {}) => ({ x: 100, y: 300, vx: 306, vy: 0, age: 0, radius: 3, ownerId: 1, kind: 'homing', ...overrides });
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, a+' != '+b);
const memory = () => { const values=new Map(); return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}; };

test('homing arms after 0.3 s, caps turn rate and preserves steering speed', () => {
 const b=shot(); steerHoming(b,[target]); assert.equal(b.vy,0);
 b.age=C.HOMING_ARM_TIME; steerHoming(b,[target]);
 close(Math.atan2(b.vy,b.vx),C.HOMING_TURN_RATE*C.PHYSICS_DT); close(Math.hypot(b.vx,b.vy),306);
});
test('homing expires its guidance window and ignores dead enemies and its owner', () => {
 for(const [age,targets] of [[C.HOMING_ARM_TIME+C.HOMING_TRACK_TIME,[target]],[1,[{...target,alive:false}]],[1,[{...target,id:1}]]]) {
  const b=shot({age});steerHoming(b,targets);assert.equal(b.vy,0);
 }
 const b=shot({age:1});steerHoming(b,[{...target,y:100}]);assert.ok(b.vy<0);
});
test('homing continues to feel gravity while guidance is active', () => {
 const body=createBody('test','moon',400,600);
 const a=shot({age:0.5}),b=structuredClone(a);
 stepProjectile(a,[],[target]);stepProjectile(b,[body],[target]);
 assert.ok(b.vy>a.vy);assert.ok(b.gravityTurn>0);
});
test('homing cannot tunnel through a planet and shield absorbs it', () => {
 const b=shot({x:300,y:300,vx:1500,age:1});
 const body=createBody('wall','planet',410,300,{gravityStrength:0,radius:60});
 let hit;for(let n=0;n<30&&!hit;n++)hit=stepProjectile(b,[body],[target]);
 assert.equal(hit.type,'body');
 const map={...MAPS[0],bodies:[],player1Spawn:{x:100,y:300,angle:0},player2Spawn:{x:400,y:300,angle:Math.PI}};
 const m=new Match(map);m.phase='playing';m.ships[1].shield=true;
 m.bullets.push({...shot({x:379,y:300,age:0.5}),trail:[]});m.step([IDLE_CONTROL,IDLE_CONTROL]);
 assert.equal(m.ships[1].alive,true);assert.equal(m.ships[1].shield,false);assert.equal(m.scores[1],0);
 assert.equal(m.drainEvents().some(e=>e.highlight),false);
});
test('homing survives portal rotation and prediction exactly matches live stepping', () => {
 const gates=portalPair([190,300,0],[800,300,-Math.PI/2]),initial=shot(),b=structuredClone(initial);
 const targets=[{...target,x:950,y:150}],context={wormholes:gates};
 const prediction=simulateTrajectory(initial,[],targets,1.6,1,context);
 for(let i=0;i<Math.round(prediction.elapsed/C.PHYSICS_DT);i++)stepProjectile(b,[],targets,context);
 assert.deepEqual(b,prediction.end);assert.ok(b.portalVisits>0);assert.equal(b.ownerId,1);assert.equal(b.kind,'homing');
 assert.ok(prediction.points.some(p=>p.breakBefore));
});
test('homing target changes alter future path and lifetime is bounded', () => {
 const b=shot({x:640,y:300,vx:0,vy:50,age:0.5});
 const up={...target,x:700,y:100},down={...target,x:700,y:600};
 const a=simulateTrajectory(b,[],[up],0.7),c=simulateTrajectory(b,[],[down],0.7);
 assert.notEqual(a.end.x,c.end.x);
 const expired=shot({x:600,y:300,vx:0,age:C.HOMING_LIFETIME-C.PHYSICS_DT});
 assert.equal(stepProjectile(expired,[]).type,'expired');
});
test('homing is a one-use slot and AI uses the same target-aware simulator', () => {
 const map={...MAPS[0],bodies:[]},m=new Match(map);m.phase='playing';m.ships[0].specialShot='homing';
 assert.equal(m.fire(1),true);assert.equal(m.ships[0].specialShot,null);assert.equal(m.bullets[0].kind,'homing');
 const self=new Ship(1,{x:180,y:400,angle:0}),enemy=new Ship(2,{x:900,y:300,angle:Math.PI});
 const aim=findAimSolution(self,enemy,[],{},'homing');
 const direct=simulateTrajectory(createProjectile(self,aim.angle,'homing'),[],[self,enemy],C.AI_SEARCH_SECONDS,3);
 assert.deepEqual(aim.trajectory,direct);assert.equal(aim.trajectory.event?.shipId,2);
});
test('ordinary cannon retains its physical trajectory without homing behavior', () => {
 const a=shot({kind:'normal',age:1}),b=structuredClone(a);
 stepProjectile(a,[],[target]);stepProjectile(b,[]);
 assert.deepEqual(a,b);
});
test('checkpoint, cleared arenas, tutorial and independent audio settings survive reload', () => {
 const store=memory(),p=new Profile(()=>store);
 p.begin(3);p.finishTutorial();p.setAudio(false,true);p.clearArena(3);
 const q=new Profile(()=>store);
 assert.equal(q.data.runIndex,4);assert.deepEqual(q.data.cleared,[3]);assert.equal(q.data.tutorialDone,true);
 assert.equal(q.data.music,false);assert.equal(q.data.sfx,true);
 q.clearArena(29);assert.equal(new Profile(()=>store).data.runIndex,null);
 q.begin(0);assert.deepEqual(q.data.cleared,[3,29]);
});
test('invalid or corrupt profiles cannot select nonexistent arenas or crash', () => {
 const store=memory();store.setItem(SAVE_KEY,'{broken');
 assert.doesNotThrow(()=>new Profile(()=>store));
 store.setItem(SAVE_KEY,JSON.stringify({version:1,runIndex:500,cleared:[0,0,-1,30,'2',3],music:false}));
 const p=new Profile(()=>store);assert.equal(p.data.runIndex,null);assert.deepEqual(p.data.cleared,[0,3]);
 assert.equal(p.data.music,false);assert.equal(p.data.sfx,true);
});
test('storage denial keeps session progress and reports that it cannot be saved', () => {
 const p=new Profile(()=>{throw Error('denied')});
 p.begin(5);p.clearArena(5);p.setAudio(false,false);
 assert.equal(p.persistent,false);assert.equal(p.data.runIndex,6);assert.equal(p.data.music,false);
 const store={getItem:()=>null,setItem:()=>{throw Error('quota')}},q=new Profile(()=>store);
 q.begin(2);assert.equal(q.persistent,false);assert.equal(q.data.runIndex,2);
});
test('highlights distinguish gravity, portals, stable orbit and homing; self-hit is never celebrated', () => {
 assert.equal(shotHighlight(shot({kind:'normal',age:1,gravityTurn:0.7})),'SLINGSHOT');
 assert.equal(shotHighlight(shot({portalVisits:1})),'PORTAL SHOT');
 assert.equal(shotHighlight(shot({orbitState:{}})),'ORBITAL HIT');
 assert.equal(shotHighlight(shot()),'MISSILE HIT');
 assert.equal(shotHighlight(shot({kind:'normal'})),undefined);
 const m=new Match({...MAPS[0],bodies:[]});m.phase='playing';
 const p=m.ships[0];m.bullets.push({...shot({x:p.x,y:p.y,age:1,gravityTurn:1}),trail:[]});
 m.step([IDLE_CONTROL,IDLE_CONTROL]);assert.equal(m.lastDeath?.cause,'self');
 assert.equal(m.drainEvents().some(e=>e.highlight),false);
});
