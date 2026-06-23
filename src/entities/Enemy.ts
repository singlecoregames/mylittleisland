import Phaser from 'phaser';
import { GAME, TEX } from '../config';

// How quickly an enemy's heading converges on its desired direction (per second
// lerp factor). Lower = lazier, wider turns; higher = snappier.
const TURN_RATE = 6;

// A basic alien that chases the player. Pooled via the physics group; `spawn`
// re-initializes a recycled instance. HP scales up with run time so weapons
// stay relevant as the player grows.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  speed = 45;
  hp = 10;
  knockbackMs = 0; // while > 0, chase() yields to knockback velocity
  // Persistent heading (unit vector). Steered gradually toward the desired
  // direction each frame so enemies bank into turns instead of snapping.
  private headingX = 0;
  private headingY = 0;

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
    this.headingX = 0; // re-aligns on the first steer
    this.headingY = 0;
    this.setTint(0xffffff);
  }

  // Steers the persistent heading toward a desired direction (flow field +
  // separation, not necessarily normalized) and moves along it. Respects an
  // active knockback window (keeps the knockback velocity until it expires).
  steerToward(desiredX: number, desiredY: number, deltaMs: number): void {
    if (!this.active) return;
    if (this.knockbackMs > 0) {
      this.knockbackMs -= deltaMs;
      return;
    }

    const dlen = Math.hypot(desiredX, desiredY);
    if (dlen > 1e-4) {
      const dx = desiredX / dlen;
      const dy = desiredY / dlen;
      if (this.headingX === 0 && this.headingY === 0) {
        // First frame after spawn: adopt the direction immediately.
        this.headingX = dx;
        this.headingY = dy;
      } else {
        const t = Math.min(1, (TURN_RATE * deltaMs) / 1000);
        this.headingX += (dx - this.headingX) * t;
        this.headingY += (dy - this.headingY) * t;
        const hlen = Math.hypot(this.headingX, this.headingY) || 1;
        this.headingX /= hlen;
        this.headingY /= hlen;
      }
    }
    // If there's no desired direction, coast along the current heading.
    this.setVelocity(this.headingX * this.speed, this.headingY * this.speed);
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
