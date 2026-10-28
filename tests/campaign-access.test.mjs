import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignUnlocked,campaignEntry } from '../.test-build/game/CampaignAccess.js';
test('new campaigns expose only level one and reject direct requests for later arenas',()=>{
 assert.equal(campaignUnlocked(0,[]),true);
 for(let i=1;i<30;i++){assert.equal(campaignUnlocked(i,[]),false);assert.equal(campaignEntry(i,[]),0);}
 for(const i of [-1,30,NaN,Infinity,.5])assert.equal(campaignEntry(i,[]),0);
});
test('clearing each level unlocks exactly the next one, including unit and boss boundaries',()=>{
 for(let n=1;n<=30;n++){
  const cleared=Array.from({length:n},(_,i)=>i);
  for(let i=0;i<30;i++)assert.equal(campaignUnlocked(i,cleared),i<=n);
  assert.equal(campaignEntry(29,cleared),Math.min(n,29));
 }
});
