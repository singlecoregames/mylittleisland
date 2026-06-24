import { SaveManager } from './SaveManager';

// Tiny asset-free sound system: synthesises blippy SFX with the Web Audio API
// (oscillator + gain envelope), matching the procedural-art philosophy. A
// single shared AudioContext is created lazily and resumed on the first user
// gesture (browsers block audio until then). Some effects are throttled so
// rapid events (shots, pickups) don't machine-gun.
interface Sfx {
  freq: number;
  slideTo?: number; // glide to this frequency over the note
  dur: number; // seconds
  type?: OscillatorType;
  vol?: number;
  throttleMs?: number;
}

const SFX: Record<string, Sfx> = {
  shoot: { freq: 720, slideTo: 480, dur: 0.07, type: 'square', vol: 0.12, throttleMs: 70 },
  pickup: { freq: 880, slideTo: 1320, dur: 0.06, type: 'triangle', vol: 0.12, throttleMs: 50 },
  hurt: { freq: 200, slideTo: 90, dur: 0.18, type: 'sawtooth', vol: 0.25, throttleMs: 120 },
  levelup: { freq: 520, slideTo: 1040, dur: 0.3, type: 'square', vol: 0.2 },
  skill: { freq: 320, slideTo: 760, dur: 0.22, type: 'sawtooth', vol: 0.22 },
  place: { freq: 440, slideTo: 560, dur: 0.08, type: 'square', vol: 0.18 },
  bossSpawn: { freq: 140, slideTo: 70, dur: 0.6, type: 'sawtooth', vol: 0.3 },
  bossDown: { freq: 660, slideTo: 110, dur: 0.7, type: 'square', vol: 0.3 },
  gameover: { freq: 330, slideTo: 70, dur: 0.9, type: 'triangle', vol: 0.3 },
};

export class AudioSystem {
  private static ctx: AudioContext | null = null;
  private static muted = false;
  private static lastAt: Record<string, number> = {};

  // Reads the persisted mute setting and arms a one-shot gesture unlock.
  static init(): void {
    this.muted = SaveManager.load().muted;
    const unlock = () => {
      this.ensureCtx()?.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  static setMuted(muted: boolean): void {
    this.muted = muted;
    SaveManager.setMuted(muted);
  }

  static isMuted(): boolean {
    return this.muted;
  }

  static play(name: keyof typeof SFX): void {
    if (this.muted) return;
    const sfx = SFX[name];
    if (!sfx) return;
    const ctx = this.ensureCtx();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (sfx.throttleMs) {
      const last = this.lastAt[name] ?? -Infinity;
      if (now * 1000 - last < sfx.throttleMs) return;
      this.lastAt[name] = now * 1000;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = sfx.type ?? 'square';
    osc.frequency.setValueAtTime(sfx.freq, now);
    if (sfx.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, sfx.slideTo), now + sfx.dur);
    }
    const vol = sfx.vol ?? 0.2;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sfx.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + sfx.dur);
  }

  private static ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }
}
