import {writeFile} from 'node:fs/promises';
const report={};
for(const [name,root] of Object.entries({old:'./baseline-v0127/build',current:'../.test-build'})){
 const {BossEncounter}=await import(`${root}/game/BossEncounter.js`),{Match}=await import(`${root}/game/Match.js`),{CAMPAIGN_MAPS}=await import(`${root}/maps/campaign.js`),{createProjectile}=await import(`${root}/entities/Bullet.js`),{stepProjectile}=await import(`${root}/physics/gravity.js`);
 let hits=0, cases=0;const details=[];
 for(const index of [6,16,29])for(const targetY of [200,300,450,550]){
  const m=new Match(CAMPAIGN_MAPS[index]),b=new BossEncounter(m.map.boss),s=m.ships[1],t=m.ships[0];t.y=targetY;b.remaining=1;b.step(.01,s,t,m.map,0);
  let hit=false;
  for(const a of b.shotAngles??Array.from({length:b.rays},(_,i)=>b.angle+i*2*Math.PI/b.rays)){
   const p=createProjectile(s,a,'normal',b.remaining);p.x=s.x+Math.cos(a)*44;p.y=s.y+Math.sin(a)*44;
   for(let i=0;i<600;i++){const e=stepProjectile(p,m.map.bodies,[t],{wormholes:m.map.wormholes});if(e){hit ||= e.type==='ship';break;}}
  }
  cases++;hits+=hit?1:0;details.push({map:m.map.id,targetY,hit});
 }
 report[name]={cases,hits,details};
}
await writeFile(new URL('./v0130-boss-terrain.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
