import Phaser from 'phaser';
import { SCENE_KEYS } from '../config';

// Minimal first scene: configure input defaults, then hand off to preload.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  create(): void {
    this.input.addPointer(2); // ensure multi-touch pointers exist
    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
