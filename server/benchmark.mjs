import { OnlineRuntime, snapshot } from '../.server-build/game/OnlineRuntime.js';
import { performance } from 'node:perf_hooks';
const count=Number(process.argv[2]||10),seconds=Number(process.argv[3]||8);
let seed=2413;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const maps=['unit-1-5','unit-1-6','unit-2-3','unit-2-6','unit-2-8','unit-2-9','unit-3-3','unit-3-9','unit-3-10','unit-3-12'];
const rooms=Array.from({length:count},(_,i)=>{const r=new OnlineRuntime(maps[i%maps.length],i%2?'teams':'ffa');r.humans.add(1);r.humans.add(2);r.match.phase='playing';return r;});
let bytes=0,snapshots=0,restarts=0,shots=0;const start=performance.now(),cpu=process.cpuUsage(),ticks=[];
for(let frame=0;frame<seconds*120;frame++){
 const tick=performance.now();for(const [i,r] of rooms.entries()){
  if(r.match.phase==='matchOver'){r.match.rematch();r.match.phase='playing';restarts++;}
  const m=r.match;
  for(const id of [1,2])r.input(id,{turn:0,thrust:0,fire:frame%90===0,independentAim:true,aim:Math.atan2(360-m.ships[id-1].y,640-m.ships[id-1].x)});
  r.step();if(frame%6===0){const s=snapshot(m);shots+=s.events.filter(e=>e.type==='shot'||e.type==='laser').length;bytes+=Buffer.byteLength(JSON.stringify(s,(_k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v));snapshots++;}
 }ticks.push(performance.now()-tick);
}
const consumed=process.cpuUsage(cpu),cpuSeconds=(consumed.user+consumed.system)/1e6;ticks.sort((a,b)=>a-b);
console.log(JSON.stringify({rooms:count,simulatedSeconds:seconds,wallSeconds:(performance.now()-start)/1000,cpuSeconds,estimatedCPUCores:cpuSeconds/seconds,freeCPUQuota:.1,quotaRatio:cpuSeconds/seconds/.1,tickP95ms:ticks[Math.floor(ticks.length*.95)],tickMaxMs:ticks.at(-1),meanSnapshotBytes:Math.round(bytes/snapshots),estimatedTotalGBPerHour:bytes/snapshots*20*count*2*3600/1e9,shots,restarts},null,2));
