import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES, GRUNT, type EnemyType } from '../data/enemies';
import type { IslandManager } from '../systems/IslandManager';
import type { FlowField } from './FlowField';

// Flocking: separation only. Enemies steer apart when closer than this many px
// (center-to-center), blended on top of their flow-field heading so crowds
// spread out instead of stacking on one tile.
const SEP_RADIUS = 22;
const SEP_WEIGHT = 0.9;
// How strongly barricade avoidance bends the heading (relative to the unit flow).
const AVOID_WEIGHT = 1.4;
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
  private avoidVec = new Phaser.Math.Vector2();
  private typeList = Object.values(ENEMY_TYPES);
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

      // Desired direction = flow-field heading toward the player + separation
      // from neighbours + avoidance push off barricades. The enemy steers its
      // own heading toward this gradually, so it isn't normalized here.
      const dir = flow.sampleDir(e.x, e.y, targetX, targetY, this.steerVec);
      const sep = this.separation(e);
      const avoid = flow.avoid(e.x, e.y, this.avoidVec);
      e.steerToward(
        dir.x + sep.x * SEP_WEIGHT + avoid.x * AVOID_WEIGHT,
        dir.y + sep.y * SEP_WEIGHT + avoid.y * AVOID_WEIGHT,
        deltaMs,
      );
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
    this.spawnType(x, y, this.pickType());
  }

  // Spawns one alien of the given type, scaling the run's ramping base stats by
  // the type's multipliers. Used for both edge spawns and splitter offspring.
  private spawnType(x: number, y: number, type: EnemyType): void {
    const enemy = this.group.get(x, y) as Enemy | null;
    if (!enemy) return;
    // Base HP grows ~+1 every 15s; base speed drifts up slightly.
    const minutes = this.elapsedMs / 60000;
    const baseHp = 8 + Math.floor(this.elapsedMs / 15000);
    const baseSpeed = 42 + minutes * 6;
    enemy.spawn(x, y, Math.max(1, Math.round(baseHp * type.hpMult)), baseSpeed * type.speedMult, type);
  }

  // Weighted roll over the types unlocked by the current run time.
  private pickType(): EnemyType {
    const minutes = this.elapsedMs / 60000;
    let total = 0;
    for (const t of this.typeList) {
      if (t.spawnWeight > 0 && minutes >= t.minMinutes) total += t.spawnWeight;
    }
    if (total <= 0) return GRUNT;
    let r = Math.random() * total;
    for (const t of this.typeList) {
      if (t.spawnWeight <= 0 || minutes < t.minMinutes) continue;
      r -= t.spawnWeight;
      if (r <= 0) return t;
    }
    return GRUNT;
  }

  // Spawns a dying enemy's offspring (splitter → spawnlings), if any.
  splitOnDeath(enemy: Enemy): void {
    const split = enemy.enemyType.splitInto;
    if (!split) return;
    const childType = ENEMY_TYPES[split.type];
    if (!childType) return;
    const ex = enemy.x;
    const ey = enemy.y;
    for (let i = 0; i < split.count; i++) {
      const a = (i / split.count) * Math.PI * 2 + Math.random();
      this.spawnType(ex + Math.cos(a) * 8, ey + Math.sin(a) * 8, childType);
    }
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
