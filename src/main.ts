import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { LevelUpScene } from './scenes/LevelUpScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: '#0b1021',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Multi-touch: allow joystick + skill button simultaneously.
  input: {
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, GameScene, UIScene, LevelUpScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

// Re-export so the keys are reachable from a single import in tooling/tests.
export { SCENE_KEYS };
