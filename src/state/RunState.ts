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
