import Phaser from 'phaser';
import { GAME, TEX } from '../config';
import { Projectile } from '../entities/Projectile';
import { Structure } from '../entities/Structure';
import { Enemy } from '../entities/Enemy';
import { STRUCTURES } from '../data/structures';
import type { IslandManager } from './IslandManager';
import type { WeaponSystem } from './WeaponSystem';

// Manages player-placed structures: tile-snapped placement (with a build-mode
// ghost), auto-firing turrets, and their projectile pool. Kills are routed
// through WeaponSystem so XP gems / kill counts stay single-sourced.
export class StructureSystem {
  private structures: Structure[] = [];
  private occupied = new Set<string>();
  private projectiles: Phaser.Physics.Arcade.Group;
  private ghost: Phaser.GameObjects.Image;

  buildMode = false;
  credits = 0;

  constructor(
    private scene: Phaser.Scene,
    private island: IslandManager,
    private enemies: Phaser.Physics.Arcade.Group,
    private weapons: WeaponSystem,
  ) {
    this.projectiles = scene.physics.add.group({
      classType: Projectile,
      maxSize: 200,
      runChildUpdate: true,
    });
    scene.physics.add.overlap(this.projectiles, this.enemies, this.onProjectileHit);

    this.ghost = scene.add
      .image(0, 0, TEX.CANNON)
      .setDepth(50)
      .setAlpha(0.55)
      .setVisible(false);
  }

  addCredits(n: number): void {
    this.credits += n;
  }

  // Toggling only enters build mode when there's something to place.
  toggleBuildMode(): void {
    this.setBuildMode(!this.buildMode);
  }

  setBuildMode(on: boolean): void {
    this.buildMode = on && this.credits > 0;
    this.ghost.setVisible(this.buildMode);
  }

  // Attempts to place a turret at the tile under a world position. Returns true
  // on success (consuming a credit).
  tryPlaceAtWorld(worldX: number, worldY: number): boolean {
    if (!this.buildMode || this.credits <= 0) return false;
    const col = Math.floor(worldX / GAME.TILE);
    const row = Math.floor(worldY / GAME.TILE);
    if (!this.island.isLandAtWorld(worldX, worldY)) return false;
    const key = `${col},${row}`;
    if (this.occupied.has(key)) return false;

    const cx = col * GAME.TILE + GAME.TILE / 2;
    const cy = row * GAME.TILE + GAME.TILE / 2;
    this.structures.push(new Structure(this.scene, cx, cy, STRUCTURES.cannon));
    this.occupied.add(key);

    this.credits -= 1;
    if (this.credits <= 0) this.setBuildMode(false);
    return true;
  }

  // Snaps the placement ghost to the tile under the pointer and tints it by
  // validity. No-op outside build mode.
  updateGhost(worldX: number, worldY: number): void {
    if (!this.buildMode) return;
    const col = Math.floor(worldX / GAME.TILE);
    const row = Math.floor(worldY / GAME.TILE);
    this.ghost.setPosition(col * GAME.TILE + GAME.TILE / 2, row * GAME.TILE + GAME.TILE / 2);
    const ok = this.island.isLandAtWorld(worldX, worldY) && !this.occupied.has(`${col},${row}`);
    this.ghost.setTint(ok ? 0x66ff66 : 0xff6666);
  }

  update(deltaMs: number): void {
    for (const s of this.structures) {
      s.cooldownRemaining -= deltaMs;
      if (s.cooldownRemaining > 0) continue;
      // If nothing's in range, retry soon rather than waste the full cooldown.
      s.cooldownRemaining = this.fireFrom(s) ? s.def.cooldownMs : 150;
    }
  }

  private fireFrom(s: Structure): boolean {
    const target = this.nearestEnemy(s.x, s.y, s.def.range);
    if (!target) return false;
    s.aimAt(target.x, target.y);
    const angle = Math.atan2(target.y - s.y, target.x - s.x);
    const proj = this.projectiles.get(s.x, s.y) as Projectile | null;
    if (proj) {
      proj.fire(
        s.x,
        s.y,
        Math.cos(angle) * s.def.projectileSpeed,
        Math.sin(angle) * s.def.projectileSpeed,
        s.def.damage,
        1,
      );
    }
    return true;
  }

  private onProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
    const proj = a as Projectile;
    const enemy = b as Enemy;
    if (!proj.active || !enemy.active) return;
    this.weapons.damageEnemy(enemy, proj.damage);
    proj.pierce -= 1;
    if (proj.pierce <= 0) proj.kill();
  };

  private nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist;
    this.enemies.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }
}
