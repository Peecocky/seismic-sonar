export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
  lon: number;
  lat: number;
  depth: number;
}

interface Voice {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  baseFreq: number;
}

export class SonarEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private bedSource: AudioBufferSourceNode | null = null;
  private voices = new Map<string, Voice>();
  private running = false;
  private volume = 0.5;
  private radius = 1800;
  private muted = false;

  public updateProbe(distances: Map<string, number>) {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    for (const [id, voice] of this.voices) {
      const distance = distances.get(id);
      let target = 0;
      if (distance !== undefined && distance < this.radius) {
        const normalized = 1 - distance / this.radius;
        target = normalized * normalized;
      }
      voice.gain.gain.setTargetAtTime(target * 0.9, now, 0.045);
    }
  }

  public async start(quakes: Quake[]) {
    if (this.running) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.bedSource = this.createNoiseSource();
    this.bedGain = this.ctx.createGain();
    this.bedGain.gain.value = 0.025;
    this.bedSource.connect(this.bedGain).connect(this.masterGain);
    this.bedSource.start();

    for (const quake of quakes) {
      this.voices.set(quake.id, this.buildVoice(quake));
    }

    this.running = true;
  }

  public syncQuakes(quakes: Quake[]) {
    if (!this.running || !this.ctx || !this.masterGain) return;
    const nextIds = new Set(quakes.map((quake) => quake.id));

    for (const [id, voice] of this.voices) {
      if (!nextIds.has(id)) {
        try {
          voice.osc1.stop();
          voice.osc2.stop();
        } catch {}
        this.voices.delete(id);
      }
    }

    for (const quake of quakes) {
      if (!this.voices.has(quake.id)) {
        this.voices.set(quake.id, this.buildVoice(quake));
      }
    }
  }

  public stop() {
    if (!this.ctx) return;
    for (const voice of this.voices.values()) {
      try {
        voice.osc1.stop();
        voice.osc2.stop();
      } catch {}
    }
    try {
      this.bedSource?.stop();
    } catch {}
    this.voices.clear();
    this.ctx.close();
    this.ctx = null;
    this.running = false;
  }

  public setVolume(nextVolume: number) {
    this.volume = nextVolume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(nextVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(nextMuted: boolean) {
    this.muted = nextMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(nextMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setRadius(nextRadius: number) {
    this.radius = nextRadius;
  }

  public getRadius() {
    return this.radius;
  }

  public get isRunning() {
    return this.running;
  }

  public snapshot(): Array<{ id: string; gain: number; freq: number }> {
    const out: Array<{ id: string; gain: number; freq: number }> = [];
    for (const [id, voice] of this.voices) {
      out.push({ id, gain: voice.gain.gain.value, freq: voice.baseFreq });
    }
    return out;
  }

  private magToFreq(mag: number): number {
    const clamped = Math.max(4.0, Math.min(8.0, mag));
    const t = (clamped - 4.0) / 4.0;
    return 680 - t * 560;
  }

  private depthToCutoff(depth: number): number {
    const clamped = Math.max(0, Math.min(700, depth));
    return 6200 - (clamped / 700) * 5700;
  }

  private buildVoice(quake: Quake): Voice {
    const ctx = this.ctx!;
    const baseFreq = this.magToFreq(quake.mag);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = baseFreq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq / 2;

    const mix = ctx.createGain();
    mix.gain.value = 1;

    const sub = ctx.createGain();
    sub.gain.value = Math.min(0.7, Math.max(0.08, (quake.mag - 4.5) / 2.2));

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.depthToCutoff(quake.depth);
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc1.connect(mix);
    osc2.connect(sub).connect(mix);
    mix.connect(filter).connect(gain).connect(this.masterGain!);

    osc1.start();
    osc2.start();

    return { osc1, osc2, filter, gain, baseFreq };
  }

  private createNoiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const frames = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < frames; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }
}
