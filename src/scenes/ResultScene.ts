import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { SaveManager } from '../core/SaveManager';

// Run settlement: shown when the frog dies. Converts the run summary into
// permanent currency (amber), persists it, and returns to a fresh run on tap.
// The meta-graph screen (M5 step 2) will sit between this and the next run.
export interface ResultData {
  timeMs: number;
  kills: number;
  level: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.RESULT);
  }

  // Amber earned from a run. Time is the main driver; kills and level add a bit
  // so aggressive play is also rewarded. Kept simple and easy to retune.
  static earnedAmber(d: ResultData): number {
    const secs = d.timeMs / 1000;
    return Math.floor(secs / 10) + Math.floor(d.kills / 3) + (d.level - 1) * 2;
  }

  create(data: ResultData): void {
    const secs = Math.floor(data.timeMs / 1000);
    const earned = ResultScene.earnedAmber(data);
    const save = SaveManager.addAmber(earned);

    // Dim backdrop over the (stopped) game.
    this.add
      .rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x0b1021, 0.92)
      .setOrigin(0)
      .setDepth(0);

    const cx = GAME.WIDTH / 2;

    this.add
      .text(cx, 70, '런 종료', { fontFamily: 'monospace', fontSize: '24px', color: '#ff6b6b' })
      .setOrigin(0.5);

    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    this.add
      .text(
        cx,
        118,
        `생존 ${mm}:${ss}    처치 ${data.kills}    Lv.${data.level}`,
        { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' },
      )
      .setOrigin(0.5);

    this.add
      .text(cx, 162, `획득 호박석  +${earned}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 192, `보유 호박석  ${save.amber}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#aebbd6',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, 268, '탭하여 다시 시작', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#49c2ff',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // Small guard so the death tap doesn't immediately restart.
    this.time.delayedCall(350, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
        this.scene.start(SCENE_KEYS.GAME);
      });
    });
  }
}
