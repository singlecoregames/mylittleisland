import Phaser from 'phaser';
import { GAME, SCENE_KEYS } from '../config';
import { IslandManager } from '../systems/IslandManager';
import { EnemySpawner } from '../systems/EnemySpawner';
import { WeaponSystem } from '../systems/WeaponSystem';
import { XPSystem } from '../systems/XPSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { StructureSystem } from '../systems/StructureSystem';
import { FlowField } from '../systems/FlowField';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { InputController } from '../core/InputController';
import { RunState } from '../state/RunState';
import { SaveManager } from '../core/SaveManager';
import { aggregateBonuses } from '../data/metaNodes';
import type { LevelUpScene, LevelUpData } from './LevelUpScene';

// Recompute the flow field at most this often (ms) even if the goal keeps moving.
const FLOW_RECOMPUTE_MS = 120;

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
  private structures!: StructureSystem;
  private flow!: FlowField;
  private moveVec = new Phaser.Math.Vector2();
  private tapStart = new Phaser.Math.Vector2();
  private buildModeAt = 0;
  private flowAccumMs = 0;
  private goalCol = -1;
  private goalRow = -1;

  private pendingLevelUps = 0;
  private levelUpActive = false;
  private dead = false;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    // The Arcade physics world persists across scene restarts, so a prior run's
    // gameOver() pause would otherwise leave the next run frozen. Clear it.
    this.physics.resume();

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

    this.flow = new FlowField(this.island);

    const spawn = this.island.centerWorld;
    this.player = new Player(this, spawn.x, spawn.y, this.run);
    this.inputCtrl = new InputController(this);
    this.spawner = new EnemySpawner(this, this.island);

    this.weapons = new WeaponSystem(
      this,
      this.player,
      this.spawner.group,
      this.run,
      (enemy) => {
        this.xp.spawnGem(enemy.x, enemy.y, enemy.enemyType.xp);
        this.spawner.splitOnDeath(enemy);
      },
    );
    this.xp = new XPSystem(this, this.player, this.run, (n) => this.queueLevelUps(n));
    this.structures = new StructureSystem(
      this,
      this.island,
      this.spawner.group,
      this.weapons,
      this.flow,
    );
    this.upgrades = new UpgradeSystem(this.run, this.weapons, (id) =>
      this.structures.addCredits(id, 1),
    );

    // Starting weapon + a free first turret, plus meta-granted structures.
    this.weapons.addOrUpgrade('spit');
    this.structures.addCredits('cannon', 1 + bonuses.startCannons);
    this.structures.addCredits('fence', bonuses.startFences);
    this.structures.damageMult = 1 + bonuses.structureDamageMult;

    // Camera follows the frog but never shows beyond the island grid.
    this.cameras.main.setBounds(0, 0, this.island.worldWidth, this.island.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // Contact damage when an alien touches the frog.
    this.physics.add.overlap(this.player, this.spawner.group, () => {
      if (!this.dead) this.run.takeDamage(0.5);
    });

    // Active skill (croak burst) fired from UIScene.
    this.game.events.on('skill', this.onSkill, this);
    // Build button (UIScene) toggles structure placement mode.
    this.game.events.on('toggleBuild', this.onToggleBuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('skill', this.onSkill, this);
      this.game.events.off('toggleBuild', this.onToggleBuild, this);
    });

    // Tap-to-place: record the tap origin, then place on release if it was a
    // tap (not a joystick drag) and not the same tap that opened build mode.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.tapStart.set(p.x, p.y);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (this.dead || !this.structures.buildMode) return;
      if (this.time.now - this.buildModeAt < 250) return;
      if (Phaser.Math.Distance.Between(p.x, p.y, this.tapStart.x, this.tapStart.y) > 12) return;
      this.structures.tryPlaceAtWorld(p.worldX, p.worldY);
    });

    // HUD/touch overlay on top of this scene.
    this.scene.launch(SCENE_KEYS.UI);

    // Meta "early growth" start XP — may immediately open a level-up card.
    if (bonuses.startXp > 0) this.queueLevelUps(this.run.addXp(bonuses.startXp));
  }

  private onToggleBuild(structureId: string): void {
    this.structures.toggleBuildMode(structureId);
    if (this.structures.buildMode) this.buildModeAt = this.time.now;
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
  // The overlay scene is launched once and then *refreshed* in place for each
  // queued level-up. Restarting the same scene within a single tick (stop +
  // launch) was unreliable on the web and could leave cards unclickable.

  private queueLevelUps(count: number): void {
    this.pendingLevelUps += count;
    if (!this.levelUpActive && this.pendingLevelUps > 0) this.beginLevelUp();
  }

  private beginLevelUp(): void {
    this.levelUpActive = true;
    this.scene.pause();
    const data: LevelUpData = {
      choices: this.upgrades.getChoices(3),
      onPick: (choice) => this.onUpgradePicked(choice),
    };
    this.scene.launch('LevelUp', data);
  }

  private onUpgradePicked(choice: Parameters<UpgradeSystem['apply']>[0]): void {
    this.upgrades.apply(choice);
    this.pendingLevelUps -= 1;
    if (this.pendingLevelUps > 0) {
      // Show the next queued card set without tearing the scene down.
      (this.scene.get('LevelUp') as LevelUpScene).showChoices(this.upgrades.getChoices(3));
    } else {
      this.levelUpActive = false;
      this.scene.stop('LevelUp');
      this.scene.resume();
    }
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

    // Refresh the flow field when the player changes tile or a blocker appears.
    const gc = Math.floor(this.player.x / GAME.TILE);
    const gr = Math.floor(this.player.y / GAME.TILE);
    this.flowAccumMs += delta;
    if (this.flow.dirty || gc !== this.goalCol || gr !== this.goalRow) {
      if (this.flowAccumMs >= FLOW_RECOMPUTE_MS || this.goalCol < 0) {
        this.flow.compute(gc, gr);
        this.goalCol = gc;
        this.goalRow = gr;
        this.flowAccumMs = 0;
      }
    }

    this.spawner.update(delta, this.flow, this.player.x, this.player.y);
    this.weapons.update(delta);
    this.structures.update(delta);
    this.xp.update();

    const pointer = this.input.activePointer;
    this.structures.updateGhost(pointer.worldX, pointer.worldY);

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
    this.registry.set('buildCredits', this.structures.creditSnapshot());
    this.registry.set('buildMode', this.structures.buildMode);
    this.registry.set('buildSelected', this.structures.selectedId);
  }
}
