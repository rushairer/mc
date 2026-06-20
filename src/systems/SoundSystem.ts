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
  private activeAmbientOsc: OscillatorNode | null = null;
  private activeAmbientGain: GainNode | null = null;
  private currentAmbientType = '';

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

  playBlockBreak(blockId: number = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    let duration = 0.15;
    let type: 'stone' | 'wood' | 'grass' | 'sand' = 'stone';
    let volume = 0.4;

    const baseId = blockId & 0x3FF;
    if (baseId === 2 || baseId === 18 || baseId === 161 || baseId === 175 || baseId === 106) {
      type = 'grass';
      duration = 0.12;
      volume = 0.3;
    } else if (baseId === 5 || baseId === 17 || baseId === 85 || baseId === 96 || baseId === 167) {
      type = 'wood';
      duration = 0.18;
      volume = 0.45;
    } else if (baseId === 12 || baseId === 13 || baseId === 3 || baseId === 82) {
      type = 'sand';
      duration = 0.15;
      volume = 0.35;
    }

    if (type === 'stone') {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15)) * volume;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 300;
      source.connect(filter).connect(this.sfxGain!);
      source.start();
    } else if (type === 'grass') {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2)) * volume;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000 + Math.random() * 500;
      source.connect(filter).connect(this.sfxGain!);
      source.start();
    } else if (type === 'wood') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150 + Math.random() * 50, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } else if (type === 'sand') {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1)) * volume;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300 + Math.random() * 150;
      source.connect(filter).connect(this.sfxGain!);
      source.start();
    }
  }

  playBlockPlace(blockId: number = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    let duration = 0.12;
    let type: 'stone' | 'wood' | 'grass' | 'sand' = 'stone';
    let volume = 0.3;

    const baseId = blockId & 0x3FF;
    if (baseId === 2 || baseId === 18 || baseId === 161 || baseId === 175 || baseId === 106) {
      type = 'grass';
      duration = 0.1;
      volume = 0.25;
    } else if (baseId === 5 || baseId === 17 || baseId === 85 || baseId === 96 || baseId === 167) {
      type = 'wood';
      duration = 0.15;
      volume = 0.35;
    } else if (baseId === 12 || baseId === 13 || baseId === 3 || baseId === 82) {
      type = 'sand';
      duration = 0.12;
      volume = 0.28;
    }

    if (type === 'stone') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120 + Math.random() * 40, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 250;

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } else if (type === 'grass') {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15)) * volume;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1600 + Math.random() * 400;
      source.connect(filter).connect(this.sfxGain!);
      source.start();
    } else if (type === 'wood') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(100 + Math.random() * 30, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } else if (type === 'sand') {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.08)) * volume;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220 + Math.random() * 80;
      source.connect(filter).connect(this.sfxGain!);
      source.start();
    }
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

  playDrink() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.12);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

    osc.connect(gain).connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
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

  updateAmbientSounds(biomeType: number, y: number, lightLevel: number) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    let ambientType = 'surface';
    if (y < 45 || lightLevel < 4) {
      ambientType = 'cave';
    } else if (biomeType === 5) { // Ocean
      ambientType = 'ocean';
    } else if (biomeType === 7 || biomeType === 3) { // Jungle or Forest
      ambientType = 'forest';
    } else if (biomeType === 1 || biomeType === 10) { // Desert or Badlands
      ambientType = 'desert';
    } else if (biomeType === 2 || biomeType === 4) { // Mountains or Snow
      ambientType = 'wind';
    }

    if (this.currentAmbientType === ambientType) return;
    this.currentAmbientType = ambientType;

    // Fade out previous ambient sound
    if (this.activeAmbientGain) {
      const prevGain = this.activeAmbientGain;
      const prevOsc = this.activeAmbientOsc;
      try {
        prevGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
        setTimeout(() => {
          try {
            if (prevOsc) prevOsc.stop();
            prevGain.disconnect();
          } catch (e) {}
        }, 2000);
      } catch (e) {}
    }

    // Start new ambient sound
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2.0);
    gain.connect(this.masterGain!);
    this.activeAmbientGain = gain;

    if (ambientType === 'cave') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55; // A1 drone
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 150;
      
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.2;
      lfoGain.gain.value = 10;
      
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start();
      
      osc.connect(filter).connect(gain);
      osc.start();
      this.activeAmbientOsc = osc;
    } else if (ambientType === 'ocean') {
      const duration = 4.0;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoGain.gain.value = 200;
      
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      
      source.connect(filter).connect(gain);
      source.start();
      this.activeAmbientOsc = source as any; // Store so we can stop it
    } else if (ambientType === 'forest') {
      const duration = 2.0;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      
      source.connect(filter).connect(gain);
      source.start();
      this.activeAmbientOsc = source as any;

      const playChirp = () => {
        if (this.currentAmbientType !== 'forest') return;
        try {
          const chirpOsc = ctx.createOscillator();
          const chirpGain = ctx.createGain();
          chirpOsc.type = 'sine';
          chirpOsc.frequency.setValueAtTime(1500 + Math.random() * 500, ctx.currentTime);
          chirpOsc.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.1);
          chirpOsc.frequency.setValueAtTime(3000, ctx.currentTime + 0.15);
          chirpOsc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.25);
          
          chirpGain.gain.setValueAtTime(0.005, ctx.currentTime);
          chirpGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          
          chirpOsc.connect(chirpGain).connect(this.masterGain!);
          chirpOsc.start();
          chirpOsc.stop(ctx.currentTime + 0.25);
        } catch (e) {}
        setTimeout(playChirp, 8000 + Math.random() * 8000);
      };
      setTimeout(playChirp, 4000);
    } else if (ambientType === 'wind') {
      const duration = 3.0;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      filter.Q.value = 1.5;
      
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 250;
      
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      
      source.connect(filter).connect(gain);
      source.start();
      this.activeAmbientOsc = source as any;
    } else {
      const duration = 2.0;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350;
      
      source.connect(filter).connect(gain);
      source.start();
      this.activeAmbientOsc = source as any;
    }
  }

  playMobAmbient(type: string) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    if (type === 'cow') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(75, ctx.currentTime + 0.85);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.85);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } else if (type === 'sheep') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.value = 14;
      vibratoGain.gain.value = 15;
      vibrato.connect(vibratoGain).connect(osc.frequency);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      vibrato.start();
      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } else if (type === 'zombie' || type === 'zombie_villager' || type === 'husk' || type === 'drowned') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(65, ctx.currentTime + 0.75);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } else if (type === 'pig') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.setValueAtTime(80, ctx.currentTime + 0.15);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'chicken') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.setValueAtTime(380, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'villager') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(125, ctx.currentTime + 0.35);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, ctx.currentTime);
      filter.Q.value = 2.0;

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(filter).connect(gain).connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  }

  playCreeperFuse() {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const duration = 1.5;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const noise = Math.random() * 2 - 1;
      const crackle = 0.8 + 0.2 * Math.sin(t * 100);
      data[i] = noise * crackle * 0.18;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1.5;

    source.connect(filter).connect(this.sfxGain!);
    source.start();
  }

  dispose() {
    if (this.activeAmbientOsc) {
      try {
        (this.activeAmbientOsc as any).stop();
      } catch (e) {}
    }
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
