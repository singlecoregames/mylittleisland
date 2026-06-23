import Phaser from 'phaser';
import { GAME, TEX } from '../config';
import { GRUNT, enemyTexKey, type EnemyType } from '../data/enemies';

// Default heading convergence (per second lerp factor) when a type doesn't
// override it. Lower = lazier, wider turns; higher = snappier.
const DEFAULT_TURN_RATE = 6;

// A basic alien that chases the player. Pooled via the physics group; `spawn`
// re-initializes a recycled instance. HP scales up with run time so weapons
// stay relevant as the player grows.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  speed = 45;
  hp = 10;
  maxHp = 10; // for boss HP bars
  knockbackMs = 0; // while > 0, chase() yields to knockback velocity
  fireCooldownMs = 0; // ranged types: time until the next shot
  enemyType: EnemyType = GRUNT;
  private knockbackResist = 0;
  private turnRate = DEFAULT_TURN_RATE;
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

  spawn(x: number, y: number, hp: number, speed: number, type: EnemyType): void {
    this.enableBody(true, x, y, true, true);
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.knockbackMs = 0;
    this.headingX = 0; // re-aligns on the first steer
    this.headingY = 0;
    this.enemyType = type;
    // Stagger ranged openers so a wave doesn't volley in unison.
    this.fireCooldownMs = type.ranged ? Math.random() * type.ranged.cooldownMs : 0;
    this.knockbackResist = type.knockbackResist;
    this.turnRate = type.turnRate ?? DEFAULT_TURN_RATE;
    this.setTexture(enemyTexKey(type.id));
    this.clearTint(); // drop any leftover hit-flash from a pooled instance
    // The Arcade circle body scales with the sprite, so the hitbox tracks size.
    this.setScale(type.scale);
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
    if (dlen <= 1e-4) {
      // No desired direction (e.g. a ranged type holding station): stop.
      this.setVelocity(0, 0);
      return;
    }
    const dx = desiredX / dlen;
    const dy = desiredY / dlen;
    if (this.headingX === 0 && this.headingY === 0) {
      // First frame after spawn: adopt the direction immediately.
      this.headingX = dx;
      this.headingY = dy;
    } else {
      const t = Math.min(1, (this.turnRate * deltaMs) / 1000);
      this.headingX += (dx - this.headingX) * t;
      this.headingY += (dy - this.headingY) * t;
      const hlen = Math.hypot(this.headingX, this.headingY) || 1;
      this.headingX /= hlen;
      this.headingY /= hlen;
    }
    this.setVelocity(this.headingX * this.speed, this.headingY * this.speed);
  }

  knockback(fromX: number, fromY: number, force: number, durationMs: number): void {
    const k = 1 - this.knockbackResist;
    if (k <= 0) return; // immovable types ignore knockback entirely
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.setVelocity(Math.cos(angle) * force * k, Math.sin(angle) * force * k);
    this.knockbackMs = durationMs * k;
  }

  // Returns true if this hit killed the enemy.
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) return true;
    // brief hit flash, then restore the type's colour
    this.setTint(0xff8888);
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.clearTint();
    });
    return false;
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
