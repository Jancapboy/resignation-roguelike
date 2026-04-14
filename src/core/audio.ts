/**
 * 音频管理器 - AudioManager
 * 
 * 简单的音效系统，使用 Web Audio API
 */

export type SoundType = 'click' | 'success' | 'fail' | 'event' | 'gameover';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  constructor() {
    // 延迟初始化，避免自动播放策略问题
    this.enabled = localStorage.getItem('sound_enabled') !== 'false';
  }

  /** 初始化音频上下文（用户交互后调用） */
  init(): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /** 播放音效 */
  play(type: SoundType): void {
    if (!this.enabled || !this.ctx) return;

    const oscillator = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // 不同音效的参数
    const configs: Record<SoundType, { freq: number; duration: number; type: OscillatorType }> = {
      click: { freq: 800, duration: 0.05, type: 'sine' },
      success: { freq: 600, duration: 0.15, type: 'triangle' },
      fail: { freq: 200, duration: 0.3, type: 'sawtooth' },
      event: { freq: 400, duration: 0.2, type: 'square' },
      gameover: { freq: 150, duration: 0.5, type: 'sawtooth' },
    };

    const config = configs[type];
    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.freq, this.ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + config.duration);

    oscillator.start(this.ctx.currentTime);
    oscillator.stop(this.ctx.currentTime + config.duration);
  }

  /** 开关音效 */
  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('sound_enabled', String(this.enabled));
    return this.enabled;
  }

  /** 是否开启 */
  isEnabled(): boolean {
    return this.enabled;
  }
}
