import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { SkillButton } from '../ui/SkillButton';
import { BUILDABLE_IDS, STRUCTURES } from '../data/structures';

// Screen-space overlay: HP/XP bars, level, timer, kills, virtual joystick, and
// the skill button. Runs in parallel above GameScene; communicates via the
// game registry/events.
export class UIScene extends Phaser.Scene {
  private joystick!: VirtualJoystick;
  private skillButton!: SkillButton;
  private bars!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private buildButtons: {
    id: string;
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
  }[] = [];

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    this.joystick = new VirtualJoystick(this);

    this.skillButton = new SkillButton(
      this,
      GAME.WIDTH - 44,
      GAME.HEIGHT - 44,
      5000,
      () => this.game.events.emit('skill'),
    );

    // Build buttons (above the skill button): one per structure type. Tapping
    // toggles placement mode for that type.
    BUILDABLE_IDS.forEach((id, i) => {
      const x = GAME.WIDTH - 44 - i * 64;
      const y = GAME.HEIGHT - 104;
      const bg = this.add
        .rectangle(x, y, 60, 28, 0x2c7d3a, 0.85)
        .setScrollFactor(0)
        .setDepth(1000)
        .setStrokeStyle(2, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, y, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001);
      bg.on(Phaser.Input.Events.POINTER_DOWN, () => this.game.events.emit('toggleBuild', id));
      this.buildButtons.push({ id, bg, text });
    });

    // Pause button (top-right).
    const pauseBg = this.add
      .rectangle(GAME.WIDTH - 18, 14, 24, 22, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME.WIDTH - 18, 14, 'II', { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);
    pauseBg.on(Phaser.Input.Events.POINTER_DOWN, () => this.game.events.emit('pause'));

    this.bars = this.add.graphics().setScrollFactor(0).setDepth(900);

    this.statusText = this.add
      .text(GAME.WIDTH / 2, 6, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(900);
  }

  update(_time: number, delta: number): void {
    // Feed joystick direction to GameScene's InputController.
    this.registry.set('joyVec', { x: this.joystick.vector.x, y: this.joystick.vector.y });
    this.skillButton.update(delta);
    this.drawBars();
    this.drawStatus();
    this.drawBuildButton();
  }

  private drawBuildButton(): void {
    const credits = (this.registry.get('buildCredits') as Record<string, number>) ?? {};
    const buildMode = (this.registry.get('buildMode') as boolean) ?? false;
    const selected = this.registry.get('buildSelected') as string | null;

    for (const b of this.buildButtons) {
      const count = credits[b.id] ?? 0;
      b.text.setText(`${STRUCTURES[b.id].label} ${count}`);

      // Dim when nothing to place; highlight the active placement type.
      const isActive = buildMode && selected === b.id;
      b.bg.setAlpha(count > 0 ? 0.9 : 0.4);
      b.bg.setFillStyle(isActive ? 0x49b85c : 0x2c7d3a, 0.9);
      b.bg.setStrokeStyle(2, 0xffffff, isActive ? 0.9 : 0);
    }
  }

  private drawBars(): void {
    const hp = (this.registry.get('hp') as number) ?? 100;
    const maxHp = (this.registry.get('maxHp') as number) ?? 100;
    const xp = (this.registry.get('xp') as number) ?? 0;
    const xpToNext = (this.registry.get('xpToNext') as number) ?? 5;

    this.bars.clear();

    // HP bar (top-left).
    this.drawBar(8, 8, 110, 8, Phaser.Math.Clamp(hp / maxHp, 0, 1), 0x992222, 0x33dd55);
    // XP bar (full width, just under HP).
    this.drawBar(8, 20, GAME.WIDTH - 16, 4, Phaser.Math.Clamp(xp / xpToNext, 0, 1), 0x222a44, 0x49c2ff);
  }

  private drawBar(
    x: number,
    y: number,
    w: number,
    h: number,
    frac: number,
    bgColor: number,
    fgColor: number,
  ): void {
    this.bars.fillStyle(0x000000, 0.5);
    this.bars.fillRect(x - 1, y - 1, w + 2, h + 2);
    this.bars.fillStyle(bgColor, 1);
    this.bars.fillRect(x, y, w, h);
    this.bars.fillStyle(fgColor, 1);
    this.bars.fillRect(x, y, w * frac, h);
  }

  private drawStatus(): void {
    const level = (this.registry.get('level') as number) ?? 1;
    const timeMs = (this.registry.get('timeMs') as number) ?? 0;
    const kills = (this.registry.get('kills') as number) ?? 0;
    const secs = Math.floor(timeMs / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    this.statusText.setText(`Lv.${level}   ${mm}:${ss}   처치 ${kills}`);
  }
}
