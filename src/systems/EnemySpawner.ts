import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import type { IslandManager } from '../systems/IslandManager';
import type { FlowField } from './FlowField';

// Spawns aliens at the island's water edge on a timer and drives their chase
// along the flow field (so they route around fences). Difficulty (spawn rate +
// enemy HP) ramps with elapsed run time. Pooled.
export class EnemySpawner {
  readonly group: Phaser.Physics.Arcade.Group;
  private accumMs = 0;
  private intervalMs = 1100;
  private elapsedMs = 0;
  private steerVec = new Phaser.Math.Vector2();

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

    this.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      const dir = flow.sampleDir(e.x, e.y, targetX, targetY, this.steerVec);
      e.steer(dir.x, dir.y, deltaMs);
    });
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
