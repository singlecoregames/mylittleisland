import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { AudioSystem } from '../core/AudioSystem';

export interface PauseData {
  onResume: () => void;
  onQuit: () => void;
}

// Modal pause overlay launched over a paused GameScene: resume, toggle sound,
// or abandon the run back to the title. The full-screen dim is interactive so
// it blocks taps from leaking to the HUD beneath.
export class PauseScene extends Phaser.Scene {
  private muteLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.PAUSE);
  }

  create(data: PauseData): void {
    const cx = GAME.WIDTH / 2;
    this.input.topOnly = true;
    this.add
      .rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setInteractive();

    this.add
      .text(cx, 96, '일시정지', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.button(cx, 158, 180, '계속하기 ▶', 0x33dd55, '#06210f', () => data.onResume());
    this.muteLabel = this.button(cx, 200, 180, '', 0x33405e, '#ffffff', () => {
      AudioSystem.setMuted(!AudioSystem.isMuted());
      this.refreshMute();
    });
    this.refreshMute();
    this.button(cx, 250, 180, '타이틀로 나가기', 0xcc5555, '#1a0606', () => data.onQuit());
  }

  private refreshMute(): void {
    this.muteLabel.setText(AudioSystem.isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐');
  }

  private button(
    x: number,
    y: number,
    w: number,
    label: string,
    bgColor: number,
    textColor: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const bg = this.add.rectangle(x, y, w, 32, bgColor).setInteractive({ useHandCursor: true });
    bg.on(Phaser.Input.Events.POINTER_OVER, () => bg.setAlpha(0.85));
    bg.on(Phaser.Input.Events.POINTER_OUT, () => bg.setAlpha(1));
    bg.on(Phaser.Input.Events.POINTER_UP, onClick);
    return this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '14px', color: textColor })
      .setOrigin(0.5);
  }
}
