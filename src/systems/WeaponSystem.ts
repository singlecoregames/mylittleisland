import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { RunState } from '../state/RunState';
import {
  WEAPONS,
  WeaponDef,
  weaponCooldown,
  weaponDamage,
  weaponProjectileCount,
  weaponRange,
} from '../data/weapons';

interface WeaponInstance {
  def: WeaponDef;
  cooldownRemaining: number;
}

// Drives all auto-firing weapons: ticks cooldowns, fires by weapon kind,
// applies damage, and reports kills (for XP gem drops). Owns the projectile
// pool and the projectile↔enemy overlap.
export class WeaponSystem {
  private projectiles: Phaser.Physics.Arcade.Group;
  private instances = new Map<string, WeaponInstance>();
  private fx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private player: Player,
    private enemies: Phaser.Physics.Arcade.Group,
    private run: RunState,
    private onKill: (x: number, y: number) => void,
  ) {
    this.projectiles = scene.physics.add.group({
      classType: Projectile,
      maxSize: 300,
      runChildUpdate: true,
    });
    this.fx = scene.add.graphics().setDepth(7);
    scene.physics.add.overlap(this.projectiles, this.enemies, this.onProjectileHit);
  }

  // Grants a weapon or raises its level. Keeps RunState.weapons in sync.
  addOrUpgrade(id: string): void {
    const level = (this.run.weapons.get(id) ?? 0) + 1;
    this.run.weapons.set(id, level);
    if (!this.instances.has(id)) {
      this.instances.set(id, { def: WEAPONS[id], cooldownRemaining: 0 });
    }
  }

  update(deltaMs: number): void {
    this.fx.clear();
    for (const inst of this.instances.values()) {
      inst.cooldownRemaining -= deltaMs;
      if (inst.cooldownRemaining <= 0) {
        const fired = this.fire(inst);
        // If nothing to hit, retry soon instead of burning the full cooldown.
        inst.cooldownRemaining = fired
          ? weaponCooldown(inst.def, this.run.cooldownMult)
          : 120;
      }
    }
  }

  private fire(inst: WeaponInstance): boolean {
    const level = this.run.weapons.get(inst.def.id) ?? 1;
    switch (inst.def.kind) {
      case 'projectile':
        return this.fireProjectile(inst.def, level);
      case 'melee':
        return this.fireMelee(inst.def, level);
      case 'aura':
        return this.fireAura(inst.def, level);
    }
  }

  private fireProjectile(def: WeaponDef, level: number): boolean {
    const target = this.nearestEnemy();
    if (!target) return false;
    const count = weaponProjectileCount(def, level, this.run.extraProjectiles);
    const dmg = weaponDamage(def, level, this.run.damageMult);
    const speed = def.projectileSpeed ?? 200;
    const baseAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const spread = Phaser.Math.DegToRad(12);

    for (let i = 0; i < count; i++) {
      // Fan the extra shots symmetrically around the aim direction.
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const angle = baseAngle + offset;
      const proj = this.projectiles.get(this.player.x, this.player.y) as Projectile | null;
      if (proj) {
        proj.fire(
          this.player.x,
          this.player.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          dmg,
          def.pierce ?? 1,
        );
      }
    }
    return true;
  }

  private fireMelee(def: WeaponDef, level: number): boolean {
    const range = weaponRange(def, level);
    const target = this.nearestEnemy(range);
    if (!target) return false;
    const dmg = weaponDamage(def, level, this.run.damageMult);
    this.damageEnemy(target, dmg);

    // Quick tongue flick visual toward the target.
    this.fx.lineStyle(3, 0xff5fa2, 0.9);
    this.fx.lineBetween(this.player.x, this.player.y, target.x, target.y);
    return true;
  }

  private fireAura(def: WeaponDef, level: number): boolean {
    const range = weaponRange(def, level);
    const dmg = weaponDamage(def, level, this.run.damageMult);
    let hitAny = false;
    this.enemies.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d <= range) {
        this.damageEnemy(e, dmg);
        hitAny = true;
      }
    });

    // Pulsing ring visual (always shown so the player sees the active zone).
    this.fx.lineStyle(2, 0x9cff7a, 0.5);
    this.fx.strokeCircle(this.player.x, this.player.y, range);
    return hitAny;
  }

  private onProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (a, b) => {
    const proj = a as Projectile;
    const enemy = b as Enemy;
    if (!proj.active || !enemy.active) return;
    this.damageEnemy(enemy, proj.damage);
    proj.pierce -= 1;
    if (proj.pierce <= 0) proj.kill();
  };

  private damageEnemy(enemy: Enemy, amount: number): void {
    if (!enemy.active) return;
    if (enemy.takeDamage(amount)) {
      this.onKill(enemy.x, enemy.y);
      enemy.kill();
      this.run.kills += 1;
    }
  }

  // Nearest active enemy to the player, optionally within maxDist.
  private nearestEnemy(maxDist = Infinity): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist;
    this.enemies.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }
}
