import test from 'node:test';
import assert from 'node:assert/strict';
import { CrazyGamesLifecycle } from '../.test-build/platform/CrazyGames.js';
import { PauseState } from '../.test-build/platform/Lifecycle.js';
import { Profile, SAVE_KEY } from '../.test-build/platform/Profile.js';

function fixture(overrides = {}) {
 const events=[],values=new Map(),listeners=new Set();
 const sdk={init:async()=>{},environment:'crazygames',
  data:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
  game:{settings:{muteAudio:false},gameplayStart:()=>events.push('start'),gameplayStop:()=>events.push('stop'),
   addSettingsChangeListener:l=>listeners.add(l),removeSettingsChangeListener:l=>listeners.delete(l)},...overrides};
 return {sdk,events,values,listeners};
}

test('loading completes once when the menu is ready, separately from starting gameplay',async()=>{
 const f=fixture(),loading=[];f.sdk.game.loadingStart=()=>loading.push('loading');f.sdk.game.loadingStop=()=>loading.push('ready');
 const life=new CrazyGamesLifecycle(new PauseState());await life.attach(f.sdk);life.markGameReady();life.markGameReady();
 assert.deepEqual(loading,['loading','ready']);assert.deepEqual(f.events,[]);life.destroy();
});
test('CrazyGames reports playable state once, ignores focus changes, respects real pause and menus',async()=>{
 const {sdk,events}=fixture(),pause=new PauseState(),life=new CrazyGamesLifecycle(pause);
 life.markGameReady();life.setGameplay(true);assert.equal(await life.attach(sdk),true);
 life.setGameplay(true);pause.set('blur',true);pause.set('hidden',true);assert.deepEqual(events,['start']);
 pause.set('manual',true);assert.deepEqual(events,['start','stop']);
 pause.set('hidden',false);pause.set('manual',false);assert.deepEqual(events,['start','stop','start']);
 pause.set('orientation',true);pause.set('orientation',false);life.setGameplay(false);
 assert.deepEqual(events,['start','stop','start','stop','start','stop']);life.destroy();
});
test('Basic Launch never requests ads or freezes input at a break',async()=>{
 const f=fixture();f.sdk.ad={requestAd:()=>assert.fail('Basic Launch requested an ad')};
 const pause=new PauseState(),life=new CrazyGamesLifecycle(pause);await life.attach(f.sdk);
 await life.commercialBreak();assert.equal(pause.paused,false);life.destroy();
});
test('platform mute changes and listener cleanup are independent of player preferences',async()=>{
 const f=fixture(),muted=[];f.sdk.game.settings.muteAudio=true;
 const life=new CrazyGamesLifecycle(new PauseState(),v=>muted.push(v));await life.attach(f.sdk);
 for(const l of f.listeners)l({muteAudio:false});assert.deepEqual(muted,[true,false]);
 life.destroy();assert.equal(f.listeners.size,0);
});
test('failed, disabled or late SDK cannot attach or overwrite current session',async()=>{
 for(const init of [()=>Promise.reject(Error('offline')),()=>new Promise(r=>setTimeout(r,30))]){
  const f=fixture({init}),life=new CrazyGamesLifecycle(new PauseState());
  assert.equal(await life.attach(f.sdk,5),false);await new Promise(r=>setTimeout(r,40));
  assert.equal(life.storage,undefined);life.destroy();
 }
 const f=fixture({environment:'disabled'}),life=new CrazyGamesLifecycle(new PauseState());
 assert.equal(await life.attach(f.sdk),false);life.destroy();
});
test('destroyed lifecycle cannot be resurrected by delayed initialization',async()=>{
 let finish;const f=fixture({init:()=>new Promise(r=>finish=r)}),life=new CrazyGamesLifecycle(new PauseState());
 const attaching=life.attach(f.sdk);life.destroy();finish();assert.equal(await attaching,false);assert.equal(f.listeners.size,0);
});
test('platform save replaces local progress before play, without copying old saves into cloud',()=>{
 const local=fixture(),cloud=fixture(),profile=new Profile(()=>local.sdk.data);profile.begin(7);
 const saved=new Profile(()=>cloud.sdk.data);saved.begin(2);saved.setAudio(false,true);saved.finishTutorial();
 const before=cloud.values.get(SAVE_KEY);profile.useStorage(()=>cloud.sdk.data);
 assert.equal(profile.data.runIndex,2);assert.equal(profile.data.music,false);assert.equal(cloud.values.get(SAVE_KEY),before);
 profile.clearArena(2);assert.equal(JSON.parse(cloud.values.get(SAVE_KEY)).runIndex,3);
 assert.equal(JSON.parse(local.values.get(SAVE_KEY)).runIndex,7);
});
test('failed cloud read never writes fresh defaults over the remote save',()=>{
 let writes=0;const profile=new Profile(()=>fixture().sdk.data);
 profile.useStorage(()=>({getItem(){throw Error('unavailable')},setItem(){writes++}}));
 profile.begin(0);profile.finishTutorial();assert.equal(writes,0);assert.equal(profile.persistent,false);
});
