/** One host/guest link. Gameplay bypasses the broker once ICE connects. */
export class PeerLink {
  private pc: RTCPeerConnection;
  private control?: RTCDataChannel;
  private state?: RTCDataChannel;
  private ice: RTCIceCandidateInit[] = [];
  private closed = false;
  private offering = false;
  private retry?: ReturnType<typeof setInterval>;
  readonly createdAt = performance.now();
  constructor(offerer: boolean, private signal: (data: unknown) => void, receive: (data: unknown) => void) {
    this.pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
    const bind = (channel: RTCDataChannel) => {
      if (channel.label === 'state') this.state = channel; else this.control = channel;
      channel.onmessage = event => { try { receive(JSON.parse(event.data)); } catch { /* Invalid peer packet. */ } };
      channel.onerror = () => {}; // Timed fallback remains available if ICE/channel setup fails.
    };
    this.pc.ondatachannel = event => bind(event.channel);
    this.pc.onicecandidate = event => { if (event.candidate) signal({candidate: event.candidate.toJSON()}); };
    if (offerer) {
      bind(this.pc.createDataChannel('control'));
      bind(this.pc.createDataChannel('state', {ordered: false, maxRetransmits: 0}));
      void this.offer();
      this.retry = setInterval(() => { if (!this.direct && this.pc.signalingState === 'stable') void this.offer(true); }, 10000);
    }
  }
  get direct(): boolean { return this.control?.readyState === 'open' && this.state?.readyState === 'open'; }
  private async offer(restart = false): Promise<void> {
    if (this.closed || this.offering) return;
    this.offering = true;
    try { await this.pc.setLocalDescription(await this.pc.createOffer({iceRestart: restart})); if (!this.closed) this.signal({description: this.pc.localDescription}); } catch { /* Relay fallback. */ }
    finally { this.offering = false; }
  }
  async accept(data: {description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit}): Promise<void> {
    if (this.closed) return;
    try {
      if (data.description) {
        await this.pc.setRemoteDescription(data.description);
        for (const candidate of this.ice.splice(0)) await this.pc.addIceCandidate(candidate);
        if (data.description.type === 'offer') {
          await this.pc.setLocalDescription(await this.pc.createAnswer());
          if (!this.closed) this.signal({description: this.pc.localDescription});
        }
      } else if (data.candidate) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(data.candidate); else this.ice.push(data.candidate);
      }
    } catch { /* Failed negotiations use the bounded fallback; never crash gameplay. */ }
  }
  send(data: unknown, state = false): boolean {
    const channel = state ? this.state : this.control;
    if (!channel || channel.readyState !== 'open') return false;
    if (channel.bufferedAmount > 64000) return state; // Drop stale updates instead of accumulating latency.
    try { channel.send(JSON.stringify(data)); return true; } catch { return false; }
  }
  close(): void { this.closed = true; clearInterval(this.retry); this.pc.close(); }
}
