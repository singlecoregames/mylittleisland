import Phaser from 'phaser';
import { GAME, TEX } from '../config';
import type { IslandManager } from '../systems/IslandManager';
import type { RunState } from '../state/RunState';

// The frog. Reads its speed from RunState (so upgrades take effect) and cannot
// leave the island's land tiles.
export class Player extends Phaser.Physics.Arcade.Sprite {
  private lastLand = new Phaser.Math.Vector2();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private run: RunState,
  ) {
    super(scene, x, y, TEX.PLAYER);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(11, GAME.TILE / 2 - 11, GAME.TILE / 2 - 11);
    this.setDepth(5);
    this.lastLand.set(x, y);
  }

  move(dir: Phaser.Math.Vector2, island: IslandManager, deltaSec: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = this.run.moveSpeed;
    body.setVelocity(dir.x * speed, dir.y * speed);

    // Verify the new center stays on land; if it walks into water, slide along
    // whichever axis remains valid (wall-hugging) or stop.
    const nextX = this.x + body.velocity.x * deltaSec;
    const nextY = this.y + body.velocity.y * deltaSec;
    if (island.isLandAtWorld(nextX, nextY)) {
      this.lastLand.set(nextX, nextY);
    } else if (island.isLandAtWorld(nextX, this.y)) {
      body.setVelocityY(0);
      this.lastLand.set(nextX, this.y);
    } else if (island.isLandAtWorld(this.x, nextY)) {
      body.setVelocityX(0);
      this.lastLand.set(this.x, nextY);
    } else {
      body.setVelocity(0, 0);
    }
  }
}
