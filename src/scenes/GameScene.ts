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
import { SaveManager } from '../core/SaveManager';
import { aggregateBonuses } from '../data/metaNodes';
import type { LevelUpData } from './LevelUpScene';

// Base island dimension (tiles per side) before meta expansion is applied.
const BASE_ISLAND = 14;

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

    // Permanent meta-graph bonuses earned across runs.
    const bonuses = aggregateBonuses(SaveManager.load().nodes);
    this.run.applyMeta(bonuses);

    // Starting island grows with the "island expansion" meta nodes.
    const side = BASE_ISLAND + bonuses.islandTiles;
    this.island = new IslandManager(this, side, side);

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

    // Meta "early growth" start XP — may immediately open a level-up card.
    if (bonuses.startXp > 0) this.queueLevelUps(this.run.addXp(bonuses.startXp));
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

    // Hand the run summary to the settlement scene, which awards/persists amber.
    this.scene.stop(SCENE_KEYS.UI);
    this.scene.start(SCENE_KEYS.RESULT, {
      timeMs: this.run.timeMs,
      kills: this.run.kills,
      level: this.run.level,
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
