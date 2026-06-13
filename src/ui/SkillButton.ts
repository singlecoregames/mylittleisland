import Phaser from 'phaser';
import { TEX } from '../config';

// Bottom-right active-skill button with a cooldown sweep. Calls `onActivate`
// when tapped while ready. Screen-space (scrollFactor 0).
export class SkillButton {
  private button: Phaser.GameObjects.Image;
  private cooldownArc: Phaser.GameObjects.Graphics;
  private cooldownMs: number;
  private remainingMs = 0;
  private radius = 30;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cooldownMs: number,
    private onActivate: () => void,
  ) {
    this.cooldownMs = cooldownMs;
    this.button = scene.add
      .image(x, y, TEX.SKILL_BTN)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.cooldownArc = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1001);
    this.cooldownArc.setPosition(x, y);

    this.button.on(Phaser.Input.Events.POINTER_DOWN, this.tryActivate, this);
  }

  private tryActivate(): void {
    if (this.remainingMs > 0) return;
    this.remainingMs = this.cooldownMs;
    this.onActivate();
  }

  update(deltaMs: number): void {
    if (this.remainingMs > 0) {
      this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    }
    this.cooldownArc.clear();
    if (this.remainingMs > 0) {
      const frac = this.remainingMs / this.cooldownMs;
      this.button.setAlpha(0.5);
      this.cooldownArc.fillStyle(0x000000, 0.45);
      this.cooldownArc.slice(
        0,
        0,
        this.radius,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * frac),
        false,
      );
      this.cooldownArc.fillPath();
    } else {
      this.button.setAlpha(1);
    }
  }
}
