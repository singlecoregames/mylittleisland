// Data-driven weapon definitions. Balancing lives here, separate from logic so
// new weapons can be added without touching the WeaponSystem.

export type WeaponKind = 'projectile' | 'melee' | 'aura';

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  baseDamage: number;
  cooldownMs: number;
  maxLevel: number;
  projectileSpeed?: number; // projectile kind
  baseCount?: number; // projectile kind: shots per fire
  pierce?: number; // projectile kind: enemies pierced before despawn
  range?: number; // melee/aura kind: effect radius (px)
}

export const WEAPONS: Record<string, WeaponDef> = {
  spit: {
    id: 'spit',
    name: '침방울',
    kind: 'projectile',
    baseDamage: 6,
    cooldownMs: 800,
    maxLevel: 8,
    projectileSpeed: 210,
    baseCount: 1,
    pierce: 1,
  },
  tongue: {
    id: 'tongue',
    name: '혀 채찍',
    kind: 'melee',
    baseDamage: 11,
    cooldownMs: 650,
    maxLevel: 8,
    range: 52,
  },
  lotus: {
    id: 'lotus',
    name: '연꽃 가시',
    kind: 'aura',
    baseDamage: 4,
    cooldownMs: 500,
    maxLevel: 8,
    range: 64,
  },
};

export const MAX_WEAPON_SLOTS = 6;

// --- Effective stat helpers (level + run multipliers folded in) ---

export function weaponDamage(def: WeaponDef, level: number, damageMult: number): number {
  return def.baseDamage * (1 + 0.25 * (level - 1)) * damageMult;
}

export function weaponCooldown(def: WeaponDef, cooldownMult: number): number {
  return def.cooldownMs * cooldownMult;
}

// Projectile count grows by +1 every two levels, plus any run bonus.
export function weaponProjectileCount(def: WeaponDef, level: number, extra: number): number {
  const fromLevel = Math.floor((level - 1) / 2);
  return (def.baseCount ?? 1) + fromLevel + extra;
}

// Aura/melee range grows modestly with level.
export function weaponRange(def: WeaponDef, level: number): number {
  return (def.range ?? 48) * (1 + 0.08 * (level - 1));
}
