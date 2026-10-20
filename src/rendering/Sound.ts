import { Music } from './Music.js';
type ResultSound = 'victory' | 'defeat' | 'draw';
export type SoundName = ResultSound | 'shot' | 'impact' | 'death' | 'pickup' | 'shieldActivate' | 'shieldBreak' | 'laserCharge' | 'laserFire' | 'teleport' | 'orbitalFire' | 'orbitLock' | 'orbitPulse' | 'click' | 'missileFire' | 'celebrate' | 'jam';
const tones: Record<Exclude<SoundName, ResultSound>, [number, number, number, OscillatorType]> = {
  shot: [680, 115, 0.16, 'triangle'], impact: [165, 45, 0.12, 'triangle'], death: [90, 22, 0.4, 'sawtooth'],
  jam: [170, 80, 0.3, 'square'],
  missileFire: [230, 900, 0.28, 'sawtooth'], celebrate: [660, 1320, 0.4, 'triangle'],
  pickup: [500, 950, 0.16, 'sine'], shieldActivate: [300, 800, 0.25, 'sine'], shieldBreak: [950, 90, 0.23, 'triangle'],
  laserCharge: [180, 1400, 0.38, 'sine'], laserFire: [2000, 120, 0.19, 'sawtooth'],
  teleport: [1100, 280, 0.18, 'sine'], orbitalFire: [350, 780, 0.22, 'triangle'],
  orbitLock: [660, 1320, 0.25, 'sine'], orbitPulse: [240, 320, 0.12, 'sine'], click: [550, 760, 0.07, 'sine'],
};
export class Sound {
  private blocked = false; private context?: AudioContext; private music?: Music;
  constructor(public enabled = true, public musicEnabled = true, private onChange: () => void = () => {}) {}
  private master?: GainNode; private voices = new Set<OscillatorNode>();
  unlock(): void {
    if (this.blocked || (!this.enabled && !this.musicEnabled)) return;
    try {
      if (!this.context) { this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = 0.10; this.master.connect(this.context.destination); }
      this.music ??= new Music(this.context);
      if (this.context.state !== 'running' && this.context.state !== 'closed') void this.context.resume().then(() => {
        if (!this.blocked && this.musicEnabled) this.music?.start();
      }).catch(() => {});
      else if (this.musicEnabled) this.music.start();
    } catch { /* Audio is optional on restricted browsers. */ }
  }
  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.stopAll(); else this.unlock(); this.onChange(); }
  setMusicEnabled(enabled: boolean): void { this.musicEnabled = enabled; if (!enabled) this.music?.stop(); else this.unlock(); this.onChange(); }
  setBlocked(blocked: boolean): void {
    this.blocked = blocked;
    if (blocked) { this.stopAll(); this.music?.stop(); void this.context?.suspend().catch(() => {}); }
    else if (this.context) this.unlock();
  }
  play(name: SoundName): void {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running' || !this.enabled || this.blocked || this.voices.size >= 20) return;
    if (name === 'victory' || name === 'defeat' || name === 'draw') {
      const notes = name === 'victory' ? [523.25, 659.25, 783.99, 1046.5] : name === 'defeat' ? [392, 329.63, 261.63] : [392, 392];
      notes.forEach((frequency, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime + i * 0.14;
        osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(name === 'defeat' ? 0.22 : 0.32, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain); gain.connect(this.master!); this.voices.add(osc);
        osc.onended = () => { this.voices.delete(osc); osc.disconnect(); gain.disconnect(); };
        osc.start(t); osc.stop(t + 0.36);
      });
      return;
    }
    const [from, to, length, wave] = tones[name], osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime;
    osc.type = wave; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(name === 'orbitPulse' ? 0.12 : 0.4, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain); gain.connect(this.master); this.voices.add(osc);
    osc.onended = () => { this.voices.delete(osc); osc.disconnect(); gain.disconnect(); };
    osc.start(t); osc.stop(t + length + 0.01);
  }
  stopAll(): void { for (const voice of this.voices) { try { voice.stop(); } catch { /* already stopped */ } } this.voices.clear(); }
  destroy(): void { this.stopAll(); this.music?.destroy(); void this.context?.close().catch(() => {}); }
}
