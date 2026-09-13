// audio.js — all sound is synthesized with the Web Audio API.
// Rationale: no external audio files means zero asset-licensing risk for a
// commercial Play Store release, and a near-zero download footprint.
// Mobile browsers/WebViews require the AudioContext to be resumed from a user
// gesture — unlock() is wired to the first pointer/key event in main.js.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.unlocked = false;
    this._musicTimer = null;
    this._musicStep = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no audio support — game still runs silently
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
  }

  // Must be called from a user gesture.
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  _now() {
    return this.ctx.currentTime;
  }

  // Generic one-shot tone with an envelope.
  _tone({ type = 'square', freq = 440, to = null, dur = 0.15, gain = 0.3, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this._now() + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.3, gain = 0.4, freq = 900 }) {
    if (!this.ctx || this.muted) return;
    const t = this._now();
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3, t);
    filter.frequency.exponentialRampToValueAtTime(freq, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() {
    this._tone({ type: 'square', freq: 880, to: 320, dur: 0.12, gain: 0.14 });
  }

  explosion() {
    this._noise({ dur: 0.35, gain: 0.35, freq: 500 });
    this._tone({ type: 'sawtooth', freq: 180, to: 50, dur: 0.3, gain: 0.18 });
  }

  hit() {
    this._noise({ dur: 0.5, gain: 0.5, freq: 260 });
    this._tone({ type: 'sawtooth', freq: 140, to: 40, dur: 0.45, gain: 0.28 });
  }

  hitSmall() {
    this._tone({ type: 'square', freq: 300, to: 180, dur: 0.06, gain: 0.15 });
  }

  click() {
    this._tone({ type: 'triangle', freq: 520, to: 680, dur: 0.08, gain: 0.12 });
  }

  powerup() {
    this._tone({ type: 'triangle', freq: 440, to: 880, dur: 0.16, gain: 0.2 });
    this._tone({ type: 'triangle', freq: 660, to: 1320, dur: 0.18, gain: 0.14, when: 0.05 });
  }

  rankUp() {
    this._tone({ type: 'triangle', freq: 392, dur: 0.14, gain: 0.16, when: 0 });
    this._tone({ type: 'triangle', freq: 523.25, dur: 0.14, gain: 0.16, when: 0.12 });
    this._tone({ type: 'triangle', freq: 659.25, dur: 0.22, gain: 0.18, when: 0.24 });
  }

  welcome() {
    this._tone({ type: 'triangle', freq: 520, dur: 0.12, gain: 0.12, when: 0 });
    this._tone({ type: 'triangle', freq: 660, dur: 0.12, gain: 0.12, when: 0.1 });
    this._tone({ type: 'triangle', freq: 880, dur: 0.18, gain: 0.12, when: 0.2 });
  }

  // Minimal arpeggiated background loop — scheduled step by step on a timer so
  // it can be cleanly started/stopped and costs almost nothing.
  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    const scale = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
    const stepDur = 0.28;
    const tick = () => {
      if (this.muted) return;
      const f = scale[this._musicStep % scale.length];
      const t = this._now();
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + stepDur + 0.02);
      // Bass every 4 steps
      if (this._musicStep % 4 === 0) {
        const bo = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bo.type = 'sine';
        bo.frequency.value = f / 2;
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 2);
        bo.connect(bg);
        bg.connect(this.musicGain);
        bo.start(t);
        bo.stop(t + stepDur * 2 + 0.02);
      }
      this._musicStep++;
    };
    this._musicTimer = setInterval(tick, stepDur * 1000);
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }

  // Pause/resume the whole context (used on Android onPause/onResume).
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}

export const audio = new AudioEngine();
