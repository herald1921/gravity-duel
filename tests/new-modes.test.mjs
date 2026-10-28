import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { Match } from '../.test-build/game/Match.js';
import { OnlineRuntime } from '../.test-build/game/OnlineRuntime.js';
import { IDLE_CONTROL } from '../.test-build/entities/Ship.js';
import { TouchState } from '../.test-build/input/TouchState.js';
import { Profile, SAVE_KEY } from '../.test-build/platform/Profile.js';
const idle=Array(4).fill(IDLE_CONTROL);
test('every unit preserves 1v2 and appends a distinct boss after four-way FFA',()=>{
 for(let u=0;u<3;u++){const maps=CAMPAIGN_MAPS.filter(m=>m.unitIndex===u),[ffa,squad,boss]=maps.slice(-3);
 assert.equal(new Match(ffa).ships.length,4);assert.equal(new Match(squad).ships.length,3);assert.equal(squad.boss,undefined);
 assert.equal(boss.boss,u);assert.equal(new Match(boss).ships.length,2);assert.notDeepEqual(boss.bodies,squad.bodies);}
});
test('mutual AI kills grant no player score and both pilots respawn',()=>{
 const m=new Match({...CAMPAIGN_MAPS[4],bodies:[],powerUps:[]});m.phase='playing';
 m.resolveDeaths([{victim:2,owner:3,cause:'shot'},{victim:3,owner:2,cause:'shot'}]);
 assert.equal(m.scores[1],0);assert.equal(m.scores[2],1);assert.equal(m.scores[3],1);assert.equal(m.winner,null);assert.equal(m.phase,'playing');
 for(let i=0;i<218;i++)m.step(idle);assert.ok(m.ships[1].alive&&m.ships[2].alive);assert.ok(m.ships[1].invulnerableFor>0);
});
test('kill race has a time limit, tied overtime, self-kill exclusion and a genuine winner',()=>{
 const m=new Match(CAMPAIGN_MAPS[4]);m.phase='playing';m.time=90;m.finishDeathmatch();assert.equal(m.phase,'playing');
 m.resolveDeaths([{victim:1,owner:1,cause:'self'}]);assert.equal(m.scores[1],0);
 m.resolveDeaths([{victim:4,owner:2,cause:'shot'}]);m.finishDeathmatch();assert.equal(m.winner,2);
});
test('boss telegraphs before firing, is vulnerable only during recovery, and ignores own fire',()=>{
 for(const map of CAMPAIGN_MAPS.filter(m=>m.boss!==undefined)){
 const m=new Match({...map,bodies:[],wormholes:[],powerUps:[]});m.phase='playing';
 assert.equal(m.canHit(2,2),false);assert.equal(m.canHit(1,1),true);const deaths=new Map(),boss=m.ships[1],hp=boss.hp;
 m.attack(2,1,deaths);assert.equal(boss.hp,hp);for(let i=0;i<100;i++)m.step(idle);assert.equal(m.bullets.length,0);
 for(let i=0;i<80;i++)m.step(idle);assert.ok(m.drainEvents().some(e=>e.type==='shot'&&e.owner===2));
 m.boss.phase='recover';m.attack(2,1,deaths);assert.equal(boss.hp,hp-1);
 boss.invulnerableFor=0;boss.hp=1;m.attack(2,1,deaths);assert.ok(deaths.has(2));m.resolveDeaths([...deaths.values()]);assert.equal(m.winner,1);
 }
});
test('online 2v2 preserves two human allies against two AI; ally hits are excluded',()=>{
 const r=new OnlineRuntime('unit-1-6','teams'),m=r.match;r.humans.add(1);r.humans.add(2);
 assert.equal(m.boss,undefined);assert.equal(m.ships.length,4);assert.equal(m.canHit(1,2),false);assert.equal(m.canHit(1,3),true);
 assert.deepEqual(m.rivals(2).map(s=>s.id),[3,4]);m.phase='playing';m.resolveDeaths([{victim:3,cause:'shot',owner:1}]);assert.equal(m.phase,'playing');
 m.resolveDeaths([{victim:4,cause:'shot',owner:2}]);assert.equal(m.scores[1],1);assert.equal(m.roundWinner,1);
});
test('new campaign save migrates all 27 old levels but no extra boss and leaves original bytes intact',()=>{
 const old=JSON.stringify({version:1,cleared:Array.from({length:27},(_,i)=>i),runIndex:26,tutorialDone:true}),values=new Map([['gravity-duel-campaign-v0110',old]]);
 const p=new Profile(()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}));assert.equal(p.data.cleared.length,27);
 for(const i of [6,16,29])assert.ok(!p.data.cleared.includes(i));assert.equal(p.data.runIndex,6);p.clearArena(6);
 assert.equal(values.get('gravity-duel-campaign-v0110'),old);assert.ok(values.has(SAVE_KEY));
});
test('right-stick release fires once; returning to center and canceling never fire',()=>{
 const t=new TouchState(true);t.beginAim(1,1,0);assert.equal(t.control().fire,false);t.release(1);assert.equal(t.control().fire,true);t.consumeFire();assert.equal(t.control().fire,false);
 t.beginAim(1,1,0);t.moveAim(1,0,0);t.release(1);assert.equal(t.control().fire,false);
 t.beginAim(1,1,0);t.clear();t.release(1);assert.equal(t.control().fire,false);
});
