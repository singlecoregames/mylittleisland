import Phaser from 'phaser';
import { GAME, TEX } from '../config';

// Generates simple placeholder art at runtime so the project builds and runs
// with zero binary assets. Swap these out for real sprites later (M8 polish).
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const T = GAME.TILE;

  // --- Land tile: green with a subtle darker border ---
  drawTexture(scene, TEX.LAND, T, T, (g) => {
    g.fillStyle(0x3a7d3a, 1);
    g.fillRect(0, 0, T, T);
    g.fillStyle(0x4c9a4c, 1);
    g.fillRect(2, 2, T - 4, T - 4);
    g.lineStyle(1, 0x2c5e2c, 1);
    g.strokeRect(0.5, 0.5, T - 1, T - 1);
  });

  // --- Water tile: blue with a lighter ripple band ---
  drawTexture(scene, TEX.WATER, T, T, (g) => {
    g.fillStyle(0x1b3a6b, 1);
    g.fillRect(0, 0, T, T);
    g.fillStyle(0x2a5390, 1);
    g.fillRect(0, T / 2, T, 3);
  });

  // --- Player (frog): rounded green body, fits inside a tile ---
  drawTexture(scene, TEX.PLAYER, T, T, (g) => {
    g.fillStyle(0x6fcf4f, 1);
    g.fillCircle(T / 2, T / 2, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(T / 2 - 4, T / 2 - 4, 3);
    g.fillCircle(T / 2 + 4, T / 2 - 4, 3);
    g.fillStyle(0x1c1c1c, 1);
    g.fillCircle(T / 2 - 4, T / 2 - 4, 1.5);
    g.fillCircle(T / 2 + 4, T / 2 - 4, 1.5);
  });

  // --- Enemy (alien): purple diamond ---
  drawTexture(scene, TEX.ENEMY, T, T, (g) => {
    g.fillStyle(0xb24bd8, 1);
    g.fillCircle(T / 2, T / 2, 9);
    g.fillStyle(0x39ff14, 1);
    g.fillCircle(T / 2, T / 2 - 2, 2.5);
  });

  // --- Virtual joystick base + thumb ---
  const baseR = 44;
  drawTexture(scene, TEX.JOY_BASE, baseR * 2, baseR * 2, (g) => {
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(baseR, baseR, baseR);
    g.lineStyle(2, 0xffffff, 0.3);
    g.strokeCircle(baseR, baseR, baseR - 1);
  });
  const thumbR = 22;
  drawTexture(scene, TEX.JOY_THUMB, thumbR * 2, thumbR * 2, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(thumbR, thumbR, thumbR);
  });

  // --- Skill button ---
  const btnR = 30;
  drawTexture(scene, TEX.SKILL_BTN, btnR * 2, btnR * 2, (g) => {
    g.fillStyle(0xffcc33, 0.85);
    g.fillCircle(btnR, btnR, btnR);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(btnR, btnR, btnR - 1);
  });
}

function drawTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}
