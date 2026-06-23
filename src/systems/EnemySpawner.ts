import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import type { IslandManager } from '../systems/IslandManager';
import type { FlowField } from './FlowField';

// Flocking: separation only. Enemies steer apart when closer than this many px
// (center-to-center), blended on top of their flow-field heading so crowds
// spread out instead of stacking on one tile.
const SEP_RADIUS = 22;
const SEP_WEIGHT = 0.9;
const CELL = SEP_RADIUS; // spatial-hash cell size == neighbour radius
const CELL_BIAS = 1024; // keeps hashed cell coords non-negative

// Spawns aliens at the island's water edge on a timer and drives their chase
// along the flow field (so they route around fences). Difficulty (spawn rate +
// enemy HP) ramps with elapsed run time. Pooled.
export class EnemySpawner {
  readonly group: Phaser.Physics.Arcade.Group;
  private accumMs = 0;
  private intervalMs = 1100;
  private elapsedMs = 0;
  private steerVec = new Phaser.Math.Vector2();
  // Spatial hash of active enemies, rebuilt each frame (arrays reused).
  private grid = new Map<number, Enemy[]>();

  constructor(
    scene: Phaser.Scene,
    private island: IslandManager,
  ) {
    this.group = scene.physics.add.group({
      classType: Enemy,
      maxSize: 400,
      runChildUpdate: false,
    });
  }

  update(deltaMs: number, flow: FlowField, targetX: number, targetY: number): void {
    this.elapsedMs += deltaMs;

    this.accumMs += deltaMs;
    if (this.accumMs >= this.intervalMs) {
      this.accumMs -= this.intervalMs;
      this.spawnOne();
    }
    // Spawns accelerate toward a floor of ~320ms over the run.
    this.intervalMs = Math.max(320, this.intervalMs - deltaMs * 0.012);

    this.rebuildGrid();

    this.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;

      // Base heading: follow the flow field toward the player.
      const dir = flow.sampleDir(e.x, e.y, targetX, targetY, this.steerVec);
      let fx = dir.x;
      let fy = dir.y;

      // Separation: sum away-vectors from neighbours, weighted by closeness.
      const sep = this.separation(e);
      fx += sep.x * SEP_WEIGHT;
      fy += sep.y * SEP_WEIGHT;

      const len = Math.hypot(fx, fy);
      if (len > 0) {
        fx /= len;
        fy /= len;
      }
      e.steer(fx, fy, deltaMs);
    });
  }

  // Empties the bucket arrays (keeping them allocated) and re-bins active
  // enemies by their hash cell.
  private rebuildGrid(): void {
    for (const arr of this.grid.values()) arr.length = 0;
    this.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      const key = this.cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let arr = this.grid.get(key);
      if (!arr) {
        arr = [];
        this.grid.set(key, arr);
      }
      arr.push(e);
    });
  }

  private cellKey(cx: number, cy: number): number {
    return (cx + CELL_BIAS) * 65536 + (cy + CELL_BIAS);
  }

  // Accumulated separation push from neighbours within SEP_RADIUS, scanning the
  // enemy's cell and its 8 neighbours. Result is written to the shared sepVec.
  private sepVec = new Phaser.Math.Vector2();
  private separation(e: Enemy): Phaser.Math.Vector2 {
    let sx = 0;
    let sy = 0;
    const cx = Math.floor(e.x / CELL);
    const cy = Math.floor(e.y / CELL);
    const r2 = SEP_RADIUS * SEP_RADIUS;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const arr = this.grid.get(this.cellKey(gx, gy));
        if (!arr) continue;
        for (const other of arr) {
          if (other === e) continue;
          const dx = e.x - other.x;
          const dy = e.y - other.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < r2) {
            const d = Math.sqrt(d2);
            const w = (SEP_RADIUS - d) / SEP_RADIUS; // stronger when closer
            sx += (dx / d) * w;
            sy += (dy / d) * w;
          }
        }
      }
    }
    return this.sepVec.set(sx, sy);
  }

  get activeCount(): number {
    return this.group.countActive(true);
  }

  private spawnOne(): void {
    const { x, y } = this.randomEdgePoint();
    const enemy = this.group.get(x, y) as Enemy | null;
    if (!enemy) return;
    // HP grows ~+1 every 15s; speed drifts up slightly.
    const minutes = this.elapsedMs / 60000;
    const hp = 8 + Math.floor(this.elapsedMs / 15000);
    const speed = 42 + minutes * 6;
    enemy.spawn(x, y, hp, speed);
  }

  // Pick a point just outside the island, in world pixels.
  private randomEdgePoint(): { x: number; y: number } {
    const center = this.island.centerWorld;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.max(this.island.worldWidth, this.island.worldHeight) / 2 + 24;
    return {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    };
  }
}
