import Phaser from 'phaser';
import { GAME, TEX } from '../config';

// Owns the island tile grid (0 = water, 1 = land), renders it, and answers
// spatial queries. Island expansion (meta progression) mutates `tiles`.
export class IslandManager {
  readonly tiles: number[][];
  readonly cols: number;
  readonly rows: number;
  private container: Phaser.GameObjects.Container;

  constructor(
    private scene: Phaser.Scene,
    cols: number,
    rows: number,
  ) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = IslandManager.makeCircularIsland(cols, rows);
    this.container = scene.add.container(0, 0).setDepth(-10);
    this.render();
  }

  // World pixel size of the whole grid.
  get worldWidth(): number {
    return this.cols * GAME.TILE;
  }
  get worldHeight(): number {
    return this.rows * GAME.TILE;
  }

  // Center of the grid in world pixels (handy spawn point).
  get centerWorld(): { x: number; y: number } {
    return { x: this.worldWidth / 2, y: this.worldHeight / 2 };
  }

  isLandAtWorld(x: number, y: number): boolean {
    const col = Math.floor(x / GAME.TILE);
    const row = Math.floor(y / GAME.TILE);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.tiles[row][col] === 1;
  }

  private render(): void {
    this.container.removeAll(true);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const key = this.tiles[r][c] === 1 ? TEX.LAND : TEX.WATER;
        const img = this.scene.add
          .image(c * GAME.TILE, r * GAME.TILE, key)
          .setOrigin(0, 0);
        this.container.add(img);
      }
    }
  }

  // A blobby circular landmass so the playfield reads as an "island".
  private static makeCircularIsland(cols: number, rows: number): number[][] {
    const grid: number[][] = [];
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const radius = Math.min(cols, rows) / 2 - 0.5;
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot(c - cx, r - cy);
        row.push(d <= radius ? 1 : 0);
      }
      grid.push(row);
    }
    return grid;
  }
}
