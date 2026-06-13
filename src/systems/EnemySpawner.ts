import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import type { IslandManager } from '../systems/IslandManager';

// Spawns aliens at the island's water edge on a timer and drives their chase.
// Uses a pooled physics group so dead enemies are recycled (no GC churn).
export class EnemySpawner {
  readonly group: Phaser.Physics.Arcade.Group;
  private accumMs = 0;
  private intervalMs = 1200;

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

  update(deltaMs: number, targetX: number, targetY: number): void {
    this.accumMs += deltaMs;
    if (this.accumMs >= this.intervalMs) {
      this.accumMs -= this.intervalMs;
      this.spawnOne();
    }
    // Difficulty creep: spawns slowly accelerate over the run.
    this.intervalMs = Math.max(350, this.intervalMs - deltaMs * 0.01);

    this.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (e.active) e.chase(targetX, targetY);
    });
  }

  private spawnOne(): void {
    const { x, y } = this.randomEdgePoint();
    const enemy = this.group.get(x, y) as Enemy | null;
    if (enemy) enemy.spawn(x, y);
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
