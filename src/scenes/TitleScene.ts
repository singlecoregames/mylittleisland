import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { SaveManager } from '../core/SaveManager';
import { AudioSystem } from '../core/AudioSystem';

// Front menu: start a run, jump to permanent upgrades, or toggle sound. Shown
// on load and reachable conceptually as the game's home.
export class TitleScene extends Phaser.Scene {
  private muteLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.TITLE);
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    this.cameras.main.setBackgroundColor('#0b1021');

    this.add
      .text(cx, 78, 'My Little Island', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#6fcf4f',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 112, '나만의 작은 섬', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#aebbd6',
      })
      .setOrigin(0.5);

    const amber = SaveManager.load().amber;
    this.add
      .text(cx, 150, `보유 호박석  ◈${amber}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffd166',
      })
      .setOrigin(0.5);

    this.button(cx, 198, 184, '런 시작 ▶', 0x33dd55, '#06210f', () =>
      this.scene.start(SCENE_KEYS.GAME),
    );
    this.button(cx, 240, 184, '영구 업그레이드', 0x49c2ff, '#06210f', () =>
      this.scene.start(SCENE_KEYS.META),
    );

    this.muteLabel = this.button(cx, 290, 150, '', 0x33405e, '#ffffff', () => {
      AudioSystem.setMuted(!AudioSystem.isMuted());
      this.refreshMute();
      AudioSystem.play('place');
    });
    this.refreshMute();
  }

  private refreshMute(): void {
    this.muteLabel.setText(AudioSystem.isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐');
  }

  // Creates a labelled button and returns its text object (so the caller can
  // relabel it later, e.g. the mute toggle).
  private button(
    x: number,
    y: number,
    w: number,
    label: string,
    bgColor: number,
    textColor: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const bg = this.add
      .rectangle(x, y, w, 32, bgColor)
      .setInteractive({ useHandCursor: true });
    bg.on(Phaser.Input.Events.POINTER_OVER, () => bg.setAlpha(0.85));
    bg.on(Phaser.Input.Events.POINTER_OUT, () => bg.setAlpha(1));
    bg.on(Phaser.Input.Events.POINTER_UP, onClick);
    return this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '14px', color: textColor })
      .setOrigin(0.5);
  }
}
