import Phaser from 'phaser';
import { OnlineClient } from '../net/OnlineClient.js';
import { onlineMap, applySnapshot, type Snapshot } from '../game/OnlineRuntime.js';
import * as C from '../config.js';
import { SpaceAI } from '../ai/SpaceAI.js';
import { difficultyFor } from '../ai/Difficulty.js';
import { SquadCoordinator } from '../ai/SquadCoordinator.js';
import { RivalSelector } from '../ai/RivalSelector.js';
import { RivalPressure } from '../ai/RivalPressure.js';
import { TrajectoryPlanner } from '../ai/TrajectoryPlanner.js';
import { createProjectile } from '../entities/Bullet.js';
import { bodyPosition } from '../entities/CelestialBody.js';
import { POWERUP_COLORS, POWERUP_NAMES, POWERUP_HELP } from '../entities/PowerUp.js';
import { IDLE_CONTROL, type ShipControl } from '../entities/Ship.js';
import { ARCADE, nextArena } from '../game/Arcade.js';
import { earnedBadges } from '../game/Rewards.js';
import { OpeningFireGate } from '../game/OpeningFireGate.js';
import { Match, type GameMode } from '../game/Match.js';
import { getMap } from '../maps/maps.js';
import { FixedClock } from '../physics/FixedClock.js';
import { getShipAcceleration, simulateTrajectory } from '../physics/gravity.js';
import { traceLaser } from '../physics/laser.js';
import { device, isCrazyGames, pause, platform, profile, seenMechanics, sound } from '../platform/runtime.js';
import { drawBackground, drawShip, drawTrajectory, label, playerColor } from '../rendering/draw.js';
import { drawCelestial, drawOrbit, drawPickup, drawWormhole } from '../rendering/space.js';
import { GameEffects } from '../rendering/GameEffects.js';
import { orbitalAlpha, projectileIndicator } from '../rendering/projectileFeedback.js';
import { GameHUD } from '../ui/GameHUD.js';
import { bindMenuKeys } from '../ui/menu.js';
import { TouchControls } from '../ui/TouchControls.js';
import { pilotInput } from '../input/PilotInput.js';
type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ENTER', Phaser.Input.Keyboard.Key>;
export class GameScene extends Phaser.Scene {
  private online?: OnlineClient; private localId = 1; private netInputIn=0; private netSeen?: Snapshot; private netStatus?: Phaser.GameObjects.Text;
  private mode: GameMode = '1p'; private mapId = 'classic-orbit'; private arcadeIndex: number | null = null;
  private match!: Match; private ai!: SpaceAI; private planner?: TrajectoryPlanner; private clock = new FixedClock(); private keys!: Keys; private touch?: TouchControls;
  private debug = C.DEBUG; private visualTime = 0; private previewIn = 0; private pulseIn = 0; private acted = false; private transitioning = false;
  private generation = 0; private onboarding = false; private savedResult = false; private wasJammed = false;
  private ais: SpaceAI[] = []; private fireGates: OpeningFireGate[] = []; private squad?: SquadCoordinator;
  private rivalSelectors: RivalSelector[] = [];
  private rivalPressure = new RivalPressure();
  private pendingFire: [boolean, boolean] = [false, false];
  private mouseFire = false; private mouseAim?: {x:number; y:number}; private modern = false;
  private bodies!: Phaser.GameObjects.Graphics; private previews!: Phaser.GameObjects.Graphics;
  private actors!: Phaser.GameObjects.Graphics; private debugGraphics?: Phaser.GameObjects.Graphics;
  private shipLabels: Phaser.GameObjects.Text[] = []; private orbitLabels: Phaser.GameObjects.Text[] = []; private guide!: Phaser.GameObjects.Text;
  private neutronLabels: { id: string; text: Phaser.GameObjects.Text }[] = [];
  private effects!: GameEffects; private hud!: GameHUD;
  constructor() { super('Game'); }
  init(data: { mode?: GameMode; mapId?: string; arcadeIndex?: number; online?: OnlineClient }): void {
    this.online=data.online;this.localId=data.online?.id??1;this.netSeen=undefined;this.netInputIn=0;
    this.mode = data.mode === '2p' && !device.touch ? '2p' : '1p';
    this.arcadeIndex = this.mode === '1p' && Number.isInteger(data.arcadeIndex) ? Math.max(0, Math.min(ARCADE.length - 1, data.arcadeIndex!)) : null;
    this.mapId = this.arcadeIndex === null ? data.mapId ?? 'classic-orbit' : ARCADE[this.arcadeIndex].mapId;
  }
  create(): void {
    this.modern = !!this.online || this.mode === '1p' && (device.touch || profile.data.controls === 'modern'); this.mouseFire = false; this.mouseAim = undefined;
    this.generation++; this.transitioning = false; this.savedResult = false; this.wasJammed = false;
    if (this.arcadeIndex !== null) profile.begin(this.arcadeIndex);
    const map = this.online?.room ? onlineMap(this.online.room.mapId,this.online.room.mode) : getMap(this.mapId);
    const playable = !this.online && device.touch && map.player1Spawn.x < 300 && map.player1Spawn.y > 480 ?
      { ...map, player1Spawn: { ...map.player1Spawn, x: 235, y: 400 } } : map;
    const levelIndex = this.arcadeIndex ?? map.campaignIndex;
    this.match = new Match(this.mode === '2p' ? { ...playable, extraEnemySpawns: [] } : playable, this.online ? 3 : levelIndex === undefined ? C.FIRST_TO_SCORE : ARCADE[levelIndex].targetScore);
    this.planner = !this.online && this.mode === '1p' ? new TrajectoryPlanner() : undefined;
    const difficulty = map.campaignIndex === undefined ? undefined : difficultyFor(map.campaignIndex);
    this.ais = this.match.ships.slice(1).map(() => new SpaceAI(Math.random, this.planner?.request, difficulty));
    this.fireGates = this.ais.map(() => new OpeningFireGate(this.mode === '1p' ? this.arcadeIndex : null, difficulty));
    this.ai = this.ais[0]; this.ais.forEach(ai => ai.reset());
    this.squad = !this.online && this.mode === '1p' && this.ais.length > 1 && !this.match.freeForAll && !this.match.boss ? new SquadCoordinator(map.campaignIndex ?? 8) : undefined;
    this.rivalSelectors = this.ais.map(() => new RivalSelector()); this.rivalPressure.reset();
    this.clock.reset();
    this.debug = C.DEBUG; this.visualTime = 0; this.previewIn = 0; this.pulseIn = 0; this.acted = false;
    pause.set('manual', false); platform.setGameplay(false);
    this.onboarding = !seenMechanics.has(this.mapId); seenMechanics.add(this.mapId);
    drawBackground(this);
    this.bodies = this.add.graphics().setDepth(0); this.previews = this.add.graphics().setDepth(1);
    this.actors = this.add.graphics().setDepth(2);
    this.neutronLabels = map.bodies.filter(body => body.type === 'pulsar').map(body => ({ id: body.id,
      text: label(this, 0, 0, 'NEUTRON STAR', 22, '#abf2ff').setOrigin(0.5).setDepth(3).setBackgroundColor('#071726bb').setPadding(5, 2) }));
    if (import.meta.env.DEV) this.debugGraphics = this.add.graphics().setDepth(6);
    this.guide = label(this, 640, 132, this.match.map.hint, 19, '#a5e5df').setOrigin(0.5).setDepth(12)
      .setBackgroundColor('#0b1825cc').setPadding(12, 8);
    this.effects = new GameEffects(this);
    this.hud = new GameHUD(this, this.mode, this.match, this.arcadeIndex, {
      pause: () => this.togglePause(), resume: () => this.resume(), restart: () => this.restartArena(), menu: () => this.goMenu(),
      next: () => { void this.nextArena(); }, again: () => { void this.returnToGame(() => this.scene.restart({ mode: '1p', arcadeIndex: 0 })); },
    }, this.online);
    if(this.online)this.netStatus=label(this,640,103,'ONLINE',18,'#70e9d4').setOrigin(.5).setDepth(20);
    this.shipLabels = this.match.ships.map(ship => label(this, ship.x, ship.y + 33, '', 22, '#' + playerColor(ship.id).toString(16)).setOrigin(0.5).setDepth(3));
    this.orbitLabels = this.match.ships.map(({id}) => label(this, 0, 0, id > 1 && this.mode === '1p' ? 'AI ORBIT' : 'P' + id + ' ORBIT', 14, '#b6ff74')
      .setOrigin(0.5).setDepth(6).setBackgroundColor('#0b1825dd').setPadding(4, 3).setVisible(false));
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,UP,DOWN,LEFT,RIGHT,ENTER') as Keys;
    this.touch = device.touch ? new TouchControls(this,this.modern) : undefined;
    const aim = (pointer:Phaser.Input.Pointer) => { const p = this.cameras.main.getWorldPoint(pointer.x,pointer.y); if (this.modern && !device.touch && p.y > 100 && p.y < 680) this.mouseAim = {x:p.x,y:p.y}; };
    const down = (pointer:Phaser.Input.Pointer, objects:Phaser.GameObjects.GameObject[]) => {
      const p = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
      if (!pause.paused && !this.transitioning && this.modern && !device.touch && objects.length === 0 && p.y > 100 && p.y < 680 && pointer.leftButtonDown()) { aim(pointer); this.mouseFire = true; this.pendingFire[0] = true; }
    };
    const up = () => { this.mouseFire = false; };
    this.input.on('pointermove',aim); this.input.on('pointerdown',down); this.input.on('pointerup',up); this.input.on('pointerupoutside',up); this.input.on('gameout',up);
    if (import.meta.env.DEV) this.input.keyboard!.addCapture('F2');
    bindMenuKeys(this, key => {
      if (pause.has('ad')) return;
      if (key === 'Escape' || key === 'KeyP') this.togglePause();
      else if (key === 'KeyR') this.restartArena();
      else if (import.meta.env.DEV && key === 'F2') this.debug = !this.debug;
      else if ((key === 'Enter' || key === 'Space') && (pause.paused || this.match.phase === 'matchOver')) this.hud.activatePrimary();
      else if (this.match.phase === 'playing' && !pause.paused) {
        if (key === 'Space') this.pendingFire[0] = true;
        if (key === 'Enter' && this.mode === '2p') this.pendingFire[1] = true;
      }
    });
    const focus = () => { if (!pause.has('ad')) this.game.canvas.focus({ preventScroll: true }); };
    this.input.on('pointerdown', focus);
    const onPause = () => {
      this.mouseFire = false;
      this.ais.forEach(ai => ai.reset()); this.planner?.cancel(); this.fireGates.forEach(gate => gate.reset()); this.squad?.reset();
      this.rivalSelectors.forEach(selector => selector.reset()); this.rivalPressure.reset();
      this.clock.reset(); this.input.keyboard?.resetKeys(); this.touch?.state.clear(); this.pendingFire = [false, false]; this.previewIn = 0;
      if (this.input.keyboard) this.input.keyboard.enabled = !pause.has('ad');
    };
    const unsubscribe = pause.subscribe(onPause); onPause();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove',aim);this.input.off('pointerdown',down);this.input.off('pointerup',up);this.input.off('pointerupoutside',up);this.input.off('gameout',up);
      this.online?.close();this.generation++; unsubscribe(); this.planner?.destroy(); this.input.off('pointerdown', focus);
      this.input.keyboard?.resetKeys(); if (this.input.keyboard) this.input.keyboard.enabled = true;
      this.touch?.state.clear(); this.effects.clear(); this.clock.reset(); platform.setGameplay(false); sound.stopAll(); pause.set('manual', false);
    });
    this.hud.update(this.match, this.debug, 60);
  }
  private restartArena(): void {
    if(this.online){this.online.send({type:'rematch'});return;}
    if (this.transitioning || pause.has('ad')) return;
    void this.returnToGame(() => this.scene.restart(this.arcadeIndex === null ? { mode: this.mode, mapId: this.mapId } : { mode: '1p', arcadeIndex: this.arcadeIndex }));
  }
  private goMenu(): void { if (!this.transitioning && !pause.has('ad')) this.scene.start('Menu'); }
  private togglePause(): void {
    if (this.transitioning || pause.has('ad') || this.match.phase === 'matchOver') return;
    if (pause.has('manual')) this.resume(); else pause.set('manual', true); sound.unlock();
  }
  private resume(): void { void this.returnToGame(() => { pause.set('manual', false); sound.unlock(); }); }
  private async returnToGame(action: () => void): Promise<void> {
    if (this.transitioning || pause.has('ad')) return;
    this.transitioning = true; platform.setGameplay(false); pause.set('manual', true);
    const generation = this.generation; await platform.commercialBreak();
    if (generation !== this.generation || !this.scene.isActive()) return;
    this.transitioning = false; pause.set('manual', false); action();
  }
  private async nextArena(): Promise<void> {
    if (this.transitioning || this.arcadeIndex === null || nextArena(this.arcadeIndex) === null || this.match.winner !== 1) return;
    const index = this.arcadeIndex + 1;
    await this.returnToGame(() => this.scene.restart({ mode: '1p', arcadeIndex: index }));
  }
  private humanControl(player: 1 | 2): ShipControl {
    const k = this.keys, touch = this.touch?.state.control() ?? IDLE_CONTROL;
    if (player === 1 && this.modern) {
      if (device.touch) return {...touch,independentAim:true,fire:touch.fire||this.pendingFire[0]};
      const ship = this.match.ships[this.localId-1], a = this.mouseAim ? Math.atan2(this.mouseAim.y-ship.y,this.mouseAim.x-ship.x) : undefined;
      return pilotInput(Number(k.D.isDown)-Number(k.A.isDown),Number(k.S.isDown)-Number(k.W.isDown),a,this.mouseFire||k.SPACE.isDown||this.pendingFire[0]);
    }
    return player === 1 ?
      { ...touch, turn: Math.max(-1, Math.min(1, Number(k.D.isDown) - Number(k.A.isDown) + touch.turn)),
        thrust: Math.max(-1, Math.min(1, Number(k.W.isDown) - Number(k.S.isDown) + touch.thrust)), fire: k.SPACE.isDown || touch.fire || this.pendingFire[0] } :
      { turn: Number(k.RIGHT.isDown) - Number(k.LEFT.isDown), thrust: Number(k.UP.isDown) - Number(k.DOWN.isDown), fire: k.ENTER.isDown || this.pendingFire[1] };
  }
  update(_time: number, delta: number): void {
    if(this.online){this.updateOnline(delta);return;}
    if (!pause.paused && !this.transitioning) this.clock.advance(delta / 1000, () => {
      this.visualTime += C.PHYSICS_DT; this.hud.tick(C.PHYSICS_DT);
      const first = this.humanControl(1), humanSecond = this.mode === '2p' ? this.humanControl(2) : IDLE_CONTROL;
      const playing = this.match.phase === 'playing';
      this.pendingFire = [false, false]; this.touch?.state.consumeFire();
      if (playing && [first, humanSecond].some(c => c.turn || c.thrust || c.fire || c.move)) this.acted = true;
      if (playing && this.acted) this.squad?.update(C.PHYSICS_DT, this.match.ships.slice(1), this.match.ships[0], this.match.map.bodies, this.match.time, this.match.pickups);
      if (playing && this.acted && this.match.freeForAll) this.rivalPressure.update(C.PHYSICS_DT, this.match.ships, this.match.bullets);
      const enemyControls = this.mode === '2p' ? [humanSecond] : this.ais.map((ai, i) => {
        const ship = this.match.ships[i + 1];
        if (!playing || !this.acted || !ship.alive || this.match.boss) return IDLE_CONTROL;
        const target = this.match.freeForAll ? this.rivalSelectors[i].select(C.PHYSICS_DT, ship, this.match.ships, this.match.map.bodies, this.match.time, this.rivalPressure) : this.match.ships[0];
        if (!target) return IDLE_CONTROL;
        const control = ai.update(C.PHYSICS_DT, ship, target, this.match.map.bodies,
          { time: this.match.time, wormholes: this.match.map.wormholes, shipGravity: this.match.map.shipGravity }, this.match.pickups, this.match.bullets, this.match.freeForAll ? [] : this.match.ships.slice(1), this.squad?.orders.get(ship.id));
        return control;
      });
      if (this.mode === '1p' && playing && this.acted) {
        const ready = this.match.ships.slice(1).map(ship => ship.alive && ship.cooldown <= 1e-9 && !ship.laserCharge &&
          this.match.bullets.filter(b => b.ownerId === ship.id).length < C.MAX_BULLETS_PER_SHIP);
        if (this.squad) this.squad.coordinateFire(C.PHYSICS_DT, this.match.ships.slice(1), enemyControls, this.fireGates, ready, this.match.time);
        else enemyControls.forEach((control, i) => { control.fire = this.fireGates[i].step(C.PHYSICS_DT, control.fire, Boolean(ready[i])); });
      }
      if (!playing || this.acted) this.match.step([first, ...enemyControls]);
      if (!this.savedResult && this.match.phase === 'matchOver') {
        this.savedResult = true;
        if (this.arcadeIndex !== null && this.match.winner === 1) profile.clearArena(this.arcadeIndex);
        this.hud.setRewards(profile.awardBadges(earnedBadges(this.match, this.mode)));
        sound.play(this.mode === '2p' || this.match.winner === 1 ? 'victory' : 'defeat');
      }
      const jammed = this.match.ships[0].jammedFor > 0;
      if (jammed && !this.wasJammed) { sound.play('jam'); this.effects.flash(this.match.ships[0], 0x99ecff); }
      else if (!jammed && this.wasJammed && this.match.phase === 'playing') this.hud.announce('SIGNAL RESTORED', '#99ecff');
      this.wasJammed = jammed;
      this.processEvents(); this.effects.update(C.PHYSICS_DT, this.match.ships, playing);
      this.pulseIn -= C.PHYSICS_DT;
      if (this.pulseIn <= 0 && this.match.bullets.some(b => b.orbitState)) { sound.play('orbitPulse'); this.pulseIn = 1.4; }
    });
    if (pause.paused) this.clock.reset();
    platform.setGameplay((isCrazyGames || this.acted) && this.match.phase === 'playing' && !this.transitioning);
    this.touch?.update(!pause.paused && !this.transitioning && (this.match.phase === 'ready' || this.match.phase === 'playing'));
    this.touch?.setReload(this.match.ships[0].cooldown / C.FIRE_COOLDOWN);
    this.previewIn -= Math.min(delta / 1000, 0.1);
    this.drawWorld(); this.effects.draw(); this.drawDebug(); this.hud.update(this.match, this.debug, this.game.loop.actualFps);
  }
  private updateOnline(delta:number):void {
    const client=this.online!, dt=Math.min(.1,delta/1000);this.visualTime+=dt;this.hud.tick(dt);this.netInputIn-=dt;
    if(this.netInputIn<=0){this.netInputIn=1/30;client.input(pause.paused||!client.healthy?{...IDLE_CONTROL,independentAim:true}:this.humanControl(1));this.pendingFire=[false,false];this.touch?.state.consumeFire();}
    client.tick(dt);
    const state=client.snapshot;
    if(state&&state!==this.netSeen){this.netSeen=state;this.processEvents(state.events);}
    const rendered=client.renderState();if(rendered)applySnapshot(this.match,rendered);
    this.netStatus?.setText(client.healthy&&!client.waiting?client.transport+' · P'+this.localId+' · '+client.latency+' ms':client.status);
    this.effects.update(dt,this.match.ships,this.match.phase==='playing');this.previewIn-=dt;
    this.touch?.update(!pause.paused&&client.healthy&&this.match.phase==='playing');this.touch?.setReload(this.match.ships[this.localId-1].cooldown/C.FIRE_COOLDOWN);
    platform.setGameplay(client.healthy&&this.match.phase==='playing'&&!pause.paused);
    this.drawWorld();this.effects.draw();this.hud.update(this.match,false,this.game.loop.actualFps);
  }
  private processEvents(events=this.match.drainEvents()): void {
    for (const event of events) {
      if (event.type === 'shot') {
        if (event.owner > 1) this.squad?.recordShot(event.owner, this.match.time);
        sound.play(event.kind === 'homing' ? 'missileFire' : event.kind === 'orbital' ? 'orbitalFire' : 'shot'); this.effects.flash(event.position, playerColor(event.owner));
      } else if (event.type === 'impact') {
        sound.play('impact'); this.effects.burst(event.position, 0xf4c476, event.kind === 'homing' ? 18 : 6);
      } else if (event.type === 'orbitalEnd') {
        const p = projectileIndicator(event.position) ?? event.position;
        const body = event.bodyId ? this.match.map.bodies.find(b => b.id === event.bodyId) : undefined;
        const reason = event.reason === 'collision' ? (body?.type === 'blackHole' ? 'ABSORBED' : body ? 'HIT ' + body.type.toUpperCase() : 'HIT')
          : event.reason === 'expired' ? 'EXPIRED' : event.reason === 'replaced' ? 'REPLACED' : 'LEFT ARENA';
        if (event.reason === 'collision') { sound.play('impact'); this.effects.flash(p, 0xb6ff74, true); }
        else this.effects.flash(p, 0xb6ff74);
        this.effects.notice(p, this.hud.name(event.owner) + ' ORBIT · ' + reason, '#b6ff74');
      }
      else if (event.type === 'death') {
        if (event.highlight) {
          this.hud.announce((event.owner ? this.hud.name(event.owner) : 'HIT') + ' · ' + event.highlight.replace('PORTAL', 'WORMHOLE'));
          if (!this.match.draw && this.match.phase !== 'matchOver' && (this.mode === '2p' || event.owner === 1)) sound.play('celebrate');
        }
        if (this.match.draw && event.victim === 1) sound.play('draw');
        sound.play('death'); this.effects.flash(event.position, playerColor(event.victim), true);
        if (!device.touch) this.cameras.main.shake(120, 0.002, false);
      } else if (event.type === 'respawn') { this.ais.forEach(ai => ai.reset()); this.fireGates.forEach(gate => gate.reset()); this.squad?.reset(); this.rivalSelectors.forEach(selector => selector.reset()); this.rivalPressure.reset(); this.effects.clear(); this.touch?.state.clear(); this.mouseFire=false; this.pendingFire=[false,false]; }
      else if (event.type === 'laser') { if (event.owner > 1) this.squad?.recordShot(event.owner, this.match.time); sound.play('laserFire'); this.effects.burst(event.position, 0xffcf70, 12); }
      else if (event.type === 'mechanic') {
        if (event.sound === 'laserCharge' && event.owner && event.owner > 1) this.squad?.reserveShot(event.owner, this.match.time);
        sound.play(event.sound);
        if (event.pickupType) this.hud.announce((this.online && event.owner ? this.hud.name(event.owner)+' · ' : event.owner === 1 ? (this.mode === '1p' ? '' : 'P1 · ') : this.mode === '1p' ? 'AI · ' : 'P2 · ') +
          POWERUP_NAMES[event.pickupType] + (event.pickupType === 'shield' ? ' ACTIVE' : ' READY'), '#' + POWERUP_COLORS[event.pickupType].toString(16));
        if (event.pickupType && event.owner === 1) this.hud.announce(POWERUP_HELP[event.pickupType], '#' + POWERUP_COLORS[event.pickupType].toString(16));
        this.effects.flash(event.position, event.sound === 'orbitLock' ? 0xb6ff74 : event.sound === 'shieldBreak' ? 0x75d9ff : 0xc0a1ff, event.sound === 'shieldBreak');
      }
      this.previewIn = 0;
    }
  }
  private drawWorld(): void {
    const t = this.match.time, g = this.actors.clear();
    if (this.match.boss) {
      const boss = this.match.boss, ship = this.match.ships[1];
      if (ship.alive) {
        const color = boss.phase === 'recover' ? 0x69f4df : 0xffb96e;
        g.lineStyle(3, color, 0.8).strokeCircle(ship.x, ship.y, 43);
        for (let i = 0; i < ship.maxHP; i++) g.fillStyle(i < ship.hp ? color : 0x354454).fillRect(ship.x - ship.maxHP * 9 + i * 18, ship.y - 60, 13, 7);
        if (boss.phase === 'warning') for (let i = 0; i < (boss.laser ? 1 : boss.rays); i++) {
          const a = boss.angle + i * Math.PI * 2 / boss.rays;
          g.lineStyle(boss.laser ? 3 : 1.5, 0xffb96e, 0.35).lineBetween(ship.x + Math.cos(a) * 46, ship.y + Math.sin(a) * 46, ship.x + Math.cos(a) * 260, ship.y + Math.sin(a) * 260);
        }
      }
    }
    for (const ship of this.match.ships) if (ship.alive && ship.invulnerableFor > 0) g.lineStyle(2, 0xc4edff, 0.5).strokeCircle(ship.x, ship.y, ship.radius + 9);
    this.guide.setVisible(this.onboarding && this.match.time < C.ONBOARDING_TIME && !pause.paused);
    this.bodies.clear();
    for (const body of this.match.map.bodies) drawOrbit(this.bodies, body, t);
    for (const body of this.match.map.bodies) drawCelestial(this.bodies, body, t);
    for (const entry of this.neutronLabels) {
      const body = this.match.map.bodies.find(b => b.id === entry.id)!, p = bodyPosition(body, t);
      entry.text.setPosition(p.x, p.y - body.radius - 27).setVisible(!pause.paused);
    }
    for (const gate of this.match.map.wormholes ?? []) drawWormhole(this.bodies, gate, t);
    for (const pickup of this.match.pickups) drawPickup(g, pickup, t);
    if (this.previewIn <= 0) {
      this.previewIn = 1 / (device.touch ? 20 : 30); this.previews.clear();
      if (this.match.phase === 'ready' || this.match.phase === 'playing') for (const ship of this.match.ships) {
        if (!ship.alive || ship.aimAssistFor <= 0 || (this.mode === '1p' && ship.id !== this.localId)) continue;
        if (ship.specialShot === 'laser' || ship.laserCharge) {
          const beam = traceLaser(ship, this.match.map.bodies, this.match.ships, t, ship.laserCharge?.angle);
          this.previews.lineStyle(1, 0xffcf70, 0.3).lineBetween(beam.start.x, beam.start.y, beam.end.x, beam.end.y);
        } else {
          const trajectory = simulateTrajectory(createProjectile(ship, ship.angle, ship.specialShot ?? 'normal', t), this.match.map.bodies, this.match.ships,
            C.TRAJECTORY_PREVIEW_TIME, device.touch ? 9 : C.PREDICTION_SAMPLE_STEPS, { time: t, wormholes: this.match.map.wormholes, maxOrbitArc: C.ORBIT_PREVIEW_ARC });
          drawTrajectory(this.previews, trajectory.points, ship.id);
        }
      }
    }
    for (const beam of this.match.laserBeams) {
      const alpha = Math.max(0, 1 - beam.age / 0.18);
      g.lineStyle(12, 0xffcf70, alpha * 0.22).lineBetween(beam.start.x, beam.start.y, beam.end.x, beam.end.y);
      g.lineStyle(3, 0xfff7d7, alpha).lineBetween(beam.start.x, beam.start.y, beam.end.x, beam.end.y);
    }
    this.orbitLabels.forEach(text => text.setVisible(false));
    const lockedTargets = new Set<number>();
    for (const bullet of this.match.bullets) {
      const color = bullet.kind === 'orbital' ? POWERUP_COLORS.orbital : bullet.kind === 'heavy' ? POWERUP_COLORS.heavy : bullet.kind === 'homing' ? POWERUP_COLORS.homing : playerColor(bullet.ownerId);
      const alpha = bullet.kind === 'orbital' ? orbitalAlpha(bullet.age) : 1;
      bullet.trail.forEach((p, i) => { if (!device.touch || i % 2 === 0) g.fillStyle(color, i / bullet.trail.length * (bullet.kind === 'homing' ? 0.65 : 0.35) * alpha).fillCircle(p.x, p.y, bullet.kind === 'orbital' ? 3 : 2.5); });
      g.fillStyle(color, 0.23 * alpha).fillCircle(bullet.x, bullet.y, bullet.kind === 'orbital' ? 13 : 10);
      g.fillStyle(color, alpha).fillCircle(bullet.x, bullet.y, Math.max(4.5,bullet.radius));
      g.fillStyle(0xffffff, alpha).fillCircle(bullet.x, bullet.y, 2);
      if (bullet.kind === 'orbital' && bullet.orbitState) {
        const edge = projectileIndicator(bullet);
        if (edge) {
          g.save().translateCanvas(edge.x, edge.y).rotateCanvas(edge.angle);
          g.fillStyle(color, alpha).fillTriangle(10, 0, -6, -6, -6, 6);
          g.lineStyle(2, playerColor(bullet.ownerId), alpha).strokeCircle(-11, 0, 4); g.restore();
          this.orbitLabels[bullet.ownerId - 1].setPosition(Math.max(90, Math.min(1190, edge.x - 42 * Math.cos(edge.angle))),
            Math.max(142, Math.min(628, edge.y - 30 * Math.sin(edge.angle)))).setAlpha(alpha).setVisible(true);
        }
      }
      if (bullet.kind === 'homing') {
        const a = Math.atan2(bullet.vy, bullet.vx), guided = bullet.homingTargetId !== undefined;
        if (guided) lockedTargets.add(bullet.homingTargetId!);
        g.save().translateCanvas(bullet.x, bullet.y).rotateCanvas(a);
        g.fillStyle(0xffe6c7).fillTriangle(11, 0, -6, -5, -6, 5);
        const flame = guided ? 22 + Math.sin(t * 45) * 5 : 10;
        g.fillStyle(color, guided ? 0.95 : 0.35).fillTriangle(-6, -3, -flame, 0, -6, 3); g.restore();
      }
    }
    this.match.ships.forEach((ship, i) => {
      this.shipLabels[i].setText(ship.jammedFor > 0 ? 'JAMMED' : this.online ? this.hud.name(ship.id)+(this.match.map.teams&&ship.id!==this.localId&&this.match.team(ship.id as 1|2|3|4)===this.match.team(this.localId as 1|2|3|4)?' · ALLY':'') : this.mode === '1p' ? ship.id===1?'YOU':this.squad?.orders.get(ship.id)?.role ?? this.hud.name(ship.id) : 'P' + ship.id)
        .setPosition(ship.x, Math.min(C.ARENA_BOUNDS.bottom-8, ship.y + 42)).setVisible(ship.alive && !pause.paused);
      if (!ship.alive) return;
      if (lockedTargets.has(ship.id)) {
        const r = 34 + Math.sin(t * 8) * 2;
        g.lineStyle(2, POWERUP_COLORS.homing, 0.9);
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = ship.x + sx * r, y = ship.y + sy * r;
          g.lineBetween(x, y, x - sx * 11, y).lineBetween(x, y, x, y - sy * 11);
        }
        if (ship.jammedFor <= 0) this.shipLabels[i].setText(this.hud.name(ship.id) + ' · LOCKED')
          .setPosition(ship.x, Math.min(C.ARENA_BOUNDS.bottom + 12, ship.y + 49));
      }
      if (ship.id > 1 && this.mode === '1p' && this.fireGates[ship.id - 2]?.warning && this.match.phase === 'playing') {
        g.lineStyle(2, 0xffcf70, 0.65 + Math.sin(this.visualTime * 18) * 0.25).strokeCircle(ship.x, ship.y, 31);
        if (ship.jammedFor <= 0 && !lockedTargets.has(ship.id)) this.shipLabels[i].setText((this.squad?.orders.get(ship.id)?.role ?? this.hud.name(ship.id)) + ' · AIMING');
      }
      if(this.match.boss&&ship.id===2){
        const color=this.match.boss.phase==='recover'?0x69f4df:0xffb96e;g.save().translateCanvas(ship.x,ship.y).rotateCanvas(this.match.boss.angle);
        for(let j=0;j<this.match.boss.rays;j++){g.save().rotateCanvas(j*Math.PI*2/this.match.boss.rays);g.fillStyle(0x183246).lineStyle(1.5,color,.85).fillRoundedRect(15,-8,28,16,3).strokeRoundedRect(15,-8,28,16,3);g.fillStyle(color).fillRect(35,-5,8,10);g.restore();}
        g.fillStyle(0x102636).lineStyle(2,color).fillCircle(0,0,28).strokeCircle(0,0,28).fillStyle(color,.2).fillCircle(0,0,21).fillStyle(color).fillCircle(0,0,11+Math.sin(t*5)*2);g.restore();
      }else if (ship.jammedFor <= 0 || Math.floor(this.visualTime * 24) % 4 !== 0) drawShip(g, ship, this.visualTime, ship.id === 1 ? profile.paintColor : undefined);
      if (this.match.boss && ship.id === 2) { this.shipLabels[i].setText(this.match.boss.phase === 'recover' ? 'CORE EXPOSED' : this.match.boss.laser ? 'LASER WARNING' : 'VOLLEY WARNING'); }
      if (ship.shield) g.lineStyle(2.5, 0x75d9ff, 0.8).strokeCircle(ship.x, ship.y, 29).fillStyle(0x75d9ff, 0.07).fillCircle(ship.x, ship.y, 29);
      if (ship.laserCharge) {
        const progress = 1 - ship.laserCharge.remaining / C.LASER_CHARGE_TIME;
        g.fillStyle(0xffcf70, 0.15 + progress * 0.4).fillCircle(ship.x + Math.cos(ship.laserCharge.angle) * 24, ship.y + Math.sin(ship.laserCharge.angle) * 24, 5 + progress * 9);
      }
      if (ship.jammedFor > 0) for (let n = 0; n < 3; n++) {
        const a = this.visualTime * 17 + n * 2;
        g.fillStyle(0x99ecff, 0.6).fillRect(ship.x + Math.cos(a) * 26, ship.y + Math.sin(a) * 26, 4, 2);
      }
    });
    if (this.modern && !device.touch && this.mouseAim && !pause.paused && this.match.phase === 'playing') {
      const s=this.match.ships[0];
      if(s.alive)g.lineStyle(3,0x69f4df,.75).beginPath().arc(s.x,s.y,35,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-s.cooldown/C.FIRE_COOLDOWN)).strokePath();
    }
  }
  private drawDebug(): void {
    if (import.meta.env.DEV) {
    const g = this.debugGraphics!.clear(); if (!this.debug) return;
    const t = this.match.time; g.lineStyle(1, 0xffff77, 0.6);
    for (const body of this.match.map.bodies) {
      const p = bodyPosition(body, t); g.strokeCircle(p.x, p.y, body.collisionRadius);
      if (body.orbitCaptureRadius) g.lineStyle(1, 0xb6ff74, 0.5).strokeCircle(p.x, p.y, body.orbitCaptureRadius);
      if (body.motion) { const future = bodyPosition(body, t + 1); g.strokeCircle(future.x, future.y, body.radius); }
    }
    for (const p of this.match.map.powerUpSpawnPoints ?? []) g.lineStyle(1, 0xe6a5ff, 0.5).strokeCircle(p.x, p.y, C.POWERUP_RADIUS);
    for (const ship of this.match.ships) {
      const force = getShipAcceleration(ship, this.match.map.bodies, t, this.match.map.shipGravity);
      g.lineStyle(2, 0xff9b72, 0.8).lineBetween(ship.x, ship.y, ship.x + force.x * 0.25, ship.y + force.y * 0.25);
    }
    for (const bullet of this.match.bullets) if (bullet.orbitState) {
      const body = this.match.map.bodies.find(b => b.id === bullet.orbitState!.bodyId)!;
      const p = bodyPosition(body, t);
      const o = bullet.orbitState;
      g.save().translateCanvas(p.x, p.y).rotateCanvas(-o.argumentOfPeriapsis)
        .lineStyle(1, 0xb6ff74, 0.4).strokeEllipse(-o.semiMajorAxis * o.eccentricity, 0,
          2 * o.semiMajorAxis, 2 * o.semiMajorAxis * Math.sqrt(1 - o.eccentricity ** 2)).restore();
    }
    if (this.ai.solution) {
      const points = this.ai.solution.trajectory.points;
      for (let i = 1; i < points.length; i++) if (!points[i].breakBefore)
        g.lineStyle(1, 0xc0a1ff, 0.45).lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
    }
  }
}
