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

  playPickup() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // A quick pop/click with rising frequency
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playXP() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(600 + Math.random() * 120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100 + Math.random() * 180, ctx.currentTime + 0.12);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
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

  playStep(blockId: number = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    let freq = 600;
    let filterType: BiquadFilterType = 'lowpass';
    let volume = 0.08;

    // Map block types
    if (blockId === 1 || blockId === 4 || blockId === 10 || blockId === 11 || blockId === 12 || blockId === 22 || blockId === 23 || blockId === 25 || blockId === 35) {
      // stone / cobblestone / ores / iron/gold/diamond blocks / furnace / obsidian
      freq = 800;
      volume = 0.12;
    } else if (blockId === 5 || blockId === 6 || blockId === 20 || blockId === 24) {
      // wood / log / bookshelf / crafting table
      freq = 350;
      volume = 0.08;
    } else if (blockId === 8 || blockId === 9) {
      // sand / gravel
      freq = 500;
      filterType = 'bandpass';
      volume = 0.08;
    } else if (blockId === 27 || blockId === 28) {
      // snow / ice
      freq = 700;
      volume = 0.06;
    }

    const duration = 0.06;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3)) * volume;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  playEat() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const duration = 0.08;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2)) * 0.15;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500 + Math.random() * 300;
    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  playBurp() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;

    osc.connect(filter).connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  playLever() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.setValueAtTime(150, ctx.currentTime + 0.03);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playPistonExtend() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const duration = 0.15;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25)) * 0.15;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    source.connect(filter).connect(this.sfxGain!);
    source.start();

    // Add click at start
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  playPistonRetract() {
    this.playPistonExtend(); // Simplified: same sound but slightly lower pitch or duration
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
