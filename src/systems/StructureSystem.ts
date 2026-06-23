import Phaser from 'phaser';
import { GAME } from '../config';
import { Projectile } from '../entities/Projectile';
import { Structure } from '../entities/Structure';
import { Enemy } from '../entities/Enemy';
import { STRUCTURES, type StructureDef } from '../data/structures';
import type { IslandManager } from './IslandManager';
import type { WeaponSystem } from './WeaponSystem';

const FENCE_HIT_INTERVAL = 300; // ms between contact-damage ticks per enemy

// Manages player-placed structures: per-type build credits, tile-snapped
// placement (with a validity-tinted ghost), auto-firing turrets, and solid
// fences that block + chip aliens. Kills route through WeaponSystem so XP gems
// / kill counts stay single-sourced.
export class StructureSystem {
  private turrets: Structure[] = [];
  private fenceGroup: Phaser.Physics.Arcade.StaticGroup;
  private occupied = new Set<string>();
  private projectiles: Phaser.Physics.Arcade.Group;
  private ghost: Phaser.GameObjects.Image;
  private fenceNextHit = new WeakMap<Enemy, number>();

  private credits = new Map<string, number>();
  buildMode = false;
  selectedId: string | null = null;
  damageMult = 1; // meta "시설 강화" scales all structure damage

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

    // Fences are solid: aliens collide with them and take contact damage.
    this.fenceGroup = scene.physics.add.staticGroup();
    scene.physics.add.collider(this.enemies, this.fenceGroup, this.onFenceContact);

    this.ghost = scene.add
      .image(0, 0, STRUCTURES.cannon.tex)
      .setDepth(50)
      .setAlpha(0.55)
      .setVisible(false);
  }

  creditsOf(id: string): number {
    return this.credits.get(id) ?? 0;
  }

  addCredits(id: string, n: number): void {
    this.credits.set(id, this.creditsOf(id) + n);
  }

  // Snapshot of all build credits for the HUD.
  creditSnapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of Object.keys(STRUCTURES)) out[id] = this.creditsOf(id);
    return out;
  }

  // Tapping a build button: select that type, or exit if it's already active.
  toggleBuildMode(id: string): void {
    if (this.buildMode && this.selectedId === id) {
      this.setBuildMode(false);
      return;
    }
    this.selectedId = id;
    this.setBuildMode(true);
  }

  setBuildMode(on: boolean): void {
    const id = this.selectedId;
    this.buildMode = on && id != null && this.creditsOf(id) > 0;
    if (this.buildMode && id) {
      this.ghost.setTexture(STRUCTURES[id].tex).setVisible(true);
    } else {
      this.ghost.setVisible(false);
    }
  }

  // Places the selected structure at the tile under a world position. Returns
  // true on success (consuming a credit of that type).
  tryPlaceAtWorld(worldX: number, worldY: number): boolean {
    const id = this.selectedId;
    if (!this.buildMode || !id || this.creditsOf(id) <= 0) return false;
    const col = Math.floor(worldX / GAME.TILE);
    const row = Math.floor(worldY / GAME.TILE);
    if (!this.island.isLandAtWorld(worldX, worldY)) return false;
    const key = `${col},${row}`;
    if (this.occupied.has(key)) return false;

    const cx = col * GAME.TILE + GAME.TILE / 2;
    const cy = row * GAME.TILE + GAME.TILE / 2;
    this.placeStructure(STRUCTURES[id], cx, cy);
    this.occupied.add(key);

    this.addCredits(id, -1);
    if (this.creditsOf(id) <= 0) this.setBuildMode(false);
    return true;
  }

  private placeStructure(def: StructureDef, cx: number, cy: number): void {
    if (def.kind === 'fence') {
      const fence = this.fenceGroup.create(cx, cy, def.tex) as Phaser.Physics.Arcade.Sprite;
      fence.setDepth(3);
      const body = fence.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(GAME.TILE - 4, GAME.TILE - 4);
      body.updateFromGameObject();
      fence.setData('contactDamage', def.contactDamage ?? 0);
    } else {
      this.turrets.push(new Structure(this.scene, cx, cy, def));
    }
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
    for (const s of this.turrets) {
      s.cooldownRemaining -= deltaMs;
      if (s.cooldownRemaining > 0) continue;
      // If nothing's in range, retry soon rather than waste the full cooldown.
      s.cooldownRemaining = this.fireFrom(s) ? s.def.cooldownMs ?? 850 : 150;
    }
  }

  private fireFrom(s: Structure): boolean {
    const range = s.def.range ?? 130;
    const target = this.nearestEnemy(s.x, s.y, range);
    if (!target) return false;
    s.aimAt(target.x, target.y);
    const speed = s.def.projectileSpeed ?? 240;
    const angle = Math.atan2(target.y - s.y, target.x - s.x);
    const proj = this.projectiles.get(s.x, s.y) as Projectile | null;
    if (proj) {
      const dmg = (s.def.damage ?? 6) * this.damageMult;
      proj.fire(s.x, s.y, Math.cos(angle) * speed, Math.sin(angle) * speed, dmg, 1);
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

  // Throttled contact damage so it's frame-rate independent.
  private onFenceContact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
    const enemy = a as Enemy;
    const fence = b as Phaser.GameObjects.GameObject;
    if (!enemy.active) return;
    const dmg = (fence.getData('contactDamage') as number) ?? 0;
    if (dmg <= 0) return;
    const now = this.scene.time.now;
    if (now < (this.fenceNextHit.get(enemy) ?? 0)) return;
    this.fenceNextHit.set(enemy, now + FENCE_HIT_INTERVAL);
    this.weapons.damageEnemy(enemy, dmg * this.damageMult);
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
