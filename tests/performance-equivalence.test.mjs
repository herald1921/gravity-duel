import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentCircleContact, getGravityAcceleration } from '../.test-build/physics/gravity.js';
import { bodyPosition, withEphemeris } from '../.test-build/entities/CelestialBody.js';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import * as C from '../.test-build/config.js';
let seed=1321;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
test('collision broad phase preserves analytic results for 20000 swept contacts',()=>{
 const reference=(s,e,c,p)=>{const dx=e.x-s.x,dy=e.y-s.y,fx=s.x-c.x,fy=s.y-c.y,cc=fx*fx+fy*fy-(c.radius+p)**2;if(cc<=0)return 0;const a=dx*dx+dy*dy;if(!a)return null;const b=2*(fx*dx+fy*dy),d=b*b-4*a*cc;if(d<0)return null;const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;};
 for(let i=0;i<20000;i++){const s={x:random()*1300,y:random()*700},e={x:s.x+(random()-.5)*800,y:s.y+(random()-.5)*800},c={x:random()*1300,y:random()*700,radius:random()*120},p=random()*34;assert.equal(segmentCircleContact(s,e,c,p),reference(s,e,c,p));}
});
test('scoped ephemeris cache is exact for hierarchical systems and cannot preserve stale positions',()=>{
 for(const map of CAMPAIGN_MAPS)for(const body of map.bodies){const times=[0,.1,1.234,9.5,37.7],expected=times.map(t=>bodyPosition(body,t));withEphemeris(()=>{for(let repeat=0;repeat<3;repeat++)times.forEach((t,i)=>assert.deepEqual(bodyPosition(body,t),expected[i]));});}
 const b={x:1,y:2,motion:{radius:4,period:5,phase:0}};assert.equal(withEphemeris(()=>bodyPosition(b,0)).x,5);b.x=10;assert.equal(withEphemeris(()=>bodyPosition(b,0)).x,14);
});
test('gravity square-root optimization preserves the softened Newtonian force',()=>{
 for(const map of CAMPAIGN_MAPS)for(let i=0;i<30;i++){
 const point={x:random()*1280,y:random()*720},time=random()*40;let x=0,y=0;
 for(const b of map.bodies){const c=bodyPosition(b,time),dx=c.x-point.x,dy=c.y-point.y,scale=b.gravityStrength/(dx*dx+dy*dy+Math.max(C.MIN_SOFTENING,b.softening)**2)**1.5;x+=dx*scale;y+=dy*scale;}
 const n=Math.hypot(x,y);if(n>C.MAX_GRAVITY_ACCELERATION){x*=C.MAX_GRAVITY_ACCELERATION/n;y*=C.MAX_GRAVITY_ACCELERATION/n;}
 const actual=getGravityAcceleration(point,map.bodies,time);assert.ok(Math.abs(actual.x-x)<1e-9);assert.ok(Math.abs(actual.y-y)<1e-9);
 }
});
