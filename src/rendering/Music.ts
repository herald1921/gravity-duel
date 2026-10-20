// User-approved high-octave 135136 theme. Two full C / Am phrases at 96 BPM.
const TRACK_URL = new URL('../../assets/audio/135136-loop.mp3', import.meta.url).href;
export class Music {
  private output: GainNode; private source?: AudioBufferSourceNode; private buffer?: AudioBuffer;
  private pending?: Promise<void>; private wanted = false; private disposed = false;
  private offset = 0; private startedAt = 0; private retryAt = 0;
  private request?: AbortController;
  private voices = new Set<AudioBufferSourceNode>();
  constructor(private ctx: AudioContext, private url = TRACK_URL) {
    this.output = ctx.createGain(); this.output.gain.value = 0; this.output.connect(ctx.destination);
  }
  start(): void {
    if (this.disposed) return;
    this.wanted = true;
    if (this.buffer) { this.play(); return; }
    if (this.pending || this.ctx.currentTime < this.retryAt) return;
    this.request = new AbortController();
    this.pending = (async () => {
      const response = await fetch(this.url, { signal: this.request!.signal });
      if (!response.ok) throw new Error('Music unavailable');
      const decoded = await this.ctx.decodeAudioData(await response.arrayBuffer());
      if (this.disposed) return;
      this.buffer = decoded; this.play();
    })().catch(() => { this.retryAt = this.ctx.currentTime + 2; /* Gameplay and SFX remain available. */ })
      .finally(() => { this.pending = undefined; this.request = undefined; });
  }
  private play(): void {
    if (!this.wanted || this.disposed || this.source || !this.buffer || this.ctx.state !== 'running') return;
    const source = this.ctx.createBufferSource(); source.buffer = this.buffer; source.loop = true;
    source.connect(this.output); this.source = source; this.voices.add(source);
    this.startedAt = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(this.startedAt);
    this.output.gain.setValueAtTime(0, this.startedAt);
    this.output.gain.linearRampToValueAtTime(0.08, this.startedAt + 0.15);
    source.onended = () => { source.disconnect(); this.voices.delete(source); if (this.source === source) this.source = undefined; };
    source.start(this.startedAt, this.offset);
  }
  stop(): void {
    this.wanted = false;
    if (this.source) {
      if (this.buffer) this.offset = (this.offset + Math.max(0, this.ctx.currentTime - this.startedAt)) % this.buffer.duration;
      const source = this.source; this.source = undefined;
      try { source.stop(); } catch { /* Already stopped. */ }
      source.disconnect(); this.voices.delete(source);
    }
    this.output.gain.cancelScheduledValues(this.ctx.currentTime);
    this.output.gain.setValueAtTime(0, this.ctx.currentTime);
  }
  destroy(): void { this.disposed = true; this.stop(); this.request?.abort(); this.buffer = undefined; this.output.disconnect(); }
}
