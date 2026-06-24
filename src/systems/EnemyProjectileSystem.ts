import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import type { Player } from '../entities/Player';
import type { RunState } from '../state/RunState';
import type { EnemyType } from '../data/enemies';
import { AudioSystem } from '../core/AudioSystem';

type RangedDef = NonNullable<EnemyType['ranged']>;

// Pool of hostile bullets fired by ranged aliens. Reuses the Projectile entity
// (tinted red) and damages the player on overlap. Kept separate from the
// player's WeaponSystem so the two never hit each other's targets.
export class EnemyProjectileSystem {
  private group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, player: Player, run: RunState) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: 200,
      runChildUpdate: true,
    });
    scene.physics.add.overlap(player, this.group, (_p, b) => {
      const proj = b as Projectile;
      if (!proj.active) return;
      run.takeDamage(proj.damage);
      proj.kill();
      AudioSystem.play('hurt');
      scene.cameras.main.shake(120, 0.006);
    });
  }

  // Fires a volley aimed at (targetX,targetY): a single shot, a fan, or — when
  // spread covers a full circle — a radial ring (boss attack).
  fireVolley(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    r: RangedDef,
  ): void {
    const count = Math.max(1, r.burst ?? 1);
    const base = Math.atan2(targetY - fromY, targetX - fromX);
    const spread = r.spread ?? 0;
    const radial = spread >= Math.PI * 2 - 0.001;

    for (let i = 0; i < count; i++) {
      let angle = base;
      if (count > 1) {
        angle += radial
          ? (i / count) * Math.PI * 2 // even ring
          : (i - (count - 1) / 2) * (spread / (count - 1)); // centred fan
      }
      this.fireOne(fromX, fromY, angle, r.projectileSpeed, r.damage);
    }
  }

  private fireOne(x: number, y: number, angle: number, speed: number, damage: number): void {
    const proj = this.group.get(x, y) as Projectile | null;
    if (!proj) return;
    proj.fire(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, 1);
    proj.setTint(0xff5252);
  }
}
