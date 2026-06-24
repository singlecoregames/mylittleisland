import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { RunState } from '../state/RunState';
import { AudioSystem } from '../core/AudioSystem';
import {
  WEAPONS,
  WeaponDef,
  weaponCooldown,
  weaponDamage,
  weaponProjectileCount,
  weaponNovaCount,
  weaponOrbCount,
  weaponTargets,
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
  private orbitAngle = 0; // shared rotation phase for orbit weapons

  constructor(
    scene: Phaser.Scene,
    private player: Player,
    private enemies: Phaser.Physics.Arcade.Group,
    private run: RunState,
    private onKill: (enemy: Enemy) => void,
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
      if (inst.def.kind === 'orbit') continue; // orbit ticks continuously below
      inst.cooldownRemaining -= deltaMs;
      if (inst.cooldownRemaining <= 0) {
        const fired = this.fire(inst);
        // If nothing to hit, retry soon instead of burning the full cooldown.
        inst.cooldownRemaining = fired
          ? weaponCooldown(inst.def, this.run.cooldownMult)
          : 120;
      }
    }
    this.updateOrbits(deltaMs);
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
      case 'nova':
        return this.fireNova(inst.def, level);
      case 'lightning':
        return this.fireLightning(inst.def, level);
      case 'orbit':
        return false; // handled in updateOrbits
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
      this.spawnProjectile(angle, speed, dmg, def.pierce ?? 1, def.color);
    }
    AudioSystem.play('shoot');
    return true;
  }

  // Radial burst in all directions (nova kind), independent of any target.
  private fireNova(def: WeaponDef, level: number): boolean {
    const count = weaponNovaCount(def, level, this.run.extraProjectiles);
    const speed = def.projectileSpeed ?? 180;
    const dmg = weaponDamage(def, level, this.run.damageMult);
    for (let i = 0; i < count; i++) {
      this.spawnProjectile((i / count) * Math.PI * 2, speed, dmg, def.pierce ?? 1, def.color);
    }
    AudioSystem.play('shoot');
    return true;
  }

  // Strikes up to N enemies within range instantly, drawing a bolt to each.
  private fireLightning(def: WeaponDef, level: number): boolean {
    const range = weaponRange(def, level);
    const dmg = weaponDamage(def, level, this.run.damageMult);
    const inRange: Enemy[] = [];
    this.enemies.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (!e.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= range) {
        inRange.push(e);
      }
    });
    if (inRange.length === 0) return false;

    const want = weaponTargets(def, level);
    const color = def.color ?? 0xfff2a0;
    for (let i = 0; i < want && inRange.length > 0; i++) {
      const idx = Phaser.Math.Between(0, inRange.length - 1);
      const e = inRange.splice(idx, 1)[0];
      this.fx.lineStyle(2, color, 0.9);
      this.fx.lineBetween(this.player.x, this.player.y, e.x, e.y);
      this.damageEnemy(e, dmg);
    }
    AudioSystem.play('shoot');
    return true;
  }

  // Spawns one tinted projectile travelling at `angle` from the player.
  private spawnProjectile(
    angle: number,
    speed: number,
    dmg: number,
    pierce: number,
    color?: number,
  ): void {
    const proj = this.projectiles.get(this.player.x, this.player.y) as Projectile | null;
    if (!proj) return;
    proj.fire(this.player.x, this.player.y, Math.cos(angle) * speed, Math.sin(angle) * speed, dmg, pierce);
    proj.setTint(color ?? 0xffffff);
  }

  // Orbiting orbs: drawn every frame (continuous spin), damaging nearby enemies
  // on each weapon tick. Shared rotation phase keeps multiple orbit weapons in
  // sync visually.
  private updateOrbits(deltaMs: number): void {
    this.orbitAngle += deltaMs * 0.005;
    for (const inst of this.instances.values()) {
      if (inst.def.kind !== 'orbit') continue;
      const def = inst.def;
      const level = this.run.weapons.get(def.id) ?? 1;
      const orbs = weaponOrbCount(def, level);
      const radius = weaponRange(def, level);
      const dmg = weaponDamage(def, level, this.run.damageMult);

      inst.cooldownRemaining -= deltaMs;
      const tick = inst.cooldownRemaining <= 0;
      if (tick) inst.cooldownRemaining = weaponCooldown(def, this.run.cooldownMult);

      for (let i = 0; i < orbs; i++) {
        const a = this.orbitAngle + (i / orbs) * Math.PI * 2;
        const ox = this.player.x + Math.cos(a) * radius;
        const oy = this.player.y + Math.sin(a) * radius;
        this.fx.fillStyle(def.color ?? 0x49b85c, 0.95);
        this.fx.fillCircle(ox, oy, 5);
        if (tick) {
          this.enemies.getChildren().forEach((child) => {
            const e = child as Enemy;
            if (!e.active) return;
            if (Phaser.Math.Distance.Between(ox, oy, e.x, e.y) <= 12) this.damageEnemy(e, dmg);
          });
        }
      }
    }
  }

  private fireMelee(def: WeaponDef, level: number): boolean {
    const range = weaponRange(def, level);
    const target = this.nearestEnemy(range);
    if (!target) return false;
    const dmg = weaponDamage(def, level, this.run.damageMult);
    this.damageEnemy(target, dmg);

    // Quick flick visual toward the target.
    this.fx.lineStyle(3, def.color ?? 0xff5fa2, 0.9);
    this.fx.lineBetween(this.player.x, this.player.y, target.x, target.y);
    AudioSystem.play('shoot');
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

  // Public so other auto-attackers (e.g. StructureSystem turrets) route kills
  // through the same XP-drop / kill-count path.
  damageEnemy(enemy: Enemy, amount: number): void {
    if (!enemy.active) return;
    if (enemy.takeDamage(amount)) {
      this.onKill(enemy); // still active here: drop XP + spawn any offspring
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
