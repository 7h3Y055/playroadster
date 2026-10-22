/**
 * AudioManager.ts — Pure Web Audio API procedural synthesizer for retro Miami synthwave.
 * Zero external audio files required, zero load latency, zero CORS or missing file errors.
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private muted = false;
  private masterVolume = 0.85;
  private musicVolume = 0.35;
  private sfxVolume = 0.7;

  // ── Engine SFX state ──
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  // ── Thruster SFX state ──
  private thrusterNode: AudioBufferSourceNode | null = null;
  private thrusterGain: GainNode | null = null;

  // ── Hover SFX state ──
  private hoverNode: AudioBufferSourceNode | null = null;
  private hoverGain: GainNode | null = null;
  private isHoverActive = false;

  // ── Noise buffer cache ──
  private noiseBuffer: AudioBuffer | null = null;

  // ── Synthwave BGM Sequencer ──
  private bgmIntervalId: number | null = null;
  private bgmStep = 0;
  private isBgmPlaying = false;

  constructor() {
    // Lazily init on first user gesture
  }

  private _ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;

      // Dynamics Compressor prevents clipping & gives warm, punchy analog glue
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this._initNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private _initNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /** Start engine hum (continuous) */
  public playEngine(): void {
    const ctx = this._ensureContext();
    if (this.engineOsc || !this.sfxGain) return;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(55, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, ctx.currentTime);

    this.engineGain = ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.08, ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc.start();
  }

  /** Stop engine hum smoothly */
  public stopEngine(): void {
    if (!this.engineOsc || !this.engineGain || !this.ctx) return;
    try {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.engineOsc.stop();
      this.engineOsc.disconnect();
    } catch { /* already stopped */ }
    this.engineOsc = null;
    this.engineGain = null;
  }

  /** Modulate engine pitch with player/world speed */
  public setEnginePitch(normalizedSpeed: number): void {
    if (!this.engineOsc || !this.ctx) return;
    const targetFreq = 50 + normalizedSpeed * 65; // 50Hz to 115Hz
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }

  /** Play continuous thruster jet whoosh */
  public playThruster(): void {
    const ctx = this._ensureContext();
    if (this.thrusterNode || !this.noiseBuffer || !this.sfxGain) return;

    this.thrusterNode = ctx.createBufferSource();
    this.thrusterNode.buffer = this.noiseBuffer;
    this.thrusterNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    this.thrusterGain = ctx.createGain();
    this.thrusterGain.gain.setValueAtTime(0.18, ctx.currentTime);

    this.thrusterNode.connect(filter);
    filter.connect(this.thrusterGain);
    this.thrusterGain.connect(this.sfxGain);

    this.thrusterNode.start();
  }

  /** Smoothly stop thruster jet */
  public stopThruster(): void {
    if (!this.thrusterNode || !this.thrusterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.thrusterGain.gain.setTargetAtTime(0.001, now, 0.08);

    const node = this.thrusterNode;
    this.thrusterNode = null;
    this.thrusterGain = null;

    setTimeout(() => {
      try {
        node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }, 150);
  }

  /** Continuous cold-gas hover hiss (smooth loop without click or frame spam) */
  public setHover(active: boolean): void {
    const ctx = this._ensureContext();
    if (!this.noiseBuffer || !this.sfxGain) return;

    if (active && !this.isHoverActive) {
      this.isHoverActive = true;
      if (!this.hoverNode) {
        this.hoverNode = ctx.createBufferSource();
        this.hoverNode.buffer = this.noiseBuffer;
        this.hoverNode.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1600, ctx.currentTime);
        filter.Q.setValueAtTime(0.7, ctx.currentTime);

        this.hoverGain = ctx.createGain();
        this.hoverGain.gain.setValueAtTime(0.001, ctx.currentTime);

        this.hoverNode.connect(filter);
        filter.connect(this.hoverGain);
        this.hoverGain.connect(this.sfxGain);

        this.hoverNode.start();
      }
      this.hoverGain?.gain.setTargetAtTime(0.24, ctx.currentTime, 0.04);
    } else if (!active && this.isHoverActive) {
      this.isHoverActive = false;
      if (this.hoverGain) {
        this.hoverGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
      }
    }
  }

  /** Synthesize custom frequency-ramped noise burst */
  public noise(opts: {
    dur?: number;
    freq?: number;
    freqEnd?: number | null;
    type?: BiquadFilterType;
    gain?: number;
    q?: number;
    attack?: number;
  }): void {
    const ctx = this._ensureContext();
    if (!this.noiseBuffer || !this.sfxGain || this.muted) return;
    const {
      dur = 0.2,
      freq = 1000,
      freqEnd = null,
      type = 'highpass',
      gain = 0.3,
      q = 1,
      attack = 0.003,
    } = opts;

    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    }
    filter.Q.setValueAtTime(q, t);

    const gainNode = ctx.createGain();
    const peakGain = Math.min(0.95, gain);
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.04);
  }

  /** Warm acoustic punch (lowpass filtered sub-bass, avoids harsh electronic blips) */
  private _punch(opts: {
    freqStart: number;
    freqEnd: number;
    dur: number;
    gain: number;
    filterFreq?: number;
  }): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(opts.freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + opts.dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.filterFreq ?? 170, t);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(opts.gain, t + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + opts.dur + 0.04);
  }

  /** Synthesize frequency-ramped oscillator tone */
  public tone(opts: {
    freq?: number;
    freqEnd?: number | null;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    attack?: number;
    delay?: number;
  }): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain || this.muted) return;
    const {
      freq = 440,
      freqEnd = null,
      dur = 0.2,
      type = 'sine',
      gain = 0.3,
      attack = 0.005,
      delay = 0,
    } = opts;

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(gain, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gainNode);
    gainNode.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Cold gas side puff on lane change */
  public puff(vol = 1): void {
    this.noise({
      dur: 0.13,
      freq: 2600,
      freqEnd: 4800,
      gain: 0.28 * vol,
      type: 'highpass',
      q: 0.8,
      attack: 0.002,
    });
    this.noise({
      dur: 0.06,
      freq: 1100,
      gain: 0.20 * vol,
      type: 'bandpass',
      q: 1.6,
      attack: 0.002,
    });
  }

  /**
   * Supersonic cold-gas jump rocket blast.
   * Rich, authentic pneumatic release:
   * 1. High-frequency supersonic jet hiss (highpass 2000 -> 4400 Hz)
   * 2. Mid expansion body (pressurized air jet 900 -> 420 Hz)
   * 3. Low acoustic ground shockwave punch (filtered 85 -> 32 Hz)
   */
  public jump(): void {
    // 1. High-frequency supersonic jet hiss
    this.noise({
      dur: 0.32,
      freq: 2000,
      freqEnd: 4400,
      gain: 0.40,
      type: 'highpass',
      q: 0.8,
      attack: 0.003,
    });

    // 2. Mid expansion body
    this.noise({
      dur: 0.16,
      freq: 900,
      freqEnd: 420,
      gain: 0.34,
      type: 'bandpass',
      q: 1.3,
      attack: 0.004,
    });

    // 3. Low acoustic ground shockwave punch (soft physical thud)
    this._punch({
      freqStart: 85,
      freqEnd: 32,
      dur: 0.20,
      gain: 0.35,
      filterFreq: 160,
    });
  }

  /** Cold-gas boost thruster roar */
  public boost(): void {
    this.noise({
      dur: 0.8,
      freq: 800,
      freqEnd: 3000,
      gain: 0.45,
      type: 'bandpass',
      q: 0.7,
      attack: 0.01,
    });
    this._punch({
      freqStart: 68,
      freqEnd: 34,
      dur: 0.35,
      gain: 0.38,
      filterFreq: 150,
    });
  }

  /** Fluttering cold-gas hover hiss */
  public hover(): void {
    this.setHover(true);
  }

  /** Heavy vehicle landing punch */
  public land(vol = 1): void {
    const v = Math.min(1.2, vol);
    this._punch({
      freqStart: 85,
      freqEnd: 28,
      dur: 0.22,
      gain: 0.45 * v,
      filterFreq: 140,
    });
    this.noise({
      dur: 0.16,
      freq: 400,
      freqEnd: 100,
      gain: 0.25 * v,
      type: 'lowpass',
      q: 0.8,
    });
  }

  /** Downward slam air discharge */
  public slam(): void {
    this.noise({
      dur: 0.26,
      freq: 3000,
      freqEnd: 5800,
      gain: 0.45,
      type: 'highpass',
      attack: 0.003,
    });
    this.noise({
      dur: 0.18,
      freq: 750,
      freqEnd: 280,
      gain: 0.36,
      type: 'bandpass',
      q: 1.4,
    });
    this._punch({
      freqStart: 110,
      freqEnd: 30,
      dur: 0.24,
      gain: 0.42,
      filterFreq: 150,
    });
  }


  /** Near-miss stereo-panned whoosh */
  public playWhoosh(pan: number = 0): void {
    const ctx = this._ensureContext();
    if (!this.noiseBuffer || !this.sfxGain) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.12);
    filter.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

    source.connect(filter);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      filter.connect(gain);
    }

    gain.connect(this.sfxGain);
    source.start();
    source.stop(ctx.currentTime + 0.4);
  }

  /** Realistic dual-tone automotive horn with stereo panning */
  public playHorn(pan: number = 0): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const hornGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(415, ctx.currentTime);
    osc2.frequency.setValueAtTime(515, ctx.currentTime);

    // Warm lowpass filter for brassy metal car horn timbre
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);

    // Realistic punchy horn envelope
    hornGain.gain.setValueAtTime(0.001, ctx.currentTime);
    hornGain.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 0.02);
    hornGain.gain.setValueAtTime(0.24, ctx.currentTime + 0.18);
    hornGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(hornGain);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      hornGain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      hornGain.connect(this.sfxGain);
    }

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  }

  /** Play crisp, ascending golden coin collection chime (like Subway Surfers) */
  public playCoin(): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // 2-tone melodic jump: B5 (987.77Hz) to E6 (1318.51Hz)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  /** Ascending retro chime on combo streak */
  public playStreakChime(multiplier: number): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain) return;

    // Pentatonic scale starting at C5
    const baseFreqs = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const baseFreq = baseFreqs[Math.min(multiplier - 1, baseFreqs.length - 1)] || 523.25;

    [0, 4, 7].forEach((interval, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      const freq = baseFreq * Math.pow(2, interval / 12);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(ctx.currentTime + idx * 0.05);
      osc.stop(ctx.currentTime + idx * 0.05 + 0.4);
    });
  }

  /** Crash explosion SFX */
  public playCrash(): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain) return;

    // Sub rumble
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.5);

    oscGain.gain.setValueAtTime(0.5, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);

    // Noise burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start();
      noise.stop(ctx.currentTime + 0.5);
    }
  }

  /** Countdown beep (600Hz for 3,2,1; 1200Hz for GO) */
  public playBeep(isHigh = false): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHigh ? 1200 : 640, ctx.currentTime);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isHigh ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + (isHigh ? 0.4 : 0.2));
  }

  /** Menu button click sound */
  public playClick(): void {
    const ctx = this._ensureContext();
    if (!this.sfxGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  // ── Procedural Synthwave BGM ──
  public startBGM(): void {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this._ensureContext();

    // 124 BPM = 16th note interval = 60 / 124 / 4 = ~0.121s
    const stepInterval = 120; // ms
    // Synthwave bass notes in D minor (MIDI notes: D1=36, F1=41, G1=43, A1=45, C2=48)
    const bassline = [
      73.42, 73.42, 146.83, 73.42,  // D2, D2, D3, D2
      87.31, 87.31, 174.61, 87.31,  // F2, F2, F3, F2
      98.00, 98.00, 196.00, 98.00,  // G2, G2, G3, G2
      110.00, 98.00, 87.31, 73.42,  // A2, G2, F2, D2
    ];

    this.bgmStep = 0;
    this.bgmIntervalId = window.setInterval(() => {
      if (!this.isBgmPlaying || !this.ctx || !this.musicGain) return;

      const freq = bassline[this.bgmStep % bassline.length]!;
      this.bgmStep++;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.1);
      filter.Q.setValueAtTime(3.0, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 0.12);
    }, stepInterval);
  }

  public stopBGM(): void {
    this.isBgmPlaying = false;
    if (this.bgmIntervalId !== null) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  private wasBgmPlayingBeforePause = false;
  private wasEnginePlayingBeforePause = false;

  /** Pause all audio during game pause */
  public pause(): void {
    this.wasBgmPlayingBeforePause = this.isBgmPlaying;
    this.wasEnginePlayingBeforePause = this.engineOsc !== null;

    if (this.isBgmPlaying) {
      if (this.bgmIntervalId !== null) {
        clearInterval(this.bgmIntervalId);
        this.bgmIntervalId = null;
      }
      this.isBgmPlaying = false;
    }

    this.stopEngine();
    this.stopThruster();
    this.setHover(false);

    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend();
      } catch { /* ignore */ }
    }
  }

  /** Resume all audio when unpaused */
  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      try {
        this.ctx.resume();
      } catch { /* ignore */ }
    }

    if (this.wasEnginePlayingBeforePause && !this.muted) {
      this.playEngine();
    }

    if (this.wasBgmPlayingBeforePause && !this.muted) {
      this.startBGM();
    }
  }

  /** Silence and stop all active continuous sound loops */
  public stopAll(): void {
    this.wasBgmPlayingBeforePause = false;
    this.wasEnginePlayingBeforePause = false;
    this.stopEngine();
    this.stopThruster();
    this.setHover(false);
    this.stopBGM();
  }

  /** Toggle mute */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.muted;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public dispose(): void {
    this.stopBGM();
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* ignore */ }
    }
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
