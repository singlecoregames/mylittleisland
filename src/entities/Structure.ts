import Phaser from 'phaser';
import type { StructureDef } from '../data/structures';

// A placed defensive structure, snapped to a tile center. Non-physics image;
// StructureSystem drives its firing cadence. The barrel rotates toward its
// current target for a bit of life.
export class Structure extends Phaser.GameObjects.Image {
  cooldownRemaining = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly def: StructureDef,
  ) {
    super(scene, x, y, def.tex);
    scene.add.existing(this);
    this.setDepth(3);
  }

  aimAt(targetX: number, targetY: number): void {
    // Texture's barrel points up, so offset by 90°.
    this.setRotation(Math.atan2(targetY - this.y, targetX - this.x) + Math.PI / 2);
  }
}
