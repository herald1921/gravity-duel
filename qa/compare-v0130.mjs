import {writeFile} from 'node:fs/promises';
const roots={old:'./baseline-v0127/build',current:'../.test-build'};
const report={};
for(const [name,root] of Object.entries(roots)){
 const {findAimSolution}=await import(`${root}/ai/SpaceAI.js`);
 const {Ship}=await import(`${root}/entities/Ship.js`);
 const {createBody}=await import(`${root}/entities/CelestialBody.js`);
 const {BossEncounter}=await import(`${root}/game/BossEncounter.js`);
 const {createProjectile}=await import(`${root}/entities/Bullet.js`);
 const {stepProjectile}=await import(`${root}/physics/gravity.js`);
 let aimMs=0,aimHits=0;
 for(let i=0;i<24;i++){
  const self=new Ship(2,{x:1000,y:180+i*15,angle:Math.PI}),target=new Ship(1,{x:250,y:200+i*13,angle:0});
  const bodies=i%2?[createBody('planet','planet',640,380,{radius:60})]:[];
  const begin=performance.now(),a=findAimSolution(self,target,bodies);aimMs+=performance.now()-begin;aimHits+=a.trajectory.event?.type==='ship'&&a.trajectory.event.shipId===1?1:0;
 }
 const misses=[];
 for(const vy of [-60,-30,30,60])for(const unit of [0,1,2]){
  const self=new Ship(2,{x:950,y:340,angle:Math.PI}),target=new Ship(1,{x:400,y:350,angle:0});self.radius=34;target.vy=vy;
  const boss=new BossEncounter(unit),map={bodies:[],wormholes:[],shipGravity:'none'};
  boss.remaining=1;boss.step(.01,self,target,map,0);
  const angles=boss.shotAngles??Array.from({length:boss.rays},(_,i)=>boss.angle+i*2*Math.PI/boss.rays);
  let miss=Infinity;
  for(const angle of angles){
   const shot=createProjectile(self,angle);shot.x=self.x+Math.cos(angle)*44;shot.y=self.y+Math.sin(angle)*44;
   for(let i=0;i<300;i++){
    const t=boss.remaining+i/120;
    miss=Math.min(miss,Math.hypot(shot.x-target.x,shot.y-(target.y+target.vy*t)));
    if(stepProjectile(shot,[],[]))break;
   }
  }
  misses.push(miss);
 }
 report[name]={aimCases:24,aimHits,aimMs:Math.round(aimMs),bossCases:misses.length,bossMeanMiss:misses.reduce((a,b)=>a+b)/misses.length,bossHitsWithinShipRadius:misses.filter(x=>x<22).length,bossMisses:misses};
}
await writeFile(new URL('./v0130-comparison.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
