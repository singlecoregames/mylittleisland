import Phaser from 'phaser';
import { XpGem } from '../entities/XpGem';
import type { Player } from '../entities/Player';
import type { RunState } from '../state/RunState';
import { AudioSystem } from '../core/AudioSystem';

// Spawns XP gems on enemy death, attracts them to the player within pickup
// radius, collects them, and notifies on level-up.
export class XPSystem {
  private gems: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    private player: Player,
    private run: RunState,
    private onLevelUp: (count: number) => void,
  ) {
    this.gems = scene.physics.add.group({
      classType: XpGem,
      maxSize: 600,
      runChildUpdate: false,
    });
    scene.physics.add.overlap(this.player, this.gems, this.collect);
  }

  spawnGem(x: number, y: number, value = 1): void {
    const gem = this.gems.get(x, y) as XpGem | null;
    if (gem) gem.spawn(x, y, value);
  }

  update(): void {
    const pr = this.run.pickupRadius;
    this.gems.getChildren().forEach((child) => {
      const gem = child as XpGem;
      if (!gem.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, gem.x, gem.y);
      if (d < pr) {
        // Accelerate toward the player; faster as it gets closer.
        const angle = Math.atan2(this.player.y - gem.y, this.player.x - gem.x);
        const speed = Phaser.Math.Linear(120, 260, 1 - d / pr);
        gem.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else {
        gem.setVelocity(0, 0);
      }
    });
  }

  private collect: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, gemObj) => {
    const gem = gemObj as XpGem;
    if (!gem.active) return;
    const value = gem.value;
    gem.kill();
    AudioSystem.play('pickup');
    const levelUps = this.run.addXp(value);
    if (levelUps > 0) this.onLevelUp(levelUps);
  };
}
