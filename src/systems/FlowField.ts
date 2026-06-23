import Phaser from 'phaser';
import { GAME } from '../config';
import type { IslandManager } from './IslandManager';

const INF = 0x3fffffff;

// 4-neighbour BFS integration field + 8-neighbour flow vectors over the island
// grid. Water and placed blockers (fences) are impassable, so the field routes
// enemies *around* obstacles toward the player instead of grinding against them.
// The grid is small (a few hundred tiles), so a full recompute is cheap and is
// done whenever the goal tile moves or a blocker is added.
export class FlowField {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  private dist: Int32Array;
  private flowX: Float32Array;
  private flowY: Float32Array;
  private queue: Int32Array;
  dirty = true;

  constructor(island: IslandManager) {
    this.cols = island.cols;
    this.rows = island.rows;
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.dist = new Int32Array(n);
    this.flowX = new Float32Array(n);
    this.flowY = new Float32Array(n);
    this.queue = new Int32Array(n);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Water tiles are permanently impassable.
        this.blocked[r * this.cols + c] = island.tiles[r][c] === 1 ? 0 : 1;
      }
    }
  }

  private idx(c: number, r: number): number {
    return r * this.cols + c;
  }

  private inBounds(c: number, r: number): boolean {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  // Marks a tile impassable (e.g. a fence) and flags the field for recompute.
  markBlocked(col: number, row: number): void {
    if (this.inBounds(col, row)) {
      this.blocked[this.idx(col, row)] = 1;
      this.dirty = true;
    }
  }

  // Rebuilds the integration + flow fields with the player's tile as the goal.
  compute(goalCol: number, goalRow: number): void {
    this.dist.fill(INF);

    const gc = Phaser.Math.Clamp(goalCol, 0, this.cols - 1);
    const gr = Phaser.Math.Clamp(goalRow, 0, this.rows - 1);
    let head = 0;
    let tail = 0;
    const gi = this.idx(gc, gr);
    this.dist[gi] = 0;
    this.queue[tail++] = gi;

    const dc = [1, -1, 0, 0];
    const dr = [0, 0, 1, -1];
    while (head < tail) {
      const cur = this.queue[head++];
      const cc = cur % this.cols;
      const cr = (cur - cc) / this.cols;
      const nd = this.dist[cur] + 1;
      for (let k = 0; k < 4; k++) {
        const nc = cc + dc[k];
        const nr = cr + dr[k];
        if (!this.inBounds(nc, nr)) continue;
        const ni = this.idx(nc, nr);
        if (this.blocked[ni] || this.dist[ni] <= nd) continue;
        this.dist[ni] = nd;
        this.queue[tail++] = ni;
      }
    }

    // Flow vector for each reachable tile points to its lowest-distance
    // 8-neighbour (diagonals disallowed when they'd cut a blocked corner).
    const ddc = [1, -1, 0, 0, 1, 1, -1, -1];
    const ddr = [0, 0, 1, -1, 1, -1, 1, -1];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = this.idx(c, r);
        this.flowX[i] = 0;
        this.flowY[i] = 0;
        if (this.blocked[i] || this.dist[i] === INF) continue;
        let best = this.dist[i];
        let bx = 0;
        let by = 0;
        for (let k = 0; k < 8; k++) {
          const nc = c + ddc[k];
          const nr = r + ddr[k];
          if (!this.inBounds(nc, nr)) continue;
          const ni = this.idx(nc, nr);
          if (this.blocked[ni]) continue;
          if (k >= 4 && (this.blocked[this.idx(c + ddc[k], r)] || this.blocked[this.idx(c, r + ddr[k])])) {
            continue; // would clip through a wall corner
          }
          if (this.dist[ni] < best) {
            best = this.dist[ni];
            bx = ddc[k];
            by = ddr[k];
          }
        }
        if (bx !== 0 || by !== 0) {
          const len = Math.hypot(bx, by);
          this.flowX[i] = bx / len;
          this.flowY[i] = by / len;
        }
      }
    }

    this.dirty = false;
  }

  // Steering direction for an entity at world (ex,ey) toward the player. Uses
  // the flow vector at the entity's tile, falling back to a straight line when
  // off-grid, on an unreachable tile, or already on the final approach.
  sampleDir(
    ex: number,
    ey: number,
    px: number,
    py: number,
    out: Phaser.Math.Vector2,
  ): Phaser.Math.Vector2 {
    const dxp = px - ex;
    const dyp = py - ey;
    // Home straight in once within ~1.2 tiles so enemies actually reach the frog.
    if (Math.hypot(dxp, dyp) < GAME.TILE * 1.2) {
      return out.set(dxp, dyp).normalize();
    }
    const c = Math.floor(ex / GAME.TILE);
    const r = Math.floor(ey / GAME.TILE);
    if (this.inBounds(c, r)) {
      const i = this.idx(c, r);
      if (this.flowX[i] !== 0 || this.flowY[i] !== 0) {
        return out.set(this.flowX[i], this.flowY[i]);
      }
    }
    return out.set(dxp, dyp).normalize();
  }
}
