import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../.test-build/game/Match.js';
import { earnedBadges, defeatTip } from '../.test-build/game/Rewards.js';
import { OpeningFireGate } from '../.test-build/game/OpeningFireGate.js';
import { Profile, SAVE_KEY } from '../.test-build/platform/Profile.js';
import { MAPS } from '../.test-build/maps/maps.js';
const store = () => {const v=new Map();return {getItem:k=>v.get(k)??null,setItem:(k,x)=>v.set(k,x)}};
test('legacy progress migrates without inventing badges or changing audio',()=>{
 const s=store();s.setItem(SAVE_KEY,JSON.stringify({version:1,runIndex:5,cleared:[1,4],tutorialDone:true,music:false,sfx:true}));
 const p=new Profile(()=>s);assert.equal(p.data.runIndex,5);assert.deepEqual(p.data.badges,[]);assert.equal(p.data.paint,'teal');assert.equal(p.data.music,false);
});
test('badges persist once and only unlocked paint can be equipped',()=>{
 const s=store(),p=new Profile(()=>s);assert.equal(p.equipPaint('ice'),false);
 assert.deepEqual(p.awardBadges(['slingshot','slingshot','portal']),['slingshot','portal']);
 assert.deepEqual(p.awardBadges(['portal']),[]);assert.equal(p.equipPaint('violet'),true);
 const q=new Profile(()=>s);assert.equal(q.data.paint,'violet');assert.deepEqual(q.data.badges,['slingshot','portal']);
 s.setItem(SAVE_KEY,JSON.stringify({version:1,badges:['fake','slingshot','slingshot'],paint:'ice'}));
 const r=new Profile(()=>s);assert.deepEqual(r.data.badges,['slingshot']);assert.equal(r.data.paint,'teal');
});
test('storage denial retains earned badges and paint for this visit',()=>{
 const p=new Profile(()=>{throw Error('denied')});p.awardBadges(['orbit']);assert.equal(p.equipPaint('amber'),true);assert.equal(p.data.paint,'amber');assert.equal(p.persistent,false);
});
test('clean sweep requires a finished AI win and no deaths including double KOs',()=>{
 const m=new Match(MAPS[0],1);assert.deepEqual(earnedBadges(m,'1p'),[]);
 m.resolveDeaths([{victim:2,cause:'shot'}]);assert.deepEqual(earnedBadges(m,'1p'),['clean-sweep']);assert.deepEqual(earnedBadges(m,'2p'),[]);
 m.rematch();m.resolveDeaths([{victim:1,cause:'shot'},{victim:2,cause:'shot'}]);
 assert.equal(m.scores[2],0);assert.equal(m.deathCounts[1],1);
 m.resolveDeaths([{victim:2,cause:'shot'}]);assert.deepEqual(earnedBadges(m,'1p'),[]);
});
test('trick badges belong to the scoring pilot; double KOs and self hits excluded',()=>{
 const m=new Match(MAPS[0],2);
 m.resolveDeaths([{victim:1,cause:'shot',highlight:'ORBITAL HIT'}]);
 m.resolveDeaths([{victim:1,cause:'shot'},{victim:2,cause:'shot',highlight:'PORTAL SHOT'}]);
 m.resolveDeaths([{victim:2,cause:'self',highlight:'PORTAL SHOT'}]);
 m.resolveDeaths([{victim:2,cause:'shot',highlight:'SLINGSHOT'}]);
 assert.deepEqual(earnedBadges(m,'1p'),['slingshot']);assert.equal(m.scoringHighlights[2].has('ORBITAL HIT'),true);
 m.rematch();assert.equal(m.scoringHighlights[1].size,0);assert.equal(m.deathCounts[1],0);
});
test('scored trick badge is retained on a lost match and advice follows death cause',()=>{
 const m=new Match(MAPS[0],2);m.resolveDeaths([{victim:2,cause:'shot',highlight:'PORTAL SHOT'}]);
 m.resolveDeaths([{victim:1,cause:'shot'}]);m.resolveDeaths([{victim:1,cause:'shot'}]);assert.equal(m.winner,2);assert.deepEqual(earnedBadges(m,'1p'),['portal']);
 assert.match(defeatTip(m),/move/);m.lastDeath={victim:1,cause:'self'};assert.match(defeatTip(m),/return/);
});
test('early AI grace period and visible warning still allow shots; reset restarts grace',()=>{
 const gate=new OpeningFireGate(0);for(let i=0;i<319;i++)assert.equal(gate.step(.01,true,true),false);
 let warned=false,shot=false;for(let i=0;i<70;i++){shot=gate.step(.01,true,true);warned ||= gate.warning;if(shot)break;}
 assert.ok(warned);assert.ok(shot);assert.equal(gate.warning,false);
 gate.reset();assert.equal(gate.step(.1,true,true),false);assert.equal(gate.warning,false);
 assert.equal(new OpeningFireGate(4).step(.01,true,true),true);
});
test('opening warning never forces a shot from an unready or misaligned enemy',()=>{
 const gate=new OpeningFireGate(0);gate.step(3.3,true,true);assert.equal(gate.step(.1,false,true),false);assert.equal(gate.step(.1,true,false),false);assert.equal(gate.warning,false);
});
