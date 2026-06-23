import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import type { Player } from '../entities/Player';
import type { RunState } from '../state/RunState';

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
    });
  }

  // Fires one bullet from (fromX,fromY) toward (targetX,targetY).
  fire(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    speed: number,
    damage: number,
  ): void {
    const proj = this.group.get(fromX, fromY) as Projectile | null;
    if (!proj) return;
    const angle = Math.atan2(targetY - fromY, targetX - fromX);
    proj.fire(fromX, fromY, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, 1);
    proj.setTint(0xff5252);
  }
}
