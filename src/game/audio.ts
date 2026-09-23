// 効果音を WebAudio で合成する。音声ファイルは使わない。
// AudioContext はユーザー操作の後（unlock）に作る。使えない環境では何もしない。

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private disabled = false;

  // キー・タッチのハンドラから呼ぶ。自動再生の制限を解くため。
  unlock(): void {
    if (this.disabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext;
        if (!AC) {
          this.disabled = true;
          return;
        }
        const ctx = new AC();
        const master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 0.6);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.master = master;
        this.noise = buf;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      this.disabled = true;
      this.ctx = null;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // 音が鳴らないだけにする
    }
  }

  private burst(dur: number, vol: number, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || ctx.state !== 'running') return;
    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch {
      // 音が鳴らないだけにする
    }
  }

  shoot(): void {
    this.tone('square', 880, 220, 0.12, 0.25);
  }

  enemyShoot(): void {
    this.tone('triangle', 300, 120, 0.15, 0.15);
  }

  explode(): void {
    this.burst(0.3, 0.6, 3000);
    this.tone('sawtooth', 200, 40, 0.25, 0.15);
  }

  shieldHit(): void {
    this.burst(0.08, 0.25, 1500);
  }

  playerHit(): void {
    this.burst(0.8, 0.9, 1800);
    this.tone('sawtooth', 400, 30, 0.8, 0.3);
  }

  ufo(): void {
    this.tone('sine', 600, 1400, 0.4, 0.25);
    this.burst(0.4, 0.5, 4000);
  }

  wave(): void {
    this.tone('square', 440, 880, 0.2, 0.2);
  }
}
