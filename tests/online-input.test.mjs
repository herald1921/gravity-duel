import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedInput} from '../.test-build/net/input.js';
test('peer controls reject non-finite values and forged fire flags',()=>{const c=boundedInput({turn:Infinity,thrust:999,fire:'yes',move:{x:NaN,y:-50},aim:Infinity,independentAim:true});assert.deepEqual(c,{turn:0,thrust:1,fire:false,move:{x:0,y:-1},aim:undefined,independentAim:true});});
test('release fire and independent aim survive the input boundary',()=>{const c=boundedInput({turn:0,thrust:0,fire:true,aim:1.2,move:{x:.5,y:0},independentAim:true});assert.equal(c.fire,true);assert.equal(c.aim,1.2);assert.equal(c.move.x,.5);});
