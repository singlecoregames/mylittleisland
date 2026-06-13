import Phaser from 'phaser';
import { GAME, TEX } from '../config';

// A basic alien that chases the player. Pooled via the physics group; `spawn`
// re-initializes a recycled instance. HP scales up with run time so weapons
// stay relevant as the player grows.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  speed = 45;
  hp = 10;
  knockbackMs = 0; // while > 0, chase() yields to knockback velocity

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.ENEMY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(9, GAME.TILE / 2 - 9, GAME.TILE / 2 - 9);
    this.setDepth(4);
  }

  spawn(x: number, y: number, hp: number, speed: number): void {
    this.enableBody(true, x, y, true, true);
    this.hp = hp;
    this.speed = speed;
    this.knockbackMs = 0;
    this.setTint(0xffffff);
  }

  // Drives movement; respects an active knockback window. Returns nothing.
  tick(deltaMs: number, targetX: number, targetY: number): void {
    if (!this.active) return;
    if (this.knockbackMs > 0) {
      this.knockbackMs -= deltaMs;
      return; // keep the knockback velocity this frame
    }
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
  }

  knockback(fromX: number, fromY: number, force: number, durationMs: number): void {
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
    this.knockbackMs = durationMs;
  }

  // Returns true if this hit killed the enemy.
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) return true;
    // brief hit flash
    this.setTint(0xff8888);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.setTint(0xffffff);
    });
    return false;
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
