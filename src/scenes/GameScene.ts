import Phaser from 'phaser';
import { SCENE_KEYS } from '../config';
import { IslandManager } from '../systems/IslandManager';
import { EnemySpawner } from '../systems/EnemySpawner';
import { WeaponSystem } from '../systems/WeaponSystem';
import { XPSystem } from '../systems/XPSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { InputController } from '../core/InputController';
import { RunState } from '../state/RunState';
import type { LevelUpData } from './LevelUpScene';

// The run scene: island + frog + auto-weapons + chasing aliens + XP/level-ups.
export class GameScene extends Phaser.Scene {
  private run!: RunState;
  private island!: IslandManager;
  private player!: Player;
  private inputCtrl!: InputController;
  private spawner!: EnemySpawner;
  private weapons!: WeaponSystem;
  private xp!: XPSystem;
  private upgrades!: UpgradeSystem;
  private moveVec = new Phaser.Math.Vector2();

  private pendingLevelUps = 0;
  private levelUpActive = false;
  private dead = false;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    this.run = new RunState();
    this.pendingLevelUps = 0;
    this.levelUpActive = false;
    this.dead = false;

    // Starting island: 14x14 tiles. Meta "island expansion" will grow this.
    this.island = new IslandManager(this, 14, 14);

    const spawn = this.island.centerWorld;
    this.player = new Player(this, spawn.x, spawn.y, this.run);
    this.inputCtrl = new InputController(this);
    this.spawner = new EnemySpawner(this, this.island);

    this.weapons = new WeaponSystem(
      this,
      this.player,
      this.spawner.group,
      this.run,
      (x, y) => this.xp.spawnGem(x, y, 1),
    );
    this.xp = new XPSystem(this, this.player, this.run, (n) => this.queueLevelUps(n));
    this.upgrades = new UpgradeSystem(this.run, this.weapons);

    // Starting weapon.
    this.weapons.addOrUpgrade('spit');

    // Camera follows the frog but never shows beyond the island grid.
    this.cameras.main.setBounds(0, 0, this.island.worldWidth, this.island.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // Contact damage when an alien touches the frog.
    this.physics.add.overlap(this.player, this.spawner.group, () => {
      if (!this.dead) this.run.takeDamage(0.5);
    });

    // Active skill (croak burst) fired from UIScene.
    this.game.events.on('skill', this.onSkill, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('skill', this.onSkill, this);
    });

    // HUD/touch overlay on top of this scene.
    this.scene.launch(SCENE_KEYS.UI);
  }

  private onSkill(): void {
    const radius = 96;
    this.spawner.group.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < radius) e.knockback(this.player.x, this.player.y, 320, 350);
    });
  }

  // --- Level-up overlay flow ---------------------------------------------

  private queueLevelUps(count: number): void {
    this.pendingLevelUps += count;
    if (!this.levelUpActive) this.openLevelUp();
  }

  private openLevelUp(): void {
    if (this.pendingLevelUps <= 0) {
      this.levelUpActive = false;
      this.scene.resume();
      return;
    }
    this.pendingLevelUps -= 1;
    this.levelUpActive = true;
    if (!this.scene.isPaused()) this.scene.pause();

    const data: LevelUpData = {
      choices: this.upgrades.getChoices(3),
      onPick: (choice) => {
        this.upgrades.apply(choice);
        this.scene.stop('LevelUp');
        this.openLevelUp(); // show next queued card, or resume if none
      },
    };
    this.scene.launch('LevelUp', data);
  }

  // --- Game over ----------------------------------------------------------

  private gameOver(): void {
    this.dead = true;
    this.physics.pause();

    const cam = this.cameras.main;
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;
    this.add
      .text(cx, cy - 20, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.add
      .text(cx, cy + 14, `생존 ${Math.floor(this.run.timeMs / 1000)}초 · 처치 ${this.run.kills}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.add
      .text(cx, cy + 44, '탭하여 다시 시작', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#aebbd6',
      })
      .setOrigin(0.5)
      .setDepth(2000);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      this.scene.stop(SCENE_KEYS.UI);
      this.scene.restart();
    });
  }

  update(_time: number, delta: number): void {
    if (this.dead) return;

    this.run.timeMs += delta;
    const dt = delta / 1000;

    const dir = this.inputCtrl.getMoveVector(this.moveVec);
    this.player.move(dir, this.island, dt);
    this.spawner.update(delta, this.player.x, this.player.y);
    this.weapons.update(delta);
    this.xp.update();

    this.publishHud();

    if (this.run.isDead) this.gameOver();
  }

  private publishHud(): void {
    this.registry.set('hp', this.run.hp);
    this.registry.set('maxHp', this.run.maxHp);
    this.registry.set('level', this.run.level);
    this.registry.set('xp', this.run.xp);
    this.registry.set('xpToNext', this.run.xpToNext);
    this.registry.set('timeMs', this.run.timeMs);
    this.registry.set('kills', this.run.kills);
  }
}
