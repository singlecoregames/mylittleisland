import Phaser from 'phaser';
import { GAME, TEX } from '../config';
import type { IslandManager } from './IslandManager';
import type { FlowField } from './FlowField';

const SPAWN_CLEARANCE = 3; // keep this many tiles around the centre spawn clear
const MIN_SPACING = 2; // min tile gap between rocks (Chebyshev)

// Scatters a few impassable rocks across the island at run start. They register
// as flow-field blockers (so enemies route around them) and expose a static
// group for physics colliders. Count scales with island size.
export class ObstacleSystem {
  readonly group: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene, island: IslandManager, flow: FlowField, count: number) {
    this.group = scene.physics.add.staticGroup();
    this.scatter(island, flow, count);
  }

  private scatter(island: IslandManager, flow: FlowField, count: number): void {
    const cc = Math.floor(island.cols / 2);
    const cr = Math.floor(island.rows / 2);

    // Candidate land tiles, away from the spawn area.
    const candidates: { c: number; r: number }[] = [];
    for (let r = 0; r < island.rows; r++) {
      for (let c = 0; c < island.cols; c++) {
        if (island.tiles[r][c] !== 1) continue;
        if (Math.max(Math.abs(c - cc), Math.abs(r - cr)) < SPAWN_CLEARANCE) continue;
        candidates.push({ c, r });
      }
    }

    // Fisher–Yates shuffle, then greedily pick spaced-out tiles.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const chosen: { c: number; r: number }[] = [];
    for (const cand of candidates) {
      if (chosen.length >= count) break;
      const tooClose = chosen.some(
        (o) => Math.max(Math.abs(o.c - cand.c), Math.abs(o.r - cand.r)) < MIN_SPACING,
      );
      if (!tooClose) chosen.push(cand);
    }

    for (const { c, r } of chosen) {
      const cx = c * GAME.TILE + GAME.TILE / 2;
      const cy = r * GAME.TILE + GAME.TILE / 2;
      const rock = this.group.create(cx, cy, TEX.ROCK) as Phaser.Physics.Arcade.Sprite;
      rock.setDepth(3);
      const body = rock.body as Phaser.Physics.Arcade.StaticBody;
      body.setCircle(12, GAME.TILE / 2 - 12, GAME.TILE / 2 - 12);
      flow.markBlocked(c, r);
    }
  }
}
