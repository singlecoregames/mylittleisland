import Phaser from 'phaser';
import { GAME, TEX } from '../config';
import type { IslandManager } from '../systems/IslandManager';

// The frog. Moves via a direction vector; cannot leave the island's land tiles.
export class Player extends Phaser.Physics.Arcade.Sprite {
  speed = 90; // px/sec (upgradeable later)
  maxHp = 100;
  hp = 100;
  private lastLand = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.PLAYER);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(11, GAME.TILE / 2 - 11, GAME.TILE / 2 - 11);
    this.setDepth(5);
    this.lastLand.set(x, y);
  }

  move(dir: Phaser.Math.Vector2, island: IslandManager, deltaSec: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dir.x * this.speed, dir.y * this.speed);

    // After integrating velocity we verify the new center is still on land;
    // if it walked into water, snap back to the last valid land position.
    const nextX = this.x + body.velocity.x * deltaSec;
    const nextY = this.y + body.velocity.y * deltaSec;
    if (island.isLandAtWorld(nextX, nextY)) {
      this.lastLand.set(nextX, nextY);
    } else {
      // Try sliding along whichever axis stays on land (wall-hugging).
      const slideX = island.isLandAtWorld(nextX, this.y);
      const slideY = island.isLandAtWorld(this.x, nextY);
      if (slideX) {
        body.setVelocityY(0);
        this.lastLand.set(nextX, this.y);
      } else if (slideY) {
        body.setVelocityX(0);
        this.lastLand.set(this.x, nextY);
      } else {
        body.setVelocity(0, 0);
      }
    }
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }
}
