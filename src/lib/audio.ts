class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playLaneSwitch(): void {
    this.tone(240, 320, 0.06, 'triangle', 0.05);
  }

  public playJump(): void {
    this.tone(280, 560, 0.14, 'sine', 0.08);
  }

  public playSlide(): void {
    this.tone(260, 140, 0.12, 'triangle', 0.06);
  }

  public playCoin(): void {
    this.tone(780, 1180, 0.1, 'sine', 0.07);
  }

  public playShield(): void {
    this.tone(440, 880, 0.22, 'triangle', 0.08);
  }

  public playCrash(): void {
    this.tone(180, 48, 0.28, 'sawtooth', 0.12);
  }

  public playRevive(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    this.tone(440, 660, 0.12, 'sine', 0.07);
    setTimeout(() => this.tone(660, 880, 0.18, 'sine', 0.08), 90);
  }

  public playButton(): void {
    this.tone(520, 600, 0.05, 'sine', 0.04);
  }
}

export const soundEngine = new SoundEngine();
