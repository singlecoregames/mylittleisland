import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { generatePlaceholderTextures } from '../core/TextureFactory';

// Generates placeholder textures (no binary assets yet) and shows a brief
// loading frame before starting the game.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  preload(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;
    this.add
      .text(cx, cy, 'My Little Island', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  create(): void {
    generatePlaceholderTextures(this);
    this.scene.start(SCENE_KEYS.GAME);
  }
}
