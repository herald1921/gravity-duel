import { Match } from './Match.js';
import { CAMPAIGN_MAPS } from '../maps/campaign.js';
import { IDLE_CONTROL, type PlayerId, type ShipControl } from '../entities/Ship.js';
import { SpaceAI, findAimSolution } from '../ai/SpaceAI.js';
import { difficultyFor } from '../ai/Difficulty.js';
import { RivalSelector } from '../ai/RivalSelector.js';
import { OpeningFireGate } from './OpeningFireGate.js';
import { SquadCoordinator } from '../ai/SquadCoordinator.js';
import type { AimPlanner } from '../ai/TrajectoryPlanner.js';
import { PHYSICS_DT } from '../config.js';
export type OnlineMode = 'ffa' | 'teams';
export function onlineMap(id: string, mode: OnlineMode) {
  const original = CAMPAIGN_MAPS.find(m => m.id === id && m.boss === undefined) ?? CAMPAIGN_MAPS[4];
  return { ...original, boss: undefined, campaignIndex: undefined, combat: mode === 'ffa' ? 'freeForAll' as const : 'squad' as const,
    scoreMode: mode === 'ffa' ? 'kills' as const : undefined, teams: mode === 'teams' ? [1,1,2,2] : undefined,
    player1Spawn: { x: 170, y: 555, angle: -.35 }, player2Spawn: { x: 170, y: 185, angle: .35 },
    extraEnemySpawns: [{ x: 1100, y: 185, angle: 2.8 }, { x: 1100, y: 555, angle: -2.8 }],
    hint: mode === 'ffa' ? 'FOUR-WAY KILL RACE · FIRST TO 4 · 90 SECONDS' : 'P1 + P2 vs P3 + P4 · FIRST TEAM TO 3 · FRIENDLY FIRE OFF' };
}
export class OnlineRuntime {
  readonly match: Match;
  readonly humans = new Set<PlayerId>();
  private controls = new Map<PlayerId, { input: ShipControl; age: number }>();
  private ais: SpaceAI[];
  private selectors = Array.from({length:4}, () => new RivalSelector());
  private gates = Array.from({length:4}, () => new OpeningFireGate(null, difficultyFor(14)));
  private squads = [new SquadCoordinator(14), new SquadCoordinator(14)];
  constructor(readonly mapId: string, readonly mode: OnlineMode, planner?: AimPlanner) {
    this.match = new Match(onlineMap(mapId, mode), 3);
    this.ais=Array.from({length:4},()=>new SpaceAI(Math.random,planner??((r,done)=>done(findAimSolution(r.self,r.target,r.bodies,r.context,r.weapon,36))),difficultyFor(14)));
  }
  input(id: PlayerId, value: ShipControl): void {
    const prior = this.controls.get(id);
    this.controls.set(id, {input: {...value, fire: value.fire || prior?.input.fire === true}, age: 0});
  }
  step(): void {
    const m = this.match;
    if (this.mode === 'teams') for (let i=0;i<2;i++) {
      const allies = m.ships.filter(s=>m.team(s.id)===i+1), target=m.ships.find(s=>s.alive&&m.team(s.id)!==i+1);
      if(target)this.squads[i].update(PHYSICS_DT,allies,target,m.map.bodies,m.time,m.pickups);
    }
    const controls = m.ships.map((ship,i) => {
      if (this.humans.has(ship.id)) {
        const entry = this.controls.get(ship.id);
        if(!entry || (entry.age += PHYSICS_DT)>.3)return {...IDLE_CONTROL,independentAim:true};
        const input={...entry.input};entry.input.fire=false;return input;
      }
      const target=this.selectors[i].select(PHYSICS_DT,ship,m.rivals(ship.id),m.map.bodies,m.time);
      if(!ship.alive||!target||m.phase!=='playing')return {...IDLE_CONTROL};
      const allies=m.ships.filter(s=>s.id!==ship.id&&m.team(s.id)===m.team(ship.id));
      const control=this.ais[i].update(PHYSICS_DT,ship,target,m.map.bodies,{time:m.time,wormholes:m.map.wormholes,shipGravity:m.map.shipGravity},m.pickups,m.bullets,allies,
        this.mode==='teams'?this.squads[m.team(ship.id)-1].orders.get(ship.id):undefined);
      control.fire=this.gates[i].step(PHYSICS_DT,control.fire,ship.cooldown<=1e-9&&!ship.laserCharge);return control;
    });
    m.step(controls);
  }
}
export function snapshot(m: Match) {
  return { ships:m.ships.map(ship=>({...ship})), bullets:m.bullets.map(b=>({...b,netId:b.ownerId+'-'+Math.round(((b.time??m.time)-b.age)*120),trail:[] as {x:number;y:number}[]})), pickups:m.pickups,
    laserBeams:m.laserBeams, scores:m.scores, phase:m.phase, phaseTime:m.phaseTime, time:m.time,
    continuation:m.continuation(), winner:m.winner, roundWinner:m.roundWinner, lastDeath:m.lastDeath, draw:m.draw, events:m.drainEvents() };
}
export type Snapshot = ReturnType<typeof snapshot>;
export function applySnapshot(m: Match, s: Snapshot): void {
  s.ships.forEach((ship,i)=>Object.assign(m.ships[i],ship));Object.assign(m.scores,s.scores);
  m.bullets=s.bullets;m.pickups=s.pickups;m.laserBeams=s.laserBeams;m.phase=s.phase;m.phaseTime=s.phaseTime;
  m.restoreContinuation(s.continuation);m.time=s.time;m.winner=s.winner;m.roundWinner=s.roundWinner;m.lastDeath=s.lastDeath;m.draw=s.draw;
}
