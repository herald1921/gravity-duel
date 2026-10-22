import { readFileSync } from 'node:fs';
import { CAMPAIGN_MAPS } from '../.test-build/maps/campaign.js';
import { Match } from '../.test-build/game/Match.js';
import { SpaceAI } from '../.test-build/ai/SpaceAI.js';
import { SquadCoordinator } from '../.test-build/ai/SquadCoordinator.js';
import { OpeningFireGate } from '../.test-build/game/OpeningFireGate.js';
import { difficultyFor } from '../.test-build/ai/Difficulty.js';
import { PHYSICS_DT as dt, MAX_BULLETS_PER_SHIP } from '../.test-build/config.js';
const maps = process.argv.includes('--current') ? CAMPAIGN_MAPS.filter(m=>m.extraEnemySpawns.length && m.combat!=='freeForAll') : JSON.parse(readFileSync(new URL('./pressure-baseline-maps.json',import.meta.url)));
for (const map of maps) {
  const match = new Match(map, 99), team = match.ships.slice(1), player = match.ships[0], d = difficultyFor(map.campaignIndex);
  let seed=127; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const ais=team.map(()=>new SpaceAI(random,undefined,d)), gates=team.map(()=>new OpeningFireGate(null,d)), squad=new SquadCoordinator(map.campaignIndex);
  const stats={}; match.phase='playing';
  for(let frame=0; frame<60/dt; frame++) {
    squad.update(dt,team,player,map.bodies,match.time,match.pickups);
    const controls=team.map((s,i)=>ais[i].update(dt,s,player,map.bodies,{time:match.time,wormholes:map.wormholes},match.pickups,match.bullets,team,squad.orders.get(s.id)));
    const ready=team.map(s=>s.alive&&s.cooldown<=1e-9&&!s.laserCharge&&match.bullets.filter(b=>b.ownerId===s.id).length<MAX_BULLETS_PER_SHIP);
    if(squad.coordinateFire) squad.coordinateFire(dt,team,controls,gates,ready,match.time);
    else {const shooter=squad.selectShooter(team.filter((s,i)=>controls[i].fire&&ready[i]).map(s=>s.id),match.time); controls.forEach((c,i)=>{c.fire=gates[i].step(dt,c.fire&&shooter===team[i].id,ready[i]);});}
    const roles=team.map(s=>squad.orders.get(s.id)?.role??'SOLO');
    team.forEach((s,i)=>{if(!s.alive||match.phase!=='playing')return; const stat=stats[roles[i]]??={seconds:0,shots:0,poorSolution:0}; stat.seconds+=dt; if((ais[i].solution?.distance??Infinity)>=75)stat.poorSolution+=dt;});
    // Keep the player moving along the open outer left lane; shields prolong observation without changing aim.
    player.shield=true;
    match.step([{turn:0,thrust:0,fire:false,independentAim:true,move:{x:(150-player.x)/100,y:Math.sin(frame*dt/3)>0?0.65:-0.65}},...controls]);
    for(const e of match.drainEvents()) {
      if((e.type==='shot'||e.type==='laser')&&e.owner>1){const role=roles[e.owner-2];if(stats[role])stats[role].shots++;squad.recordShot(e.owner,match.time);}
      if(e.type==='mechanic'&&e.sound==='laserCharge'&&e.owner>1)squad.reserveShot(e.owner,match.time);
      if(e.type==='respawn'){squad.reset();ais.forEach(a=>a.reset());gates.forEach(g=>g.reset());}
    }
  }
  console.log(JSON.stringify({map:map.id,stats:Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([a,b])=>[a,Math.round(b*10)/10]))]))}));
}
