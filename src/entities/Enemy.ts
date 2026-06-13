import Phaser from 'phaser';
import { GAME, TEX } from '../config';

// A basic alien that chases the player. Pooled via the physics group; `spawn`
// re-initializes a recycled instance.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  speed = 45;
  hp = 10;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.ENEMY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(9, GAME.TILE / 2 - 9, GAME.TILE / 2 - 9);
    this.setDepth(4);
  }

  spawn(x: number, y: number): void {
    this.enableBody(true, x, y, true, true);
    this.hp = 10;
    this.speed = 45;
  }

  chase(targetX: number, targetY: number): void {
    if (!this.active) return;
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
