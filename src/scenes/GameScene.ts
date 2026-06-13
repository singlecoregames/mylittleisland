import Phaser from 'phaser';
import { SCENE_KEYS } from '../config';
import { IslandManager } from '../systems/IslandManager';
import { EnemySpawner } from '../systems/EnemySpawner';
import { Player } from '../entities/Player';
import { InputController } from '../core/InputController';

// The run scene: island + frog + chasing aliens. Camera follows the frog,
// clamped to the island bounds. Combat/upgrades land in later milestones.
export class GameScene extends Phaser.Scene {
  private island!: IslandManager;
  private player!: Player;
  private inputCtrl!: InputController;
  private spawner!: EnemySpawner;
  private moveVec = new Phaser.Math.Vector2();

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    // Starting island: 14x14 tiles (~448px). Meta "island expansion" grows this.
    this.island = new IslandManager(this, 14, 14);

    const spawn = this.island.centerWorld;
    this.player = new Player(this, spawn.x, spawn.y);
    this.inputCtrl = new InputController(this);
    this.spawner = new EnemySpawner(this, this.island);

    // Camera follows the frog but never shows beyond the island grid.
    this.cameras.main.setBounds(0, 0, this.island.worldWidth, this.island.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // Enemies that touch the frog deal contact damage.
    this.physics.add.overlap(this.player, this.spawner.group, (_p, e) => {
      this.player.takeDamage(0.5);
      void e;
    });

    // Active skill (croak burst): knock back nearby enemies. Fired by UIScene.
    this.game.events.on('skill', this.onSkill, this);

    // Launch the HUD/touch overlay on top of this scene.
    this.scene.launch(SCENE_KEYS.UI);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('skill', this.onSkill, this);
    });
  }

  private onSkill(): void {
    const radius = 90;
    this.spawner.group.getChildren().forEach((child) => {
      const e = child as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < radius) {
        const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
        e.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
      }
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const dir = this.inputCtrl.getMoveVector(this.moveVec);
    this.player.move(dir, this.island, dt);
    this.spawner.update(delta, this.player.x, this.player.y);

    // Publish HP for the HUD.
    this.registry.set('hp', this.player.hp);
    this.registry.set('maxHp', this.player.maxHp);
  }
}
