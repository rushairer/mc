/**
 * Sound system using Web Audio API.
 * Generates simple sounds procedurally (no external files needed).
 */

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.masterGain);

    this.initialized = true;
  }

  private ensureCtx(): AudioContext | null {
    if (!this.initialized) this.init();
    return this.ctx;
  }

  playBlockBreak() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    // Short noise burst
    const duration = 0.15;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800 + Math.random() * 400;
    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  playBlockPlace() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 200 + Math.random() * 100;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playHurt() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playMobHurt() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 150 + Math.random() * 100;
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  playMobDeath() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  playExplosion() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const duration = 0.5;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.8;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  playLightning() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const duration = 0.8;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2) * 0.6;
      // Add crackle
      if (Math.random() < 0.01) data[i] += (Math.random() - 0.5) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;
    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  playStep() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const duration = 0.05;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3)) * 0.1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
