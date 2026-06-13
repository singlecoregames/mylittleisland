import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { SkillButton } from '../ui/SkillButton';

// Screen-space overlay: health bar, virtual joystick, and the skill button.
// Runs in parallel above GameScene; communicates via the game registry/events.
export class UIScene extends Phaser.Scene {
  private joystick!: VirtualJoystick;
  private skillButton!: SkillButton;
  private hpBar!: Phaser.GameObjects.Graphics;

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

    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(900);

    this.add
      .text(8, 6, 'HP', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(900);
  }

  update(_time: number, delta: number): void {
    // Feed joystick direction to GameScene's InputController.
    this.registry.set('joyVec', { x: this.joystick.vector.x, y: this.joystick.vector.y });
    this.skillButton.update(delta);
    this.drawHpBar();
  }

  private drawHpBar(): void {
    const hp = (this.registry.get('hp') as number) ?? 100;
    const maxHp = (this.registry.get('maxHp') as number) ?? 100;
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const x = 26;
    const y = 8;
    const w = 80;
    const h = 8;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.5);
    this.hpBar.fillRect(x - 1, y - 1, w + 2, h + 2);
    this.hpBar.fillStyle(0x992222, 1);
    this.hpBar.fillRect(x, y, w, h);
    this.hpBar.fillStyle(0x33dd55, 1);
    this.hpBar.fillRect(x, y, w * frac, h);
  }
}
