import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchState } from '../.test-build/input/TouchState.js';
import { SpaceAI, findAimSolution } from '../.test-build/ai/SpaceAI.js';
import { Ship } from '../.test-build/entities/Ship.js';
import { MAPS } from '../.test-build/maps/maps.js';
import { PHYSICS_DT } from '../.test-build/config.js';
test('a touch fire tap between physics ticks is consumed exactly once', () => {
  const state = new TouchState(); state.press(1, 'fire'); state.release(1);
  assert.equal(state.control().fire, true); state.consumeFire(); assert.equal(state.control().fire, false);
  state.press(2, 'fire'); state.consumeFire(); assert.equal(state.control().fire, true);
  state.clear(); assert.equal(state.control().fire, false);
});
test('asynchronous AI ignores reset and changed-weapon results before accepting a fresh plan', () => {
  const requests=[], ai=new SpaceAI(()=>0.5,(request,done)=>requests.push({request,done}));
  const map=MAPS[0], self=new Ship(2,map.player2Spawn), target=new Ship(1,map.player1Spawn);
  ai.update(PHYSICS_DT,self,target,map.bodies); assert.equal(requests.length,1); assert.equal(ai.solution,null);
  const original=findAimSolution(self,target,map.bodies); ai.reset(); requests[0].done(original); assert.equal(ai.solution,null);
  ai.update(PHYSICS_DT,self,target,map.bodies);self.specialShot='laser';requests[1].done(original);assert.equal(ai.solution,null);
  ai.update(PHYSICS_DT,self,target,map.bodies);assert.equal(requests[2].request.weapon,'laser');
  const laser=findAimSolution(self,target,map.bodies,{},'laser');requests[2].done(laser);assert.equal(ai.solution,laser);
});
