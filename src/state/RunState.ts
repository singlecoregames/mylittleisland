import type { MetaBonuses } from '../data/metaNodes';

// Central mutable state for a single run. Upgrades (level-up cards) mutate this,
// and systems read effective values from it each frame. A fresh instance is
// created at the start of every run.
export class RunState {
  // --- Passive stats (modified by upgrades) ---
  moveSpeed = 90; // px/sec
  maxHp = 100;
  hp = 100;
  pickupRadius = 48; // px — XP gem attraction range
  damageMult = 1; // global weapon damage multiplier
  cooldownMult = 1; // global weapon cooldown multiplier (<1 = faster)
  extraProjectiles = 0; // bonus projectiles for projectile weapons

  // --- Progression ---
  level = 1;
  xp = 0;
  xpToNext = 5;
  kills = 0;
  timeMs = 0;

  // Owned weapons: id -> current level.
  readonly weapons = new Map<string, number>();

  // Applies permanent meta-graph bonuses to the starting stats. Called once at
  // run start, before systems read any values. `startXp` is handled by the
  // scene (it may trigger level-up cards), so it is intentionally not used here.
  applyMeta(b: MetaBonuses): void {
    this.maxHp += b.maxHp;
    this.hp = this.maxHp;
    this.moveSpeed += b.moveSpeed;
    this.pickupRadius += b.pickupRadius;
    this.damageMult += b.damageMult;
    this.cooldownMult = Math.max(0.2, this.cooldownMult - b.cooldownReduction);
    this.extraProjectiles += b.extraProjectiles;
  }

  // Adds XP and returns how many level-ups were triggered this call.
  addXp(amount: number): number {
    this.xp += amount;
    let levelUps = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      levelUps += 1;
      this.xpToNext = Math.round(5 * Math.pow(this.level, 1.25));
    }
    return levelUps;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }
}
