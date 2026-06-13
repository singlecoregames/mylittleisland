import Phaser from 'phaser';
import { TEX } from '../config';

// Pooled projectile. Carries its own damage and remaining pierce count; the
// WeaponSystem owns hit detection. Self-despawns after a lifetime.
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  pierce = 1;
  private lifeMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.PROJECTILE);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(6);
  }

  fire(x: number, y: number, vx: number, vy: number, damage: number, pierce: number): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
    this.damage = damage;
    this.pierce = pierce;
    this.lifeMs = 1600;
  }

  // Called automatically because the pool runs child updates (runChildUpdate).
  update(_time: number, delta: number): void {
    if (!this.active) return;
    this.lifeMs -= delta;
    if (this.lifeMs <= 0) this.kill();
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
