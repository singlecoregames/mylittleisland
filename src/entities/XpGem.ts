import Phaser from 'phaser';
import { TEX } from '../config';

// Pooled experience gem dropped on enemy death. The XPSystem handles attraction
// toward the player and collection.
export class XpGem extends Phaser.Physics.Arcade.Image {
  value = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.GEM);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(3);
  }

  spawn(x: number, y: number, value: number): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(0, 0);
    this.value = value;
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
