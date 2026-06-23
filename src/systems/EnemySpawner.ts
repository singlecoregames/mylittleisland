import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { ENEMY_TYPES, GRUNT, type EnemyType } from '../data/enemies';
import { BOSS_EVERY_MS, currentPhase, type WavePhase } from '../data/waves';
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

// Spawns aliens at the island's water edge per the wave table (cadence, batch
// size, type weights) and drives their chase along the flow field. Enemy
// HP/speed ramp continuously with run time. Bosses spawn on a fixed timer.
// Pooled.
export class EnemySpawner {
  readonly group: Phaser.Physics.Arcade.Group;
  private accumMs = 0;
  private elapsedMs = 0;
  private bossTimerMs = BOSS_EVERY_MS;
  private steerVec = new Phaser.Math.Vector2();
  private avoidVec = new Phaser.Math.Vector2();
  private bossBars: Phaser.GameObjects.Graphics;
  // Spatial hash of active enemies, rebuilt each frame (arrays reused).
  private grid = new Map<number, Enemy[]>();

  constructor(
    scene: Phaser.Scene,
    private island: IslandManager,
    private onEnemyFire: (
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      ranged: NonNullable<EnemyType['ranged']>,
    ) => void,
  ) {
    this.group = scene.physics.add.group({
      classType: Enemy,
      maxSize: 400,
      runChildUpdate: false,
    });
    this.bossBars = scene.add.graphics().setDepth(8);
  }

  update(deltaMs: number, flow: FlowField, targetX: number, targetY: number): void {
    this.elapsedMs += deltaMs;

    // Wave-table-driven spawning: cadence, batch size, and type weights come
    // from the active phase.
    const phase = currentPhase(this.elapsedMs / 60000);
    this.accumMs += deltaMs;
    if (this.accumMs >= phase.intervalMs) {
      this.accumMs -= phase.intervalMs;
      for (let i = 0; i < phase.batch; i++) this.spawnOne(phase);
    }

    // Scheduled boss spawns.
    this.bossTimerMs -= deltaMs;
    if (this.bossTimerMs <= 0) {
      this.bossTimerMs += BOSS_EVERY_MS;
      const { x, y } = this.randomEdgePoint();
      this.spawnType(x, y, ENEMY_TYPES.boss);
    }

    this.rebuildGrid();

    this.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;

      // Crowd forces apply to every type: separation from neighbours +
      // avoidance push off barricades.
      const sep = this.separation(e);
      const avoid = flow.avoid(e.x, e.y, this.avoidVec);
      const crowdX = sep.x * SEP_WEIGHT + avoid.x * AVOID_WEIGHT;
      const crowdY = sep.y * SEP_WEIGHT + avoid.y * AVOID_WEIGHT;

      // Ranged types fire on cooldown while within range. `hold` types stop at
      // standoff range; non-hold types (bosses) keep chasing while shooting.
      const ranged = e.enemyType.ranged;
      if (ranged) {
        const dx = targetX - e.x;
        const dy = targetY - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= ranged.range) {
          e.fireCooldownMs -= deltaMs;
          if (e.fireCooldownMs <= 0) {
            this.onEnemyFire(e.x, e.y, targetX, targetY, ranged);
            e.fireCooldownMs = ranged.cooldownMs;
          }
          if (ranged.hold !== false) {
            let desX = crowdX;
            let desY = crowdY;
            if (dist > 0 && dist < ranged.range * 0.55) {
              desX -= dx / dist; // too close: back off
              desY -= dy / dist;
            }
            e.steerToward(desX, desY, deltaMs);
            return;
          }
        }
      }

      // Default: follow the flow field toward the player. The enemy steers its
      // own heading toward this gradually, so it isn't normalized here.
      const dir = flow.sampleDir(e.x, e.y, targetX, targetY, this.steerVec);
      e.steerToward(dir.x + crowdX, dir.y + crowdY, deltaMs);
    });

    this.drawBossBars();
  }

  // Draws an HP bar above each active boss.
  private drawBossBars(): void {
    this.bossBars.clear();
    this.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active || !e.enemyType.isBoss) return;
      const w = 44;
      const h = 5;
      const x = e.x - w / 2;
      const y = e.y - 34;
      const frac = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      this.bossBars.fillStyle(0x000000, 0.6);
      this.bossBars.fillRect(x - 1, y - 1, w + 2, h + 2);
      this.bossBars.fillStyle(0xff3b3b, 1);
      this.bossBars.fillRect(x, y, w * frac, h);
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

  private spawnOne(phase: WavePhase): void {
    const { x, y } = this.randomEdgePoint();
    this.spawnType(x, y, this.pickType(phase.weights));
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

  // Weighted roll over a phase's type-weight map.
  private pickType(weights: Record<string, number>): EnemyType {
    let total = 0;
    for (const id in weights) total += weights[id];
    if (total <= 0) return GRUNT;
    let r = Math.random() * total;
    for (const id in weights) {
      r -= weights[id];
      if (r <= 0) return ENEMY_TYPES[id] ?? GRUNT;
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
